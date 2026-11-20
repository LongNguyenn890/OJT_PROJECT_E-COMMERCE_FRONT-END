/**
 * SHOPEASE - TRANG GIỎ HÀNG & THANH TOÁN COD (CART.JS)
 * Thiết kế đồng bộ hoàn hảo với hệ thống Frontend nhóm ShopEase
 * Hỗ trợ 2 chế độ:
 *  1. Live Backend (API /cart, /cart/items, /orders) khi người dùng đăng nhập
 *  2. Local Demo Fallback (chuẩn 100% dữ liệu mẫu Figma) khi chạy thử nghiệm
 */

// Key lưu trữ cục bộ cho chế độ Demo
const CART_STORAGE_KEY = "shopease_demo_cart_v1";
const PRODUCT_STORAGE_KEY = "shopease_demo_products_v1";
const SHIPPING_INFO_KEY = "shopease_shipping_info_v1";
const ORDERS_STORAGE_KEY = "shopease_demo_orders_v1";

// Dữ liệu mẫu chuẩn 100% theo giao diện Figma
const FIGMA_DEFAULT_ITEMS = [
  {
    id: 101,
    product_id: 1,
    name: "Bàn phím cơ TKL Red Switch Wireless",
    variant: "Wireless",
    price: 1250000,
    quantity: 1,
    image: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=700&q=85",
    stock_quantity: 15
  },
  {
    id: 102,
    product_id: 3,
    name: "Áo thun Cotton Organic Cao Cấp",
    variant: "Size L • Đen tuyền",
    price: 290000,
    quantity: 2,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=85",
    stock_quantity: 20
  },
  {
    id: 103,
    product_id: 4,
    name: "Bình giữ nhiệt Inox 304 800ml",
    variant: "Dung tích: 800ml",
    price: 245000,
    quantity: 1,
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=700&q=85",
    stock_quantity: 35
  }
];

// Trạng thái giỏ hàng hiện tại trong phiên làm việc
let currentCartState = {
  isBackend: false,
  items: [],
  subtotal: 0,
  shipping_fee: 0,
  total_amount: 0,
  warnings: []
};

// Tập hợp các ID sản phẩm (product_id) đang được người dùng tích chọn để mua
let selectedProductIds = new Set();

/**
 * Đồng bộ danh sách selectedProductIds với các sản phẩm hiện có trong giỏ
 */
function initSelectedProductIds(items) {
  if (!items || items.length === 0) {
    selectedProductIds.clear();
    return;
  }
  const currentIds = new Set(items.map(it => it.product_id));

  // Nếu chưa có món nào được chọn, mặc định chọn tất cả
  if (selectedProductIds.size === 0) {
    items.forEach(it => selectedProductIds.add(it.product_id));
  } else {
    // Chỉ giữ lại những ID còn tồn tại trong giỏ
    for (const id of selectedProductIds) {
      if (!currentIds.has(id)) {
        selectedProductIds.delete(id);
      }
    }
    // Nếu vô tình rỗng sau khi lọc nhưng giỏ vẫn có hàng -> chọn tất cả
    if (selectedProductIds.size === 0) {
      items.forEach(it => selectedProductIds.add(it.product_id));
    }
  }
}

// ==========================================================
// 1. KHỞI TẠO VÀ TẢI DỮ LIỆU GIỎ HÀNG
// ==========================================================
document.addEventListener("DOMContentLoaded", async () => {
  await initShippingFormAutofill();
  setupPhoneValidation();
  setupEventListeners();
  await loadCartData();
});

/**
 * Tải dữ liệu giỏ hàng: ưu tiên API Backend nếu đã đăng nhập;
 * Nếu không thì fallback sang localStorage (khởi tạo data Figma nếu trống)
 */
async function loadCartData() {
  const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");

  if (token && typeof api !== "undefined" && api.get) {
    try {
      const data = await api.get("/cart");
      currentCartState = {
        isBackend: true,
        items: (data.cart_items || []).map(item => ({
          id: item.id,
          product_id: item.product_id,
          name: item.product_name,
          variant: item.variant || "Tiêu chuẩn",
          price: item.product_price,
          quantity: item.quantity,
          image: item.image_url || getProductImageFallback(item.product_id),
          stock_quantity: item.stock_quantity ?? 99,
          price_changed: item.price_changed || false,
          old_price: item.old_price,
          stock_warning: item.stock_warning || false
        })),
        subtotal: data.subtotal || 0,
        shipping_fee: data.shipping_fee || 0,
        total_amount: data.total_amount || 0,
        warnings: data.warnings || []
      };
      renderCart();
      return;
    } catch (err) {
      console.warn("Không kết nối được API giỏ hàng, chuyển sang dữ liệu cục bộ:", err);
    }
  }

  // Chế độ Demo / Offline: sử dụng localStorage
  loadDemoCartData();
}

/**
 * Nạp dữ liệu chế độ Demo từ localStorage
 */
function loadDemoCartData() {
  let savedCart = null;
  try {
    savedCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "null");
  } catch (_) {}

  // Nếu chưa có giỏ hàng trong localStorage, khởi tạo 3 sản phẩm như Figma
  if (!savedCart || !Array.isArray(savedCart) || savedCart.length === 0) {
    savedCart = FIGMA_DEFAULT_ITEMS;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(savedCart));
  }

  // Chuẩn hóa danh sách sản phẩm demo
  const allProducts = JSON.parse(localStorage.getItem(PRODUCT_STORAGE_KEY) || "[]");
  const normalizedItems = savedCart.map(item => {
    const productInfo = allProducts.find(p => p.id === (item.product_id || item.id)) ||
                        FIGMA_DEFAULT_ITEMS.find(p => p.product_id === (item.product_id || item.id)) ||
                        item;

    const qty = Number(item.quantity || item.qty || 1);
    const price = Number(productInfo.price || 0);

    return {
      id: item.id || productInfo.product_id || productInfo.id,
      product_id: productInfo.product_id || productInfo.id || item.id,
      name: productInfo.name || "Sản phẩm",
      variant: item.variant || productInfo.variant || (productInfo.tag ? `Phân loại: ${productInfo.tag}` : "Chính hãng"),
      price: price,
      quantity: qty,
      image: productInfo.image || getProductImageFallback(productInfo.id),
      stock_quantity: productInfo.stock_quantity ?? 50
    };
  });

  // Tính toán Tạm tính, Phí ship (>= 500k: 0đ, < 500k: 30k)
  const subtotal = normalizedItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  let shipping_fee = 0;
  if (normalizedItems.length > 0) {
    shipping_fee = subtotal >= 500000 ? 0 : 30000;
  }
  const total_amount = subtotal + shipping_fee;

  currentCartState = {
    isBackend: false,
    items: normalizedItems,
    subtotal: subtotal,
    shipping_fee: shipping_fee,
    total_amount: total_amount,
    warnings: []
  };

  renderCart();
}

/**
 * Ảnh fallback theo ID sản phẩm nếu thiếu ảnh
 */
function getProductImageFallback(productId) {
  const map = {
    1: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=700&q=85",
    2: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=85",
    3: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=85",
    4: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=700&q=85"
  };
  return map[productId] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=85";
}

// ==========================================================
// 2. RENDER GIAO DIỆN GIỎ HÀNG & SUMMARY SIDEBAR
// ==========================================================
function renderCart() {
  const container = document.getElementById("cart-items-container");
  const warningsContainer = document.getElementById("cart-warnings-container");
  const metaSubtitle = document.getElementById("cart-items-meta");
  const btnPlaceOrder = document.getElementById("btn-place-order");
  const selectAllBar = document.getElementById("cart-select-all-bar");

  if (!container) return;

  const totalLines = currentCartState.items.length;
  const totalQty = currentCartState.items.reduce((s, it) => s + it.quantity, 0);

  // Đồng bộ selectedProductIds
  initSelectedProductIds(currentCartState.items);

  // Cập nhật tiêu đề phụ: "3 mặt hàng (4 món)" chuẩn Figma
  if (metaSubtitle) {
    metaSubtitle.textContent = totalLines > 0
      ? `${totalLines} mặt hàng (${totalQty} món)`
      : "Giỏ hàng hiện đang trống";
  }

  // 1. Render Cảnh báo (nếu có giá thay đổi hoặc thiếu tồn kho)
  if (warningsContainer) {
    if (currentCartState.warnings && currentCartState.warnings.length > 0) {
      warningsContainer.innerHTML = `
        <div class="cart-global-warnings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" style="flex-shrink:0; margin-top:2px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <strong>Thông báo cập nhật giỏ hàng:</strong>
            <ul>
              ${currentCartState.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("")}
            </ul>
          </div>
        </div>
      `;
    } else {
      warningsContainer.innerHTML = "";
    }
  }

  // 2. Giỏ hàng rỗng
  if (totalLines === 0) {
    if (selectAllBar) selectAllBar.style.display = "none";

    container.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="8" cy="21" r="1"></circle>
            <circle cx="19" cy="21" r="1"></circle>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
          </svg>
        </div>
        <h3>Giỏ hàng của bạn đang trống</h3>
        <p>Hãy khám phá hàng ngàn sản phẩm công nghệ, gia dụng chất lượng cao tại ShopEase.</p>
        <a href="customer-home.html#products" class="btn btn-primary" style="display: inline-flex; width: auto; padding: 10px 24px; font-size: 14px; text-decoration: none; border-radius: 8px;">
          Khám phá sản phẩm ngay
        </a>
      </div>
    `;

    if (btnPlaceOrder) {
      btnPlaceOrder.disabled = true;
      btnPlaceOrder.title = "Vui lòng thêm sản phẩm vào giỏ trước khi đặt hàng";
      const btnOrderText = document.getElementById("btn-order-text");
      if (btnOrderText) btnOrderText.textContent = "Giỏ hàng trống";
    }

    renderSummarySidebar();
    syncCartBadge(0);
    return;
  }

  // 3. Giỏ hàng có sản phẩm: Hiển thị thanh Chọn tất cả
  if (selectAllBar) {
    selectAllBar.style.display = "flex";
  }
  syncSelectAllCheckboxUI();

  // 4. Render từng hàng sản phẩm có Checkbox tích chọn
  container.innerHTML = currentCartState.items.map(item => {
    const itemSubtotal = item.price * item.quantity;
    const isMinusDisabled = item.quantity <= 1;
    const isChecked = selectedProductIds.has(item.product_id);

    let warningHtml = "";
    if (item.price_changed) {
      warningHtml += `<span class="cart-item-warning">Giá đã thay đổi từ ${formatMoney(item.old_price)}</span>`;
    }
    if (item.stock_warning) {
      warningHtml += `<span class="cart-item-warning danger">Số lượng vượt tồn kho hiện có (${item.stock_quantity})</span>`;
    }

    return `
      <article class="cart-item-row ${isChecked ? 'is-selected' : 'not-selected'} ${warningHtml ? 'has-warning' : ''}" data-item-id="${item.id}" data-product-id="${item.product_id}">
        <!-- Cột Checkbox tích chọn mua -->
        <div class="cart-item-check-col">
          <input type="checkbox"
                 class="cart-custom-checkbox cart-item-checkbox"
                 data-product-id="${item.product_id}"
                 ${isChecked ? "checked" : ""}
                 title="Tích chọn mua sản phẩm này"
                 aria-label="Chọn ${escapeHtml(item.name)} để thanh toán">
        </div>

        <!-- Thumbnail -->
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="cart-item-thumb" onerror="this.src='../assets/images/logo_shop.svg'">

        <!-- Tên, phân loại, đơn giá -->
        <div class="cart-item-info">
          ${item.variant ? `
            <div class="cart-item-variant">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
              ${escapeHtml(item.variant)}
            </div>
          ` : ""}
          <h4 class="cart-item-name">${escapeHtml(item.name)}</h4>
          <div class="cart-item-unit-price">
            Đơn giá: <b>${formatMoney(item.price)}</b>
          </div>
          ${warningHtml}
        </div>

        <!-- Bộ tăng giảm số lượng Pill oval -->
        <div class="quantity-controller">
          <button type="button" class="qty-btn btn-qty-minus" data-id="${item.id}" ${isMinusDisabled ? "disabled" : ""} aria-label="Giảm số lượng">−</button>
          <input type="text" class="qty-input" value="${item.quantity}" readonly data-id="${item.id}" aria-label="Số lượng sản phẩm">
          <button type="button" class="qty-btn btn-qty-plus" data-id="${item.id}" aria-label="Tăng số lượng">+</button>
        </div>

        <!-- Thành tiền & Icon thùng rác xóa -->
        <div class="cart-item-subtotal-box">
          <div class="cart-item-subtotal-text">
            <span class="cart-item-subtotal-label">Thành tiền</span>
            <span class="cart-item-subtotal-val">${formatMoney(itemSubtotal)}</span>
          </div>
          <button type="button" class="cart-item-delete-btn" data-id="${item.id}" title="Xóa khỏi giỏ hàng" aria-label="Xóa ${escapeHtml(item.name)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </article>
    `;
  }).join("");

  renderSummarySidebar();
  syncCartBadge(totalQty);
}

/**
 * Cập nhật Sidebar Tóm tắt đơn hàng bên phải DỰA TRÊN CÁC SẢN PHẨM ĐƯỢC TÍCH CHỌN
 */
function renderSummarySidebar() {
  const subtotalLabel = document.getElementById("subtotal-label");
  const subtotalVal = document.getElementById("subtotal-val");
  const shippingVal = document.getElementById("shipping-fee-val");
  const freeshipHint = document.getElementById("freeship-hint");
  const totalVal = document.getElementById("total-val");
  const btnPlaceOrder = document.getElementById("btn-place-order");
  const btnOrderText = document.getElementById("btn-order-text");

  // Lọc danh sách các mặt hàng đang được tích chọn
  const selectedItems = currentCartState.items.filter(it => selectedProductIds.has(it.product_id));
  const selectedLines = selectedItems.length;
  const selectedQty = selectedItems.reduce((s, it) => s + it.quantity, 0);

  // Tạm tính của các món được tích chọn
  const selectedSubtotal = selectedItems.reduce((s, it) => s + (it.price * it.quantity), 0);

  // Phí ship: >= 500k: 0đ; < 500k: 30k; nếu 0 món được chọn: 0đ
  let selectedShipping = 0;
  if (selectedLines > 0) {
    selectedShipping = selectedSubtotal >= 500000 ? 0 : 30000;
  }
  const selectedTotal = selectedSubtotal + selectedShipping;

  if (subtotalLabel) {
    subtotalLabel.textContent = `Tạm tính (${selectedQty} món)`;
  }
  if (subtotalVal) {
    subtotalVal.textContent = formatMoney(selectedSubtotal);
  }

  if (shippingVal) {
    if (selectedLines === 0 || selectedSubtotal === 0) {
      shippingVal.textContent = "0 ₫";
      shippingVal.className = "";
      shippingVal.style.color = "#64748b";
    } else if (selectedShipping === 0) {
      shippingVal.textContent = "0 ₫ (Miễn phí)";
      shippingVal.className = "free-badge";
      shippingVal.style.color = "#10b981";
    } else {
      shippingVal.textContent = formatMoney(selectedShipping);
      shippingVal.className = "";
      shippingVal.style.color = "#0f172a";
      shippingVal.style.fontWeight = "600";
    }
  }

  // Gợi ý freeship: đơn được chọn từ 500k được miễn phí ship
  if (freeshipHint) {
    if (selectedSubtotal > 0 && selectedSubtotal < 500000) {
      const remaining = 500000 - selectedSubtotal;
      freeshipHint.style.display = "block";
      freeshipHint.innerHTML = `
        ⚡ Mua thêm <b>${formatMoney(remaining)}</b> để được <b>Miễn phí giao hàng</b> toàn quốc!
      `;
    } else {
      freeshipHint.style.display = "none";
    }
  }

  if (totalVal) {
    totalVal.textContent = formatMoney(selectedTotal);
  }

  // Trạng thái nút Đặt hàng ngay
  if (btnPlaceOrder) {
    if (selectedLines === 0) {
      btnPlaceOrder.disabled = true;
      btnPlaceOrder.style.opacity = "0.6";
      btnPlaceOrder.style.cursor = "not-allowed";
      if (btnOrderText) btnOrderText.textContent = "Vui lòng chọn sản phẩm";
    } else {
      btnPlaceOrder.disabled = false;
      btnPlaceOrder.style.opacity = "1";
      btnPlaceOrder.style.cursor = "pointer";
      if (btnOrderText) btnOrderText.textContent = `Đặt hàng ngay (${selectedLines} món)`;
    }
  }
}

/**
 * Đồng bộ trạng thái Checkbox "Chọn tất cả" và Text tóm tắt số lượng đã chọn
 */
function syncSelectAllCheckboxUI() {
  const selectAllCheckbox = document.getElementById("select-all-checkbox");
  const selectAllLabelText = document.getElementById("select-all-label-text");
  const selectedSummaryCount = document.getElementById("selected-summary-count");
  const totalLines = currentCartState.items.length;
  const selectedCount = selectedProductIds.size;

  if (selectAllLabelText) {
    selectAllLabelText.textContent = `Chọn tất cả (${totalLines} sản phẩm)`;
  }

  if (selectedSummaryCount) {
    selectedSummaryCount.textContent = totalLines > 0
      ? `Đã chọn ${selectedCount}/${totalLines} món`
      : "";
  }

  if (selectAllCheckbox) {
    const isAll = totalLines > 0 && selectedCount === totalLines;
    selectAllCheckbox.checked = isAll;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalLines;
  }
}

/**
 * Cập nhật badge số lượng trên header đồng bộ với layout.js
 */
function syncCartBadge(qty) {
  const badge = document.getElementById("cart-count");
  const label = document.getElementById("cart-count-label");
  if (badge) badge.textContent = qty;
  if (label) label.textContent = `${qty} món`;
  if (typeof window.refreshCartCount === "function") {
    window.refreshCartCount();
  }
}

// ==========================================================
// 3. XỬ LÝ SỰ KIỆN TĂNG / GIẢM / XÓA SẢN PHẨM & TÍCH CHỌN CHECKBOX
// ==========================================================
function setupEventListeners() {
  const container = document.getElementById("cart-items-container");
  const selectAllCheckbox = document.getElementById("select-all-checkbox");

  // Sự kiện Checkbox "Chọn tất cả"
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      if (isChecked) {
        currentCartState.items.forEach(it => selectedProductIds.add(it.product_id));
      } else {
        selectedProductIds.clear();
      }

      // Cập nhật lại UI các checkbox hàng và style
      if (container) {
        const rowCheckboxes = container.querySelectorAll(".cart-item-checkbox");
        rowCheckboxes.forEach(cb => {
          cb.checked = isChecked;
          const row = cb.closest(".cart-item-row");
          if (row) {
            row.classList.toggle("is-selected", isChecked);
            row.classList.toggle("not-selected", !isChecked);
          }
        });
      }

      syncSelectAllCheckboxUI();
      renderSummarySidebar();
    });
  }

  if (container) {
    // Sự kiện Click nút Tăng/Giảm/Xóa
    container.addEventListener("click", async (e) => {
      // 1. Tăng số lượng (+)
      const plusBtn = e.target.closest(".btn-qty-plus");
      if (plusBtn) {
        const id = plusBtn.dataset.id;
        await changeItemQuantity(id, 1);
        return;
      }

      // 2. Giảm số lượng (−)
      const minusBtn = e.target.closest(".btn-qty-minus");
      if (minusBtn) {
        const id = minusBtn.dataset.id;
        await changeItemQuantity(id, -1);
        return;
      }

      // 3. Xóa sản phẩm khỏi giỏ
      const deleteBtn = e.target.closest(".cart-item-delete-btn");
      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        confirmDeleteItem(id);
        return;
      }
    });

    // Sự kiện Thay đổi trạng thái Checkbox từng sản phẩm
    container.addEventListener("change", (e) => {
      const itemCheck = e.target.closest(".cart-item-checkbox");
      if (itemCheck) {
        const productId = Number(itemCheck.dataset.productId);
        const isChecked = itemCheck.checked;

        if (isChecked) {
          selectedProductIds.add(productId);
        } else {
          selectedProductIds.delete(productId);
        }

        const row = itemCheck.closest(".cart-item-row");
        if (row) {
          row.classList.toggle("is-selected", isChecked);
          row.classList.toggle("not-selected", !isChecked);
        }

        syncSelectAllCheckboxUI();
        renderSummarySidebar();
      }
    });
  }

  // Sự kiện nút "Đặt hàng ngay"
  const btnPlaceOrder = document.getElementById("btn-place-order");
  if (btnPlaceOrder) {
    btnPlaceOrder.addEventListener("click", handlePlaceOrder);
  }

  // Sự kiện đóng modal đặt hàng thành công
  const modalCloseBtn = document.getElementById("modal-close-btn");
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
      document.getElementById("order-success-modal")?.classList.remove("active");
    });
  }
}

/**
 * Tăng / Giảm số lượng
 */
async function changeItemQuantity(itemId, delta) {
  const item = currentCartState.items.find(x => String(x.id) === String(itemId));
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty < 1) return;

  // Kiểm tra tồn kho nếu biết
  if (delta > 0 && item.stock_quantity && newQty > item.stock_quantity) {
    if (typeof showToast === "function") {
      showToast(`Rất tiếc! Số lượng vượt quá tồn kho hiện có (${item.stock_quantity} sản phẩm)`, "warning");
    } else {
      alert(`Số lượng vượt quá tồn kho hiện có (${item.stock_quantity})`);
    }
    return;
  }

  // A. Nếu kết nối Backend API
  if (currentCartState.isBackend && typeof api !== "undefined" && api.put) {
    try {
      const targetProductId = item.product_id || item.id;
      await api.put(`/cart/items/${targetProductId}`, { quantity: newQty });
      await loadCartData();
      return;
    } catch (err) {
      const msg = err.message || "Không thể cập nhật số lượng";
      if (typeof showToast === "function") showToast(msg, "error");
      else alert(msg);
      return;
    }
  }

  // B. Chế độ Demo Cục bộ
  item.quantity = newQty;
  saveDemoCart();
  recalculateState();
  renderCart();
}

/**
 * Xác nhận xóa sản phẩm
 */
function confirmDeleteItem(itemId) {
  const item = currentCartState.items.find(x => String(x.id) === String(itemId));
  if (!item) return;

  if (typeof showConfirmModal === "function") {
    showConfirmModal({
      title: "Xóa sản phẩm khỏi giỏ",
      message: `Bạn có chắc muốn bỏ sản phẩm "${item.name}" ra khỏi giỏ hàng?`,
      confirmText: "Xóa sản phẩm",
      cancelText: "Giữ lại",
      type: "danger",
      onConfirm: async () => {
        await executeDeleteItem(itemId, item.name);
      }
    });
  } else {
    if (confirm(`Bạn có chắc muốn bỏ "${item.name}" ra khỏi giỏ hàng?`)) {
      executeDeleteItem(itemId, item.name);
    }
  }
}

/**
 * Thực thi xóa sản phẩm khỏi giỏ hàng
 */
async function executeDeleteItem(itemId, itemName) {
  const item = currentCartState.items.find(x => String(x.id) === String(itemId));
  const targetProductId = item?.product_id || itemId;

  // Xóa khỏi tập hợp đã chọn nếu có
  selectedProductIds.delete(Number(targetProductId));

  // A. Backend API
  if (currentCartState.isBackend && typeof api !== "undefined" && api.delete) {
    try {
      await api.delete(`/cart/items/${targetProductId}`);
      if (typeof showToast === "function") {
        showToast(`Đã xóa "${itemName}" khỏi giỏ hàng`, "success");
      }
      await loadCartData();
      return;
    } catch (err) {
      const msg = err.message || "Không thể xóa sản phẩm";
      if (typeof showToast === "function") showToast(msg, "error");
      else alert(msg);
      return;
    }
  }

  // B. Demo Cục bộ
  currentCartState.items = currentCartState.items.filter(x => String(x.id) !== String(itemId));
  saveDemoCart();
  recalculateState();
  renderCart();

  if (typeof showToast === "function") {
    showToast(`Đã xóa "${itemName}" khỏi giỏ hàng`, "success");
  }
}

/**
 * Lưu giỏ hàng demo vào localStorage
 */
function saveDemoCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(currentCartState.items));
}

/**
 * Tính toán lại tổng tiền trong bộ nhớ demo
 */
function recalculateState() {
  const subtotal = currentCartState.items.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  let shipping_fee = 0;
  if (currentCartState.items.length > 0) {
    shipping_fee = subtotal >= 500000 ? 0 : 30000;
  }
  currentCartState.subtotal = subtotal;
  currentCartState.shipping_fee = shipping_fee;
  currentCartState.total_amount = subtotal + shipping_fee;
}

// ==========================================================
// 4. FORM THÔNG TIN NHẬN HÀNG (SHIPPING FORM & DEFAULT ADDRESS)
// ==========================================================
// Dữ liệu địa chỉ nhận hàng hiện tại
let currentShippingData = {
  name: "Nguyễn Văn An",
  phone: "0912345678",
  address: "124 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
  isDefault: true
};

/**
 * Tự động lấy thông tin đăng ký của khách hàng làm mặc định cho mọi đơn hàng,
 * đồng bộ với Sổ địa chỉ (Address book) nếu có, và thiết lập tương tác nút Sửa địa chỉ.
 */
async function initShippingFormAutofill() {
  const nameInput = document.getElementById("shipping-name");
  const phoneInput = document.getElementById("shipping-phone");
  const addressInput = document.getElementById("shipping-address");
  const noteInput = document.getElementById("shipping-note");

  const previewName = document.getElementById("preview-recipient-name");
  const previewPhone = document.getElementById("preview-recipient-phone");
  const previewAddress = document.getElementById("preview-recipient-address");
  const previewBadge = document.getElementById("preview-default-badge");

  const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
  let user = typeof Auth !== "undefined" ? Auth.getUser() : null;
  const savedInfo = JSON.parse(localStorage.getItem(SHIPPING_INFO_KEY) || "{}");

  let defaultName = savedInfo.name || "Nguyễn Văn An";
  let defaultPhone = savedInfo.phone || "0912345678";
  let defaultAddress = savedInfo.address || "124 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh";
  let isDefaultAddr = true;

  // 1. Nếu đã đăng nhập: lấy thông tin tài khoản đăng ký và sổ địa chỉ từ API
  if (token && typeof api !== "undefined" && api.get) {
    try {
      // A. Lấy thông tin tài khoản /auth/me
      if (!user || !user.full_name) {
        try {
          user = await api.get("/auth/me");
          if (user) localStorage.setItem("user", JSON.stringify(user));
        } catch (_) {}
      }

      if (user) {
        defaultName = user.full_name || defaultName;
        defaultPhone = user.phone || user.phone_number || defaultPhone;
      }

      // B. Lấy sổ địa chỉ của tài khoản để tìm địa chỉ mặc định
      try {
        const addrList = await api.get("/auth/me/addresses");
        const addresses = Array.isArray(addrList) ? addrList : (addrList?.data || []);
        if (Array.isArray(addresses) && addresses.length > 0) {
          // Ưu tiên địa chỉ có is_default === 1, nếu không thì lấy địa chỉ đầu tiên
          const defaultAddr = addresses.find(a => a.is_default === 1 || a.is_default === true) || addresses[0];
          if (defaultAddr) {
            defaultName = defaultAddr.receiver_name || defaultName;
            defaultPhone = defaultAddr.phone || defaultPhone;
            const fullAddr = [defaultAddr.street_detail, defaultAddr.ward, defaultAddr.province]
              .filter(Boolean)
              .join(", ");
            if (fullAddr) defaultAddress = fullAddr;
          }
        }
      } catch (errAddr) {
        console.warn("Chưa tải được sổ địa chỉ từ API, sử dụng địa chỉ hồ sơ:", errAddr);
      }
    } catch (errUser) {
      console.warn("Lỗi đồng bộ hồ sơ người dùng:", errUser);
    }
  } else if (user) {
    // Nếu có thông tin user trong localStorage
    defaultName = user.full_name || defaultName;
    defaultPhone = user.phone || user.phone_number || defaultPhone;
    if (user.address) defaultAddress = user.address;
  }

  // Cập nhật state địa chỉ hiện tại
  currentShippingData = {
    name: defaultName,
    phone: defaultPhone,
    address: defaultAddress,
    isDefault: isDefaultAddr
  };

  // 2. Điền thông tin vào Khối Xem Trước (Preview Card)
  if (previewName) previewName.textContent = defaultName;
  if (previewPhone) previewPhone.textContent = defaultPhone;
  if (previewAddress) previewAddress.textContent = defaultAddress;
  if (previewBadge) previewBadge.style.display = isDefaultAddr ? "inline-flex" : "none";

  // 3. Điền sẵn vào các ô input trong Form chỉnh sửa
  if (nameInput) nameInput.value = defaultName;
  if (phoneInput) {
    phoneInput.value = defaultPhone;
    validatePhone(defaultPhone);
  }
  if (addressInput) addressInput.value = defaultAddress;
  if (noteInput && savedInfo.note) {
    noteInput.value = savedInfo.note;
  } else if (noteInput && !noteInput.value) {
    noteInput.value = "Giao trong giờ hành chính, vui lòng gọi trước khi tới";
  }

  // 4. Thiết lập sự kiện nút Sửa / Thay đổi địa chỉ
  setupShippingAddressActions();
}

/**
 * Quản lý tương tác: Mở / Đóng hộp sửa địa chỉ và Xác nhận thay đổi
 */
function setupShippingAddressActions() {
  const btnChangeAddress = document.getElementById("btn-change-address");
  const btnChangeText = document.getElementById("btn-change-address-text");
  const editCard = document.getElementById("shipping-edit-card");
  const btnCloseEdit = document.getElementById("btn-close-edit-shipping");
  const btnCancelEdit = document.getElementById("btn-cancel-address-change");
  const btnSaveEdit = document.getElementById("btn-save-address-change");
  const saveDefaultCheckbox = document.getElementById("save-as-default-checkbox");

  const nameInput = document.getElementById("shipping-name");
  const phoneInput = document.getElementById("shipping-phone");
  const addressInput = document.getElementById("shipping-address");

  const previewName = document.getElementById("preview-recipient-name");
  const previewPhone = document.getElementById("preview-recipient-phone");
  const previewAddress = document.getElementById("preview-recipient-address");
  const previewBadge = document.getElementById("preview-default-badge");

  if (!btnChangeAddress || !editCard) return;

  // 1. Click nút "Thay đổi địa chỉ" -> Toggle hộp chỉnh sửa
  btnChangeAddress.addEventListener("click", () => {
    const isHidden = editCard.style.display === "none" || !editCard.style.display;
    if (isHidden) {
      // Đổ lại giá trị hiện tại vào input trước khi sửa
      if (nameInput) nameInput.value = currentShippingData.name;
      if (phoneInput) {
        phoneInput.value = currentShippingData.phone;
        validatePhone(currentShippingData.phone);
      }
      if (addressInput) addressInput.value = currentShippingData.address;

      clearShippingErrors();
      editCard.style.display = "block";
      btnChangeAddress.classList.add("is-editing");
      if (btnChangeText) btnChangeText.textContent = "Đóng chỉnh sửa";
      setTimeout(() => nameInput?.focus(), 100);
    } else {
      closeShippingEdit();
    }
  });

  // 2. Click nút đóng hoặc Hủy bỏ
  function closeShippingEdit() {
    editCard.style.display = "none";
    btnChangeAddress.classList.remove("is-editing");
    if (btnChangeText) btnChangeText.textContent = "Thay đổi địa chỉ";
    clearShippingErrors();

    // Khôi phục lại input theo currentShippingData
    if (nameInput) nameInput.value = currentShippingData.name;
    if (phoneInput) {
      phoneInput.value = currentShippingData.phone;
      validatePhone(currentShippingData.phone);
    }
    if (addressInput) addressInput.value = currentShippingData.address;
  }

  if (btnCloseEdit) btnCloseEdit.addEventListener("click", closeShippingEdit);
  if (btnCancelEdit) btnCancelEdit.addEventListener("click", closeShippingEdit);

  // 3. Click nút "Xác nhận địa chỉ"
  if (btnSaveEdit) {
    btnSaveEdit.addEventListener("click", async () => {
      if (!validateShippingForm()) {
        if (typeof showToast === "function") {
          showToast("Vui lòng kiểm tra lại thông tin người nhận và địa chỉ", "error");
        }
        return;
      }

      const newName = nameInput?.value.trim() || "";
      const newPhone = phoneInput?.value.trim() || "";
      const newAddress = addressInput?.value.trim() || "";
      const isSaveDefault = saveDefaultCheckbox ? saveDefaultCheckbox.checked : true;

      // Cập nhật state
      currentShippingData = {
        name: newName,
        phone: newPhone,
        address: newAddress,
        isDefault: isSaveDefault
      };

      // Cập nhật giao diện Preview
      if (previewName) previewName.textContent = newName;
      if (previewPhone) previewPhone.textContent = newPhone;
      if (previewAddress) previewAddress.textContent = newAddress;
      if (previewBadge) {
        previewBadge.style.display = isSaveDefault ? "inline-flex" : "none";
      }

      // Lưu vào localStorage
      const noteVal = document.getElementById("shipping-note")?.value.trim() || "";
      localStorage.setItem(SHIPPING_INFO_KEY, JSON.stringify({
        name: newName,
        phone: newPhone,
        address: newAddress,
        note: noteVal,
        is_default: isSaveDefault
      }));

      // Nếu có token đăng nhập và tích chọn lưu làm mặc định, gọi API Backend thêm vào sổ địa chỉ
      const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
      if (isSaveDefault && token && typeof api !== "undefined" && api.post) {
        try {
          await api.post("/auth/me/addresses", {
            receiver_name: newName,
            phone: newPhone,
            province: "TP. Hồ Chí Minh",
            ward: "Quận 1",
            street_detail: newAddress,
            is_default: 1
          });
        } catch (errApi) {
          console.warn("Chưa đồng bộ được địa chỉ mới lên API backend:", errApi);
        }
      }

      // Đóng hộp chỉnh sửa
      editCard.style.display = "none";
      btnChangeAddress.classList.remove("is-editing");
      if (btnChangeText) btnChangeText.textContent = "Thay đổi địa chỉ";

      if (typeof showToast === "function") {
        if (isSaveDefault) {
          showToast("Đã cập nhật và lưu làm địa chỉ nhận hàng mặc định!", "success");
        } else {
          showToast("Đã cập nhật địa chỉ giao hàng cho đơn hàng này!", "success");
        }
      }
    });
  }
}

/**
 * Xóa thông báo lỗi form
 */
function clearShippingErrors() {
  const nameError = document.getElementById("name-error");
  const phoneError = document.getElementById("phone-error");
  const addressError = document.getElementById("address-error");

  const nameInput = document.getElementById("shipping-name");
  const phoneInput = document.getElementById("shipping-phone");
  const addressInput = document.getElementById("shipping-address");

  if (nameError) nameError.textContent = "";
  if (phoneError) phoneError.textContent = "";
  if (addressError) addressError.textContent = "";

  nameInput?.classList.remove("is-invalid");
  phoneInput?.classList.remove("is-invalid");
  addressInput?.classList.remove("is-invalid");
}

/**
 * Kiểm tra số điện thoại người nhận theo BR-19 (10 số, bắt đầu bằng 0)
 * Hiển thị icon tick xanh chuẩn Figma khi hợp lệ
 */
function setupPhoneValidation() {
  const phoneInput = document.getElementById("shipping-phone");
  if (!phoneInput) return;

  phoneInput.addEventListener("input", (e) => {
    // Chỉ cho phép nhập chữ số
    phoneInput.value = phoneInput.value.replace(/\D/g, "");
    validatePhone(phoneInput.value);
  });
}

function validatePhone(phone) {
  const phoneRegex = /^0\d{9}$/;
  const validIcon = document.getElementById("phone-valid-icon");
  const errorMsg = document.getElementById("phone-error");
  const phoneInput = document.getElementById("shipping-phone");

  const isValid = phoneRegex.test((phone || "").trim());

  if (validIcon) {
    if (isValid) {
      validIcon.classList.add("valid");
    } else {
      validIcon.classList.remove("valid");
    }
  }

  if (phoneInput) {
    if (phone.length >= 10 && !isValid) {
      phoneInput.classList.add("is-invalid");
      if (errorMsg) errorMsg.textContent = "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0 (BR-19)";
    } else {
      phoneInput.classList.remove("is-invalid");
      if (errorMsg) errorMsg.textContent = "";
    }
  }

  return isValid;
}

/**
 * Validate toàn bộ form trước khi gửi đơn hàng
 */
function validateShippingForm() {
  const nameInput = document.getElementById("shipping-name");
  const phoneInput = document.getElementById("shipping-phone");
  const addressInput = document.getElementById("shipping-address");

  const nameError = document.getElementById("name-error");
  const phoneError = document.getElementById("phone-error");
  const addressError = document.getElementById("address-error");

  let isValid = true;

  // 1. Tên người nhận
  const nameVal = (nameInput?.value || "").trim();
  if (!nameVal || nameVal.length < 2) {
    if (nameError) nameError.textContent = "Vui lòng nhập họ và tên người nhận";
    nameInput?.classList.add("is-invalid");
    isValid = false;
  } else {
    if (nameError) nameError.textContent = "";
    nameInput?.classList.remove("is-invalid");
  }

  // 2. Số điện thoại (BR-19)
  const phoneVal = (phoneInput?.value || "").trim();
  if (!validatePhone(phoneVal)) {
    if (phoneError) phoneError.textContent = "Số điện thoại phải đủ 10 chữ số và bắt đầu bằng số 0 (Ví dụ: 0912345678)";
    phoneInput?.classList.add("is-invalid");
    isValid = false;
  } else {
    if (phoneError) phoneError.textContent = "";
    phoneInput?.classList.remove("is-invalid");
  }

  // 3. Địa chỉ
  const addressVal = (addressInput?.value || "").trim();
  if (!addressVal || addressVal.length < 5) {
    if (addressError) addressError.textContent = "Vui lòng nhập địa chỉ giao hàng cụ thể";
    addressInput?.classList.add("is-invalid");
    isValid = false;
  } else {
    if (addressError) addressError.textContent = "";
    addressInput?.classList.remove("is-invalid");
  }

  return isValid;
}

// ==========================================================
// 5. ĐẶT HÀNG TRANSACTION (CHECKOUT / ORDER SUBMISSION)
// ==========================================================
async function handlePlaceOrder() {
  if (currentCartState.items.length === 0) {
    if (typeof showToast === "function") {
      showToast("Giỏ hàng của bạn đang trống! Vui lòng chọn sản phẩm.", "warning");
    } else {
      alert("Giỏ hàng của bạn đang trống!");
    }
    return;
  }

  // Kiểm tra đã tích chọn ít nhất 1 sản phẩm chưa
  if (selectedProductIds.size === 0) {
    if (typeof showToast === "function") {
      showToast("Vui lòng tích chọn ít nhất một sản phẩm để tiến hành đặt hàng!", "warning");
    } else {
      alert("Vui lòng tích chọn ít nhất một sản phẩm để tiến hành đặt hàng!");
    }
    return;
  }

  if (!validateShippingForm()) {
    if (typeof showToast === "function") {
      showToast("Vui lòng kiểm tra và hoàn thiện thông tin nhận hàng", "error");
    }
    return;
  }

  const name = document.getElementById("shipping-name")?.value.trim();
  const phone = document.getElementById("shipping-phone")?.value.trim();
  const address = document.getElementById("shipping-address")?.value.trim();
  const note = document.getElementById("shipping-note")?.value.trim() || "";

  // Lưu lại thông tin giao hàng cho các lần sau
  localStorage.setItem(SHIPPING_INFO_KEY, JSON.stringify({ name, phone, address, note }));

  const btnPlaceOrder = document.getElementById("btn-place-order");
  const btnOrderText = document.getElementById("btn-order-text");

  // Hiển thị loading
  if (btnPlaceOrder) btnPlaceOrder.disabled = true;
  if (btnOrderText) btnOrderText.textContent = "Đang xử lý đặt hàng...";

  const selectedList = Array.from(selectedProductIds);

  const orderPayload = {
    receiver_name: name,
    receiver_phone: phone,
    shipping_address: address,
    note: note,
    payment_method: "COD",
    selected_product_ids: selectedList
  };

  try {
    let orderResult = null;

    // A. Backend API nếu đang online / có token
    if (currentCartState.isBackend && typeof api !== "undefined" && api.post) {
      orderResult = await api.post("/orders", orderPayload);

      // Cập nhật trạng thái Stepper sang Bước 3 Hoàn tất
      setStepperCompleted();

      // Hiển thị modal đặt hàng thành công
      showOrderSuccessModal(orderResult, name, phone, address);

      // Xóa các ID đã đặt khỏi selectedProductIds
      selectedProductIds.clear();

      // Tự động tải lại giỏ hàng từ Backend (Backend chỉ xóa các món đã đặt, các món chưa chọn vẫn còn nguyên vẹn!)
      await loadCartData();

      if (typeof showToast === "function") {
        showToast(`Đặt hàng thành công đơn hàng ${orderResult.order_code || ""}! Các món chưa chọn vẫn được lưu trong giỏ.`, "success");
      }
    } else {
      // B. Giả lập Chế độ Demo Cục bộ (Local Fallback)
      await new Promise(r => setTimeout(r, 450));

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const generatedOrderCode = `SE-${dateStr}-${randomCode}`;

      // Danh sách các món được đặt và các món còn lại trong giỏ
      const orderedItems = currentCartState.items.filter(it => selectedProductIds.has(it.product_id));
      const remainingItems = currentCartState.items.filter(it => !selectedProductIds.has(it.product_id));

      const orderedSubtotal = orderedItems.reduce((s, it) => s + (it.price * it.quantity), 0);
      const orderedShipping = orderedSubtotal >= 500000 ? 0 : 30000;
      const orderedTotal = orderedSubtotal + orderedShipping;

      orderResult = {
        order_code: generatedOrderCode,
        shipping_name: name,
        shipping_phone: phone,
        shipping_address: address,
        total_amount: orderedTotal,
        items: orderedItems,
        created_at: now.toISOString()
      };

      // 1. Lưu vào danh sách đơn demo
      const savedOrders = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || "[]");
      savedOrders.unshift(orderResult);
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(savedOrders));

      // 2. Chỉ lưu lại các sản phẩm CHƯA ĐƯỢC CHỌN trong giỏ hàng
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(remainingItems));

      // 3. Cập nhật state giỏ hàng hiện tại với các món còn lại
      currentCartState.items = remainingItems;
      selectedProductIds = new Set(remainingItems.map(it => it.product_id));
      recalculateState();
      renderCart();

      // 4. Cập nhật trạng thái Stepper sang Bước 3 Hoàn tất
      setStepperCompleted();

      // 5. Hiển thị modal đặt hàng thành công
      showOrderSuccessModal(orderResult, name, phone, address);

      if (typeof showToast === "function") {
        if (remainingItems.length > 0) {
          showToast(`Đặt hàng thành công ${orderedItems.length} món! ${remainingItems.length} sản phẩm chưa chọn vẫn được lưu trong giỏ hàng.`, "success");
        } else {
          showToast("Đặt hàng thành công tất cả sản phẩm!", "success");
        }
      }
    }

  } catch (err) {
    const errorMsg = err.message || "Đặt hàng thất bại. Vui lòng thử lại sau.";
    if (typeof showToast === "function") {
      showToast(errorMsg, "error");
    } else {
      alert(errorMsg);
    }
  } finally {
    if (btnPlaceOrder) btnPlaceOrder.disabled = false;
    if (btnOrderText) {
      const selectedCount = selectedProductIds.size;
      btnOrderText.textContent = selectedCount > 0 ? `Đặt hàng ngay (${selectedCount} món)` : "Đặt hàng ngay";
    }
  }
}

/**
 * Cập nhật thanh Stepper sang Bước 3 (Hoàn tất)
 */
function setStepperCompleted() {
  const step2 = document.getElementById("step-2");
  const step3 = document.getElementById("step-3");
  const line23 = document.getElementById("line-2-3");

  if (step2) {
    step2.classList.remove("active");
    step2.classList.add("completed");
  }
  if (line23) {
    line23.classList.add("active");
  }
  if (step3) {
    step3.classList.remove("pending");
    step3.classList.add("completed");
    const circle = step3.querySelector(".stepper-circle");
    if (circle) {
      circle.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
    }
  }
}

/**
 * Hiển thị Modal Đặt hàng thành công
 */
function showOrderSuccessModal(order, name, phone, address) {
  const modal = document.getElementById("order-success-modal");
  if (!modal) return;

  const codeElem = document.getElementById("modal-order-code");
  const nameElem = document.getElementById("modal-recipient-name");
  const phoneElem = document.getElementById("modal-recipient-phone");
  const addressElem = document.getElementById("modal-recipient-address");
  const totalElem = document.getElementById("modal-total-amount");

  const orderCode = order.order_code || order.code || "SE-20261120-8888";
  const total = order.total_amount || currentCartState.total_amount || 0;

  if (codeElem) codeElem.textContent = orderCode;
  if (nameElem) nameElem.textContent = name;
  if (phoneElem) phoneElem.textContent = phone;
  if (addressElem) {
    addressElem.textContent = address;
    addressElem.title = address;
  }
  if (totalElem) totalElem.textContent = formatMoney(total);

  modal.classList.add("active");
}
