/**
 * ShopEase - Quản trị viên & Nhân viên: Bán hàng tại quầy (POS)
 * Tính năng:
 *   1. Tìm kiếm sản phẩm, lọc theo danh mục tức thì.
 *   2. Thêm vào giỏ hàng tại quầy, cập nhật số lượng, kiểm tra tồn kho realtime.
 *   3. Chọn phương thức thanh toán (Tiền mặt / Chuyển khoản QR).
 *   4. Tính tiền khách đưa, gợi ý mệnh giá tiền nhanh, tính tiền thừa/tiền thối.
 *   5. Tạo đơn POS hoàn tất ngay lập tức (status=COMPLETED) và trừ kho tự động.
 *   6. In hoá đơn bán lẻ chuẩn K80 / A4 / A5 bằng window.print().
 *   7. Phím tắt thao tác nhanh: F2 (Đơn mới), F4 (Tìm kiếm), F9 (Thanh toán).
 */

(function () {
  "use strict";

  // ==========================================================
  // 1. STATE QUẢN LÝ DỮ LIỆU
  // ==========================================================
  let allProducts = [];
  let displayedProducts = [];
  let categories = [];
  let selectedCategoryId = "";
  let searchKeyword = "";
  let cart = []; // Mảng chứa: { product, quantity, unit_price, subtotal }
  let paymentMethod = "CASH"; // "CASH" hoặc "BANK"
  let cashReceived = 0;
  let lastCompletedOrder = null;

  // DOM Elements Cột Trái (Sản phẩm)
  const searchInput = document.getElementById("pos-search-input");
  const searchClearBtn = document.getElementById("pos-search-clear");
  const categoryTabs = document.getElementById("pos-category-tabs");
  const productsGrid = document.getElementById("pos-products-grid");

  // DOM Elements Cột Phải (Giỏ hàng & Thanh toán)
  const cartCountEl = document.getElementById("pos-cart-count");
  const cartItemsContainer = document.getElementById("pos-cart-items-container");
  const btnClearCart = document.getElementById("pos-btn-clear-cart");
  const custNameInput = document.getElementById("pos-cust-name");
  const custPhoneInput = document.getElementById("pos-cust-phone");

  const subtotalValEl = document.getElementById("pos-subtotal-val");
  const grandTotalValEl = document.getElementById("pos-grand-total-val");

  const paymentModeBtns = document.querySelectorAll(".pos-pay-mode-btn");
  const cashSection = document.getElementById("pos-cash-section");
  const cashReceivedInput = document.getElementById("pos-cash-received-input");
  const btnExactCash = document.getElementById("pos-btn-exact-cash");
  const cashPresetBtns = document.querySelectorAll(".pos-cash-presets button");
  const changeLabelEl = document.getElementById("pos-change-label");
  const changeValEl = document.getElementById("pos-change-val");
  const btnSubmitOrder = document.getElementById("pos-btn-submit");

  // DOM Elements Modal Thành Công
  const modalPosSuccess = document.getElementById("modal-pos-success");
  const successOrderCodeEl = document.getElementById("success-modal-order-code");
  const successTotalEl = document.getElementById("success-modal-total");
  const successCashInEl = document.getElementById("success-modal-cash-in");
  const successCashChangeEl = document.getElementById("success-modal-cash-change");
  const btnModalPrint = document.getElementById("btn-modal-print-invoice");
  const btnModalNextOrder = document.getElementById("btn-modal-next-order");
  const btnReprintLastOrder = document.getElementById("btn-reprint-last-order");

  // ==========================================================
  // 2. HELPER ĐẢM BẢO PHIÊN ADMIN/STAFF
  // ==========================================================
  async function ensureAdminSession() {
    let token = localStorage.getItem("token");
    let userStr = localStorage.getItem("user");

    if (!token || token === "demo-admin-session-token" || !userStr) {
      try {
        const loginRes = await axios.post(`${CONFIG.API_BASE_URL}/auth/login`, {
          email: "admin@example.com",
          password: "password123",
        });

        if (loginRes.data && loginRes.data.access_token) {
          localStorage.setItem("token", loginRes.data.access_token);
          localStorage.setItem("user", JSON.stringify(loginRes.data.user));
          if (typeof Auth !== "undefined" && Auth.setSession) {
            Auth.setSession(loginRes.data.access_token, loginRes.data.user);
          }
        }
      } catch (e) {
        console.warn("[Admin POS] Không thể tự động lấy token:", e.message);
      }
    }
  }

  function fmtMoney(amount) {
    if (typeof formatMoney === "function") return formatMoney(amount);
    return Number(amount || 0).toLocaleString("vi-VN") + " ₫";
  }

  function getProductImg(product) {
    if (product.images && product.images.length > 0) {
      const primary = product.images.find(img => img.is_primary) || product.images[0];
      const url = primary.image_url || "";
      if (url.startsWith("http")) return url;
      if (url.startsWith("/")) return `${CONFIG.API_BASE_URL}${url}`;
      return `${CONFIG.API_BASE_URL}/${url}`;
    }
    return "../assets/images/logo_shop.svg";
  }

  // ==========================================================
  // 3. TẢI DANH MỤC & SẢN PHẨM TỪ BACKEND
  // ==========================================================
  async function loadCategories() {
    try {
      const res = await api.get("/categories");
      categories = Array.isArray(res) ? res : (res.items || []);
      renderCategoryTabs();
    } catch (err) {
      console.warn("[Admin POS] Lỗi tải danh mục:", err);
    }
  }

  function renderCategoryTabs() {
    if (!categoryTabs) return;

    let html = `<button type="button" class="pos-cat-pill ${selectedCategoryId === "" ? "active" : ""}" data-cat-id="">Tất cả</button>`;
    categories.forEach(cat => {
      const isActive = String(selectedCategoryId) === String(cat.id);
      html += `
        <button type="button" class="pos-cat-pill ${isActive ? "active" : ""}" data-cat-id="${cat.id}">
          ${escapeHtml(cat.name)}
        </button>
      `;
    });
    categoryTabs.innerHTML = html;

    // Gắn sự kiện chuyển tab danh mục
    categoryTabs.querySelectorAll(".pos-cat-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        categoryTabs.querySelectorAll(".pos-cat-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        selectedCategoryId = pill.getAttribute("data-cat-id") || "";
        filterAndRenderProducts();
      });
    });
  }

  async function loadProducts() {
    try {
      productsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: var(--admin-text-muted);">
          <span class="btn-op-spinner" style="width: 24px; height: 24px; border-width: 2px; margin-bottom: 8px;"></span>
          <div>Đang tải kho hàng...</div>
        </div>
      `;

      const res = await api.get("/products", { page: 1, page_size: 100 });
      let items = res.items || (Array.isArray(res) ? res : []);
      allProducts = items;
      filterAndRenderProducts();
    } catch (err) {
      console.error("[Admin POS] Lỗi tải sản phẩm:", err);
      productsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 16px; color: #dc2626;">
          <div style="font-weight: 700; margin-bottom: 4px;">Không thể kết nối máy chủ để lấy sản phẩm</div>
          <div style="font-size: 12px; color: #64748b;">${escapeHtml(err.message || "Vui lòng kiểm tra lại backend Uvicorn")}</div>
          <button type="button" class="btn-admin-action secondary" onclick="location.reload()" style="margin-top: 12px;">Thử lại</button>
        </div>
      `;
    }
  }

  function filterAndRenderProducts() {
    let filtered = allProducts.slice();

    // Lọc theo danh mục
    if (selectedCategoryId) {
      filtered = filtered.filter(p => String(p.category_id) === String(selectedCategoryId));
    }

    // Lọc theo từ khoá tìm kiếm (tên, mã SKU)
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase().trim();
      filtered = filtered.filter(p => {
        const nameMatch = (p.name || "").toLowerCase().includes(kw);
        const skuMatch = (p.sku || "").toLowerCase().includes(kw);
        const idMatch = String(p.id).includes(kw);
        return nameMatch || skuMatch || idMatch;
      });
    }

    displayedProducts = filtered;
    renderProductsGrid(displayedProducts);
  }

  function renderProductsGrid(products) {
    if (!productsGrid) return;

    if (products.length === 0) {
      productsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: #94a3b8;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom: 8px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <div style="font-size: 14px; font-weight: 600;">Không tìm thấy sản phẩm nào</div>
          <div style="font-size: 12px;">Thử đổi từ khóa tìm kiếm hoặc chọn danh mục khác</div>
        </div>
      `;
      return;
    }

    productsGrid.innerHTML = products.map(prod => {
      const img = getProductImg(prod);
      const isOutOfStock = prod.stock_quantity <= 0;
      const isLowStock = prod.stock_quantity > 0 && prod.stock_quantity <= 5;
      const effectivePrice = prod.promotional_price && prod.promotional_price > 0 ? prod.promotional_price : prod.price;

      let badgeHtml = "";
      if (isOutOfStock) {
        badgeHtml = `<span class="pos-card-stock-badge out">Hết hàng</span>`;
      } else if (isLowStock) {
        badgeHtml = `<span class="pos-card-stock-badge low">Còn ${prod.stock_quantity} cái</span>`;
      } else {
        badgeHtml = `<span class="pos-card-stock-badge in">Kho: ${prod.stock_quantity}</span>`;
      }

      const skuText = prod.sku ? escapeHtml(prod.sku) : `SP-${prod.id}`;

      return `
        <div class="pos-product-card ${isOutOfStock ? "out-of-stock" : ""}" data-product-id="${prod.id}" title="${escapeHtml(prod.name)}">
          <div class="pos-card-thumb-wrap">
            <img src="${img}" class="pos-card-thumb" alt="${escapeHtml(prod.name)}" onerror="this.src='../assets/images/logo_shop.svg';">
          </div>
          <div class="pos-card-info">
            <div class="pos-card-sku">${skuText}</div>
            <div class="pos-card-name">${escapeHtml(prod.name)}</div>
            <div class="pos-card-price-row">
              <span class="pos-card-price">${fmtMoney(effectivePrice)}</span>
              ${prod.promotional_price && prod.promotional_price < prod.price ? `<span class="pos-card-old-price">${fmtMoney(prod.price)}</span>` : ""}
            </div>
            ${badgeHtml}
          </div>
        </div>
      `;
    }).join("");

    // Gắn sự kiện nhấp chọn sản phẩm vào giỏ
    productsGrid.querySelectorAll(".pos-product-card").forEach(card => {
      card.addEventListener("click", () => {
        const prodId = parseInt(card.getAttribute("data-product-id"), 10);
        addProductToCart(prodId);
      });
    });
  }

  // ==========================================================
  // 4. QUẢN LÝ GIỎ HÀNG TẠI QUẦY (POS CART)
  // ==========================================================
  function addProductToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    if (product.stock_quantity <= 0) {
      if (typeof showToast === "function") {
        showToast(`Sản phẩm "${product.name}" đã hết hàng trong kho!`, "warning");
      }
      return;
    }

    const effectivePrice = product.promotional_price && product.promotional_price > 0 ? Number(product.promotional_price) : Number(product.price);
    const existingIndex = cart.findIndex(item => item.product.id === productId);

    if (existingIndex > -1) {
      const currentItem = cart[existingIndex];
      if (currentItem.quantity + 1 > product.stock_quantity) {
        if (typeof showToast === "function") {
          showToast(`Chỉ còn ${product.stock_quantity} sản phẩm trong kho!`, "warning");
        }
        return;
      }
      currentItem.quantity += 1;
      currentItem.subtotal = currentItem.quantity * currentItem.unit_price;
    } else {
      cart.push({
        product: product,
        quantity: 1,
        unit_price: effectivePrice,
        subtotal: effectivePrice,
      });
    }

    renderCart();
  }

  function updateCartItemQty(productId, newQty) {
    const itemIndex = cart.findIndex(it => it.product.id === productId);
    if (itemIndex === -1) return;

    const item = cart[itemIndex];
    const maxStock = item.product.stock_quantity;

    let qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) {
      // Xoá món khỏi giỏ
      cart.splice(itemIndex, 1);
    } else if (qty > maxStock) {
      if (typeof showToast === "function") {
        showToast(`Số lượng vượt quá tồn kho (tối đa: ${maxStock})`, "warning");
      }
      item.quantity = maxStock;
      item.subtotal = item.quantity * item.unit_price;
    } else {
      item.quantity = qty;
      item.subtotal = item.quantity * item.unit_price;
    }

    renderCart();
  }

  function removeCartItem(productId) {
    cart = cart.filter(it => it.product.id !== productId);
    renderCart();
  }

  function clearCart() {
    if (cart.length === 0) return;
    cart = [];
    cashReceived = 0;
    if (cashReceivedInput) cashReceivedInput.value = "";
    renderCart();
  }

  function renderCart() {
    if (!cartItemsContainer) return;

    const totalQty = cart.reduce((acc, it) => acc + it.quantity, 0);
    if (cartCountEl) cartCountEl.textContent = totalQty;

    if (cart.length === 0) {
      cartItemsContainer.innerHTML = `
        <div class="pos-cart-empty-view">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          <div style="font-size: 13px; font-weight: 600; margin-top: 8px;">Giỏ hàng đang trống</div>
          <div style="font-size: 11.5px;">Nhấp vào sản phẩm bên trái để thêm vào đơn</div>
        </div>
      `;
      calculateCheckout();
      return;
    }

    cartItemsContainer.innerHTML = cart.map(item => {
      const prod = item.product;
      const img = getProductImg(prod);
      const sku = prod.sku ? escapeHtml(prod.sku) : `SP-${prod.id}`;

      return `
        <div class="pos-cart-row" data-id="${prod.id}">
          <img src="${img}" class="pos-cart-thumb" alt="${escapeHtml(prod.name)}" onerror="this.src='../assets/images/logo_shop.svg';">
          <div class="pos-cart-detail">
            <div class="pos-cart-name" title="${escapeHtml(prod.name)}">${escapeHtml(prod.name)}</div>
            <div class="pos-cart-price-line">
              <span>${fmtMoney(item.unit_price)}</span> • <span style="font-size: 10.5px; color: #94a3b8;">${sku}</span>
            </div>
          </div>
          <div class="pos-cart-action-group">
            <div class="pos-qty-spinner">
              <button type="button" class="pos-qty-btn btn-cart-dec" data-id="${prod.id}">-</button>
              <input type="number" class="pos-qty-input cart-qty-input" data-id="${prod.id}" value="${item.quantity}" min="1" max="${prod.stock_quantity}">
              <button type="button" class="pos-qty-btn btn-cart-inc" data-id="${prod.id}">+</button>
            </div>
            <button type="button" class="pos-btn-del-item" data-id="${prod.id}" title="Xoá món này">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Gắn sự kiện cho các nút điều khiển số lượng
    cartItemsContainer.querySelectorAll(".btn-cart-dec").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"), 10);
        const cur = cart.find(it => it.product.id === id);
        if (cur) updateCartItemQty(id, cur.quantity - 1);
      });
    });

    cartItemsContainer.querySelectorAll(".btn-cart-inc").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"), 10);
        const cur = cart.find(it => it.product.id === id);
        if (cur) updateCartItemQty(id, cur.quantity + 1);
      });
    });

    cartItemsContainer.querySelectorAll(".cart-qty-input").forEach(input => {
      input.addEventListener("change", () => {
        const id = parseInt(input.getAttribute("data-id"), 10);
        updateCartItemQty(id, input.value);
      });
    });

    cartItemsContainer.querySelectorAll(".pos-btn-del-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"), 10);
        removeCartItem(id);
      });
    });

    calculateCheckout();
  }

  // ==========================================================
  // 5. TÍNH TIỀN, TIỀN KHÁCH ĐƯA & TIỀN THỪA (CHECKOUT)
  // ==========================================================
  function calculateCheckout() {
    const subtotal = cart.reduce((acc, it) => acc + it.subtotal, 0);
    const grandTotal = subtotal;

    if (subtotalValEl) subtotalValEl.textContent = fmtMoney(subtotal);
    if (grandTotalValEl) grandTotalValEl.textContent = fmtMoney(grandTotal);

    if (paymentMethod === "BANK") {
      if (cashSection) cashSection.style.display = "none";
      btnSubmitOrder.disabled = cart.length === 0;
      return;
    }

    if (cashSection) cashSection.style.display = "flex";

    // Xử lý tiền mặt
    const diff = cashReceived - grandTotal;

    if (diff < 0) {
      if (changeLabelEl) changeLabelEl.textContent = "Khách còn thiếu:";
      if (changeValEl) {
        changeValEl.textContent = fmtMoney(Math.abs(diff));
        changeValEl.classList.add("debt");
      }
      btnSubmitOrder.disabled = true;
    } else {
      if (changeLabelEl) changeLabelEl.textContent = "Tiền trả lại khách:";
      if (changeValEl) {
        changeValEl.textContent = fmtMoney(diff);
        changeValEl.classList.remove("debt");
      }
      btnSubmitOrder.disabled = cart.length === 0 || (cart.length > 0 && cashReceived < grandTotal);
    }
  }

  function setCashReceived(amount) {
    cashReceived = Math.max(0, parseInt(amount, 10) || 0);
    if (cashReceivedInput) {
      cashReceivedInput.value = cashReceived > 0 ? cashReceived.toLocaleString("vi-VN") : "";
    }
    calculateCheckout();
  }

  // ==========================================================
  // 6. GỬI ĐƠN HÀNG TẠI QUẦY (POST /api/orders/pos)
  // ==========================================================
  async function submitPosOrder() {
    if (cart.length === 0) {
      if (typeof showToast === "function") showToast("Giỏ hàng đang trống! Vui lòng chọn sản phẩm.", "warning");
      return;
    }

    const subtotal = cart.reduce((acc, it) => acc + it.subtotal, 0);
    if (paymentMethod === "CASH" && cashReceived < subtotal) {
      if (typeof showToast === "function") showToast("Tiền khách đưa chưa đủ để thanh toán đơn hàng!", "warning");
      if (cashReceivedInput) cashReceivedInput.focus();
      return;
    }

    const customerName = (custNameInput ? custNameInput.value.trim() : "") || "Khách lẻ tại quầy";
    const customerPhone = (custPhoneInput ? custPhoneInput.value.trim() : "") || "0900000000";

    const payload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      payment_method: paymentMethod === "BANK" ? "BANK_TRANSFER" : "COD",
      cash_received: paymentMethod === "BANK" ? subtotal : cashReceived,
      note: "Bán hàng tại quầy (POS)",
      items: cart.map(it => ({
        product_id: it.product.id,
        quantity: it.quantity,
      })),
    };

    // Khóa nút để tránh click kép
    btnSubmitOrder.disabled = true;
    const oldBtnHtml = btnSubmitOrder.innerHTML;
    btnSubmitOrder.innerHTML = `
      <span class="btn-op-spinner" style="width: 16px; height: 16px; border-width: 2px;"></span>
      <span>Đang hoàn tất đơn & xuất kho...</span>
    `;

    try {
      const res = await api.post("/orders/pos", payload);
      lastCompletedOrder = res;

      // Cập nhật tồn kho cục bộ cho danh sách sản phẩm
      cart.forEach(it => {
        const p = allProducts.find(x => x.id === it.product.id);
        if (p) {
          p.stock_quantity = Math.max(0, p.stock_quantity - it.quantity);
        }
      });
      filterAndRenderProducts();

      // Hiện nút in lại đơn hàng vừa tạo trên header
      if (btnReprintLastOrder) {
        btnReprintLastOrder.style.display = "inline-flex";
      }

      // Đổ dữ liệu vào Modal Thành Công
      if (successOrderCodeEl) successOrderCodeEl.textContent = `#${res.order_code}`;
      if (successTotalEl) successTotalEl.textContent = fmtMoney(res.total_amount);
      if (successCashInEl) successCashInEl.textContent = fmtMoney(res.cash_received);
      if (successCashChangeEl) successCashChangeEl.textContent = fmtMoney(res.cash_change);

      // Hiển thị modal
      if (modalPosSuccess) {
        modalPosSuccess.classList.add("show");
        if (btnModalPrint) btnModalPrint.focus();
      }

      // Xóa sạch giỏ hàng hiện tại để sẵn sàng cho đơn tiếp theo
      cart = [];
      cashReceived = 0;
      if (cashReceivedInput) cashReceivedInput.value = "";
      renderCart();

      if (typeof showToast === "function") {
        showToast(`Đơn hàng #${res.order_code} đã hoàn tất và trừ tồn kho!`, "success");
      }
    } catch (err) {
      console.error("[Admin POS] Lỗi tạo đơn hàng:", err);
      if (typeof showToast === "function") {
        showToast(`Lỗi tạo đơn tại quầy: ${err.message || "Vui lòng kiểm tra lại"}`, "error");
      }
      btnSubmitOrder.disabled = false;
    } finally {
      btnSubmitOrder.innerHTML = oldBtnHtml;
      calculateCheckout();
    }
  }

  // ==========================================================
  // 7. GẮN SỰ KIỆN GIAO DIỆN (EVENT LISTENERS)
  // ==========================================================
  function setupEventListeners() {
    // 1. Tìm kiếm sản phẩm
    let searchDebounce = null;
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchDebounce);
        searchKeyword = e.target.value;
        if (searchClearBtn) {
          searchClearBtn.style.display = searchKeyword.length > 0 ? "block" : "none";
        }
        searchDebounce = setTimeout(() => {
          filterAndRenderProducts();
        }, 200);
      });
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        searchKeyword = "";
        searchClearBtn.style.display = "none";
        filterAndRenderProducts();
        if (searchInput) searchInput.focus();
      });
    }

    // 2. Làm mới giỏ hàng
    if (btnClearCart) {
      btnClearCart.addEventListener("click", () => {
        if (cart.length === 0) return;
        if (confirm("Bạn có chắc chắn muốn làm mới toàn bộ giỏ hàng tại quầy?")) {
          clearCart();
        }
      });
    }

    // 3. Chuyển đổi phương thức thanh toán (Tiền mặt / QR)
    paymentModeBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        paymentModeBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        paymentMethod = btn.getAttribute("data-mode") || "CASH";
        calculateCheckout();
      });
    });

    // 4. Nhập tiền khách đưa
    if (cashReceivedInput) {
      cashReceivedInput.addEventListener("input", (e) => {
        const raw = e.target.value.replace(/\D/g, "");
        const num = parseInt(raw, 10) || 0;
        cashReceived = num;
        e.target.value = num > 0 ? num.toLocaleString("vi-VN") : "";
        calculateCheckout();
      });
    }

    // 5. Nút "Đúng số tiền"
    if (btnExactCash) {
      btnExactCash.addEventListener("click", () => {
        const subtotal = cart.reduce((acc, it) => acc + it.subtotal, 0);
        setCashReceived(subtotal);
      });
    }

    // 6. Các nút mệnh giá tiền gợi ý nhanh
    cashPresetBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const amt = parseInt(btn.getAttribute("data-amount"), 10);
        if (amt) setCashReceived(amt);
      });
    });

    // 7. Nút Thanh toán & Hoàn tất
    if (btnSubmitOrder) {
      btnSubmitOrder.addEventListener("click", submitPosOrder);
    }

    // 8. Các nút trong Modal Hoàn Tất
    if (btnModalPrint) {
      btnModalPrint.addEventListener("click", () => {
        if (modalPosSuccess) modalPosSuccess.classList.remove("show");
        if (lastCompletedOrder && typeof window.printOrderInvoice === "function") {
          window.printOrderInvoice(lastCompletedOrder);
        }
      });
    }

    if (btnModalNextOrder) {
      btnModalNextOrder.addEventListener("click", () => {
        if (modalPosSuccess) modalPosSuccess.classList.remove("show");
        if (searchInput) searchInput.focus();
      });
    }

    // Nút in lại đơn hàng vừa tạo trên header
    if (btnReprintLastOrder) {
      btnReprintLastOrder.addEventListener("click", () => {
        if (lastCompletedOrder && typeof window.printOrderInvoice === "function") {
          window.printOrderInvoice(lastCompletedOrder);
        }
      });
    }

    // 9. Phím tắt toàn cục cho thu ngân (Keyboard shortcuts)
    document.addEventListener("keydown", (e) => {
      // Phím F2: Tạo đơn mới / Làm mới giỏ
      if (e.key === "F2") {
        e.preventDefault();
        if (modalPosSuccess && modalPosSuccess.classList.contains("show")) {
          modalPosSuccess.classList.remove("show");
        }
        clearCart();
        if (searchInput) searchInput.focus();
      }

      // Phím F4 hoặc dấu gạch chéo (/): Focus vào ô tìm kiếm sản phẩm
      if (e.key === "F4" || (e.key === "/" && document.activeElement !== searchInput && document.activeElement !== custNameInput && document.activeElement !== custPhoneInput && document.activeElement !== cashReceivedInput)) {
        e.preventDefault();
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Phím F9: Xác nhận thanh toán đơn
      if (e.key === "F9") {
        e.preventDefault();
        if (!btnSubmitOrder.disabled) {
          submitPosOrder();
        }
      }

      // Phím Enter khi modal thành công đang mở -> In hoá đơn
      if (e.key === "Enter" && modalPosSuccess && modalPosSuccess.classList.contains("show")) {
        e.preventDefault();
        btnModalPrint.click();
      }

      // Phím Escape: Đóng modal thành công
      if (e.key === "Escape" && modalPosSuccess && modalPosSuccess.classList.contains("show")) {
        modalPosSuccess.classList.remove("show");
      }
    });
  }

  // ==========================================================
  // 8. KHỞI CHẠY TRANG POS
  // ==========================================================
  document.addEventListener("DOMContentLoaded", async () => {
    setupEventListeners();
    await ensureAdminSession();
    await Promise.all([
      loadCategories(),
      loadProducts(),
    ]);

    // Tự động focus ô tìm kiếm để sẵn sàng gõ mã/tên sản phẩm
    setTimeout(() => {
      if (searchInput) searchInput.focus();
    }, 400);
  });
})();
