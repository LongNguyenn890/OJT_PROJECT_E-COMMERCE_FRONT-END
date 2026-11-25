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
let userAddressBook = [];
let isShippingActionsSetup = false;
let isSavingAddress = false;


// Cấu hình tài khoản ngân hàng nhận thanh toán Chuyển khoản VietQR
const BANK_ACCOUNT_CONFIG = {
  bankName: "Techcombank",
  bankFullName: "Ngân hàng TMCP Kỹ Thương Việt Nam",
  accountName: "NGUYEN QUANG MINH",
  accountNumber: "19075419390012",
  accountNumberFormatted: "1907 5419 3900 12",
  bankBin: "970407", // Mã BIN Techcombank Napas 247
  localQrSquare: "../assets/images/qr_techcombank_square.png", // Mã QR ma trận vuông đã crop gọn
  localQrCard: "../assets/images/qr_techcombank_card_clean.png" // Thẻ QR Techcombank sạch đẹp
};

// Quản lý phiên đếm ngược và đơn hàng đang chờ thanh toán QR
let qrCountdownInterval = null;
let currentPendingQrOrder = null;

// Quản lý voucher giảm giá (Chỉ dùng voucher người dùng đã đổi bằng điểm thưởng)
let appliedVoucher = null;
let userVouchersList = [];
let userRewardPoints = 0;

/**
 * Đồng bộ danh sách selectedProductIds với các sản phẩm hiện có trong giỏ
 */
function initSelectedProductIds(items) {
  if (!items || items.length === 0) {
    selectedProductIds.clear();
    return;
  }
  const currentIds = new Set(items.map(it => it.product_id));

  // Kiểm tra cờ "Mua ngay" từ URL query param hoặc sessionStorage
  const urlParams = new URLSearchParams(window.location.search);
  const buyNowParam = urlParams.get("buy_now") || sessionStorage.getItem("buy_now_product_id");
  const buyNowQtyParam = urlParams.get("buy_qty") || sessionStorage.getItem("buy_now_qty");

  if (buyNowParam) {
    const buyNowId = Number(buyNowParam);
    if (currentIds.has(buyNowId)) {
      // 1. CHỈ TÍCH DUY NHẤT SẢN PHẨM MUA NGAY (không tích các sản phẩm khác đang có trong giỏ)
      selectedProductIds.clear();
      selectedProductIds.add(buyNowId);

      // 2. Đảm bảo số lượng sản phẩm mua ngay khớp chính xác số lượng khách đã chọn trên trang chi tiết
      if (buyNowQtyParam) {
        const targetQty = Number(buyNowQtyParam);
        const targetItem = items.find(it => it.product_id === buyNowId);
        if (targetItem && targetQty > 0 && targetItem.quantity !== targetQty) {
          targetItem.quantity = targetQty;
          // Đồng bộ ngầm lên backend nếu đang online
          if (currentCartState.isBackend && typeof api !== "undefined" && api.put) {
            api.put(`/cart/items/${buyNowId}`, { quantity: targetQty }).catch(e => console.warn(e));
          }
        }
      }

      // 3. Xóa cờ khỏi sessionStorage và làm sạch URL để F5 hoặc thao tác lại không bị kẹt cờ
      sessionStorage.removeItem("buy_now_product_id");
      sessionStorage.removeItem("buy_now_qty");
      if (urlParams.has("buy_now") || urlParams.has("buy_qty")) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      if (typeof showToast === "function") {
        setTimeout(() => {
          showToast("Đã chọn đúng sản phẩm bạn muốn Mua ngay để thanh toán!", "info");
        }, 300);
      }
      return;
    }
  }

  // Kiểm tra cờ "Mua lại sản phẩm" từ sessionStorage hoặc URL
  const reorderParam = urlParams.get("reorder_ids") || sessionStorage.getItem("reorder_product_ids");
  if (reorderParam) {
    let targetIds = [];
    try {
      targetIds = typeof reorderParam === "string" && reorderParam.trim().startsWith("[")
        ? JSON.parse(reorderParam)
        : String(reorderParam).split(",").map(id => Number(id.trim())).filter(Boolean);
    } catch (_) {
      targetIds = String(reorderParam).split(",").map(id => Number(id.trim())).filter(Boolean);
    }

    if (Array.isArray(targetIds) && targetIds.length > 0) {
      selectedProductIds.clear();
      let matchedCount = 0;
      targetIds.forEach(id => {
        const numId = Number(id);
        if (currentIds.has(numId)) {
          selectedProductIds.add(numId);
          matchedCount++;
        }
      });

      // Dọn dẹp cờ lưu trữ
      sessionStorage.removeItem("reorder_product_ids");
      if (urlParams.has("reorder_ids")) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      if (matchedCount > 0 && typeof showToast === "function") {
        setTimeout(() => {
          showToast(`Đã tự động chọn ${matchedCount} sản phẩm mua lại để bạn sẵn sàng thanh toán!`, "success");
        }, 300);
      }
      return;
    }
  }

  // MẶC ĐỊNH KHI BẤM VÀO GIỎ HÀNG: CHƯA CHỌN SẢN PHẨM NÀO
  // Nếu người dùng đã tích chọn thủ công trong phiên làm việc hiện tại, chỉ giữ lại các sản phẩm còn tồn tại
  if (selectedProductIds.size > 0) {
    for (const id of Array.from(selectedProductIds)) {
      if (!currentIds.has(id)) {
        selectedProductIds.delete(id);
      }
    }
  }
}

// ==========================================================
// 1. KHỞI TẠO VÀ TẢI DỮ LIỆU GIỎ HÀNG
// ==========================================================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    setupPhoneValidation();
    setupEventListeners();
  } catch (err) {
    console.warn("Lỗi thiết lập sự kiện giỏ hàng:", err);
  }

  // Luôn tải và hiển thị danh sách sản phẩm trước tiên để tránh kẹt loading
  try {
    await loadCartData();
  } catch (err) {
    console.error("Lỗi nạp dữ liệu giỏ hàng:", err);
  }

  // Khởi tạo thông tin giao hàng & kiểm tra trạng thái chặn đặt hàng
  try {
    await initShippingFormAutofill();
  } catch (err) {
    console.warn("Lỗi nạp thông tin giao hàng:", err);
  }

  // Tải danh sách voucher
  try {
    await loadUserVouchers();
  } catch (err) {
    console.warn("Lỗi nạp voucher:", err);
  }
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
    const hasPromo = productInfo.promotional_price !== null &&
                     productInfo.promotional_price !== undefined &&
                     Number(productInfo.promotional_price) >= 0 &&
                     Number(productInfo.promotional_price) < Number(productInfo.price);
    const effectivePrice = hasPromo ? Number(productInfo.promotional_price) : Number(productInfo.price || 0);
    const originalPrice = Number(productInfo.price || 0);

    return {
      id: item.id || productInfo.product_id || productInfo.id,
      product_id: productInfo.product_id || productInfo.id || item.id,
      name: productInfo.name || "Sản phẩm",
      variant: item.variant || productInfo.variant || (productInfo.tag ? `Phân loại: ${productInfo.tag}` : "Chính hãng"),
      price: effectivePrice,
      original_price: originalPrice,
      has_promo: hasPromo,
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

  // 1. Render Cảnh báo (chỉ cảnh báo tồn kho, không hiển thị khi cập nhật giá)
  if (warningsContainer) {
    const validWarnings = (currentCartState.warnings || []).filter(w => !w.toLowerCase().includes("giá sản phẩm"));
    if (validWarnings.length > 0) {
      warningsContainer.innerHTML = `
        <div class="cart-global-warnings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" style="flex-shrink:0; margin-top:2px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <strong>Thông báo cập nhật giỏ hàng:</strong>
            <ul>
              ${validWarnings.map(w => `<li>${escapeHtml(w)}</li>`).join("")}
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
    // Không hiển thị cảnh báo thay đổi giá trên từng món hàng
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
            Đơn giá: <strong class="price-current" style="font-weight: 800; color: #00288e;">${formatMoney(item.price)}</strong>
            ${item.has_promo ? `<del class="cart-item-old-price" style="font-size: 11.5px; color: #94a3b8; text-decoration: line-through; margin-left: 6px; font-weight: 400;">${formatMoney(item.original_price)}</del>` : ""}
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

  // Tính giảm giá từ Voucher đã áp dụng
  let actualDiscount = 0;
  if (appliedVoucher && selectedLines > 0) {
    if (selectedSubtotal >= (appliedVoucher.min_order_value || 0)) {
      if (appliedVoucher.type === "freeship") {
        actualDiscount = Math.min(selectedShipping, appliedVoucher.discount_amount || 30000);
      } else if (appliedVoucher.type === "percent") {
        const pctDiscount = Math.round(selectedSubtotal * ((appliedVoucher.percent || 0) / 100));
        if (appliedVoucher.max_discount && appliedVoucher.max_discount > 0) {
          actualDiscount = Math.min(appliedVoucher.max_discount, pctDiscount);
        } else {
          actualDiscount = pctDiscount;
        }
      } else {
        actualDiscount = Math.min(selectedSubtotal, appliedVoucher.discount_amount || 0);
      }
    }
  }

  const selectedTotal = Math.max(0, selectedSubtotal + selectedShipping - actualDiscount);

  // Cập nhật thông số tính toán vào currentCartState
  currentCartState.subtotal = selectedSubtotal;
  currentCartState.shipping_fee = selectedShipping;
  currentCartState.discount_amount = actualDiscount;
  currentCartState.total_amount = selectedTotal;

  // Cập nhật dòng Giảm giá voucher trong bảng tóm tắt
  const discountRow = document.getElementById("summary-discount-row");
  const discountVoucherCode = document.getElementById("discount-voucher-code");
  const discountVal = document.getElementById("discount-val");
  if (discountRow) {
    if (actualDiscount > 0 && appliedVoucher) {
      discountRow.style.display = "flex";
      if (discountVoucherCode) {
        discountVoucherCode.textContent = appliedVoucher.code;
        discountVoucherCode.title = `Mã voucher: ${appliedVoucher.code}`;
      }
      if (discountVal) discountVal.textContent = `-${formatMoney(actualDiscount)}`;
    } else {
      discountRow.style.display = "none";
    }
  }

  // Đồng bộ giao diện Khối Voucher ngay trên nút Đặt hàng
  syncVoucherSectionUI(selectedSubtotal, actualDiscount);

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
    const isBank = document.getElementById("payment-radio-bank")?.checked;
    const hasShipping = typeof isShippingComplete === "function" ? isShippingComplete() : false;
    const noAddressHint = document.getElementById("cart-no-address-hint");

    if (selectedLines === 0) {
      // 1. Chưa chọn sản phẩm nào: Chặn nút đặt hàng
      btnPlaceOrder.disabled = true;
      btnPlaceOrder.style.opacity = "0.55";
      btnPlaceOrder.style.cursor = "not-allowed";
      btnPlaceOrder.style.backgroundColor = "";
      btnPlaceOrder.title = "Vui lòng tích chọn ít nhất 1 sản phẩm để đặt hàng";
      if (btnOrderText) btnOrderText.textContent = "Vui lòng chọn sản phẩm";
      if (noAddressHint) noAddressHint.style.display = "none";
    } else if (!hasShipping) {
      // 2. Vẫn hiển thị sản phẩm bình thường nhưng CHẶN NÚT ĐẶT HÀNG khi chưa có địa chỉ/người nhận
      btnPlaceOrder.disabled = true;
      btnPlaceOrder.style.opacity = "0.55";
      btnPlaceOrder.style.cursor = "not-allowed";
      btnPlaceOrder.style.backgroundColor = "#94a3b8";
      btnPlaceOrder.title = "Vui lòng nhập địa chỉ và thông tin người nhận ở cột bên trái để kích hoạt đặt hàng";
      if (btnOrderText) {
        btnOrderText.textContent = `Chưa có địa chỉ (${selectedLines} món)`;
      }
      if (noAddressHint) {
        noAddressHint.style.display = "block";
      }
    } else {
      // 3. Đã có địa chỉ và đã chọn sản phẩm: Mở khóa nút đặt hàng
      btnPlaceOrder.disabled = false;
      btnPlaceOrder.style.opacity = "1";
      btnPlaceOrder.style.cursor = "pointer";
      btnPlaceOrder.style.backgroundColor = "";
      btnPlaceOrder.title = "";
      if (btnOrderText) {
        btnOrderText.textContent = isBank
          ? `Thanh toán chuyển khoản QR (${selectedLines} món)`
          : `Đặt hàng ngay (${selectedLines} món)`;
      }
      if (noAddressHint) {
        noAddressHint.style.display = "none";
      }
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

  // Sự kiện nút "Xóa tất cả" sản phẩm khỏi giỏ hàng
  const btnClearAll = document.getElementById("btn-clear-all-cart");
  if (btnClearAll) {
    btnClearAll.addEventListener("click", handleClearAllCart);
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

  // Sự kiện chuyển đổi phương thức thanh toán (COD vs VietQR)
  setupPaymentMethodSwitch();

  // Sự kiện Modal Thanh toán QR
  setupQRPaymentModalEvents();

  // Sự kiện Khối Voucher giảm giá & Modal Voucher
  setupVoucherEvents();

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
 * Xác nhận xóa toàn bộ sản phẩm khỏi giỏ hàng
 */
function handleClearAllCart() {
  if (!currentCartState.items || currentCartState.items.length === 0) {
    if (typeof showToast === "function") {
      showToast("Giỏ hàng của bạn đang trống!", "info");
    }
    return;
  }

  const count = currentCartState.items.length;
  const msg = `Bạn có chắc chắn muốn xóa toàn bộ ${count} sản phẩm khỏi giỏ hàng không? Thao tác này không thể hoàn tác.`;

  if (typeof showConfirmModal === "function") {
    showConfirmModal({
      title: "Xóa toàn bộ giỏ hàng",
      message: msg,
      confirmText: "Xóa tất cả",
      cancelText: "Giữ lại",
      type: "danger",
      onConfirm: async () => {
        await executeClearAllCart();
      }
    });
  } else {
    if (confirm(msg)) {
      executeClearAllCart();
    }
  }
}

/**
 * Thực thi xóa tất cả sản phẩm khỏi giỏ hàng
 */
async function executeClearAllCart() {
  selectedProductIds.clear();

  // A. Backend API
  if (currentCartState.isBackend && typeof api !== "undefined" && api.delete) {
    try {
      await api.delete("/cart/items");
      if (typeof showToast === "function") {
        showToast("Đã xóa toàn bộ sản phẩm khỏi giỏ hàng", "success");
      }
      await loadCartData();
      return;
    } catch (err) {
      const msg = err.message || "Không thể xóa giỏ hàng";
      if (typeof showToast === "function") showToast(msg, "error");
      else alert(msg);
      return;
    }
  }

  // B. Demo Cục bộ
  currentCartState.items = [];
  saveDemoCart();
  recalculateState();
  renderCart();

  if (typeof showToast === "function") {
    showToast("Đã xóa toàn bộ sản phẩm khỏi giỏ hàng", "success");
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
// Dữ liệu địa chỉ nhận hàng hiện tại (mặc định rỗng, bắt buộc người dùng nhập hoặc có trong tài khoản)
let currentShippingData = {
  name: "",
  phone: "",
  province: "",
  district: "",
  street: "",
  address: "",
  isDefault: false
};

/**
 * Kiểm tra xem thông tin nhận hàng đã đầy đủ và hợp lệ chưa
 */
function isShippingComplete() {
  const name = (currentShippingData?.name || "").trim();
  const phone = (currentShippingData?.phone || "").trim();
  const province = (currentShippingData?.province || "").trim();
  const district = (currentShippingData?.district || "").trim();
  const street = (currentShippingData?.street || "").trim();
  const address = (currentShippingData?.address || "").trim();

  const phoneRegex = /^0\d{9}$/;
  const hasValidPhone = phoneRegex.test(phone);
  const hasName = name.length >= 2;
  const hasDetailed = province.length >= 2 && district.length >= 2 && street.length >= 2;
  const hasFull = address.length >= 5;

  return Boolean(hasName && hasValidPhone && (hasDetailed || hasFull));
}

/**
 * Cập nhật giao diện khối xem trước thông tin nhận hàng
 */
function renderShippingPreview(shippingData) {
  const previewName = document.getElementById("preview-recipient-name");
  const previewPhone = document.getElementById("preview-recipient-phone");
  const previewAddress = document.getElementById("preview-recipient-address");
  const previewBadge = document.getElementById("preview-default-badge");
  const btnChangeText = document.getElementById("btn-change-address-text");
  const subtitle = document.getElementById("shipping-card-subtitle");
  const shippingCard = document.getElementById("shipping-default-card");

  const hasName = Boolean(shippingData?.name && shippingData.name.trim().length >= 2);
  const phoneRegex = /^0\d{9}$/;
  const hasPhone = Boolean(shippingData?.phone && phoneRegex.test(shippingData.phone.trim()));
  const displayAddr = shippingData?.address || [shippingData?.street, shippingData?.district, shippingData?.province].filter(Boolean).join(", ");
  const hasAddress = Boolean(displayAddr && displayAddr.trim().length >= 5);
  const isComplete = hasName && hasPhone && hasAddress;

  if (isComplete) {
    if (previewName) {
      previewName.textContent = shippingData.name;
      previewName.style.color = "";
    }
    if (previewPhone) {
      previewPhone.textContent = shippingData.phone;
      previewPhone.style.color = "";
    }
    if (previewAddress) {
      previewAddress.textContent = displayAddr;
      previewAddress.style.color = "";
    }
    if (previewBadge) {
      previewBadge.style.display = shippingData.isDefault ? "inline-flex" : "none";
    }
    if (btnChangeText) btnChangeText.textContent = "Thay đổi địa chỉ";
    if (subtitle) {
      subtitle.textContent = "Mặc định từ tài khoản đã đăng ký của bạn";
      subtitle.style.color = "";
    }
    if (shippingCard) {
      shippingCard.style.borderColor = "";
      shippingCard.style.background = "";
    }
  } else {
    // Thiếu hoặc chưa có thông tin nhận hàng -> hiển thị cảnh báo trực quan
    if (previewName) {
      previewName.textContent = "Chưa có người nhận";
      previewName.style.color = "#dc2626";
    }
    if (previewPhone) {
      previewPhone.textContent = "Chưa có SĐT";
      previewPhone.style.color = "#dc2626";
    }
    if (previewAddress) {
      previewAddress.innerHTML = `<span style="color: #dc2626; font-weight: 600;">⚠️ Chưa có địa chỉ nhận hàng! Vui lòng nhập thông tin người nhận và địa chỉ giao hàng.</span>`;
    }
    if (previewBadge) previewBadge.style.display = "none";
    if (btnChangeText) btnChangeText.textContent = "+ Thêm địa chỉ nhận hàng";
    if (subtitle) {
      subtitle.innerHTML = `<span style="color: #dc2626; font-weight: 600;">⚠️ Chưa có địa chỉ giao hàng</span>`;
    }
    if (shippingCard) {
      shippingCard.style.borderColor = "#fca5a5";
      shippingCard.style.background = "#fff5f5";
    }
  }

  // Đồng bộ lại trạng thái nút Đặt hàng ngay
  if (typeof renderSummarySidebar === "function") {
    renderSummarySidebar();
  }
}

/**
 * Tự động lấy thông tin đăng ký của khách hàng làm mặc định cho mọi đơn hàng,
 * đồng bộ với Sổ địa chỉ (Address book) nếu có, và thiết lập tương tác nút Sửa địa chỉ.
 */
async function initShippingFormAutofill() {
  const nameInput = document.getElementById("shipping-name");
  const phoneInput = document.getElementById("shipping-phone");
  const provinceInput = document.getElementById("shipping-province");
  const districtInput = document.getElementById("shipping-district");
  const streetInput = document.getElementById("shipping-street");
  const addressInput = document.getElementById("shipping-address");
  const noteInput = document.getElementById("shipping-note");

  const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
  let user = typeof Auth !== "undefined" ? Auth.getUser() : null;
  const savedInfo = JSON.parse(localStorage.getItem(SHIPPING_INFO_KEY) || "{}");

  const isAdminOrStaff = Boolean(
    user && (
      user.role === "admin" ||
      user.role === "staff" ||
      user.role === "ADMIN" ||
      user.role === "STAFF" ||
      user.email?.toLowerCase().includes("admin") ||
      user.full_name?.toLowerCase().includes("quản trị")
    )
  );

  let defaultName = savedInfo.name || "";
  let defaultPhone = savedInfo.phone || "";
  let defaultProvince = savedInfo.province || "";
  let defaultDistrict = savedInfo.district || "";
  let defaultStreet = savedInfo.street || "";
  let defaultAddress = savedInfo.address || "";
  let isDefaultAddr = Boolean(savedInfo.is_default);

  // Xóa sạch nếu là dữ liệu mẫu cũ hoặc từ tài khoản admin/staff
  if (
    isAdminOrStaff ||
    defaultName.includes("Quản Trị") ||
    (defaultName === "Nguyễn Văn An" && defaultPhone === "0912345678") ||
    defaultAddress.includes("124 Lê Lợi") ||
    defaultAddress.includes("Duy Tân")
  ) {
    defaultName = "";
    defaultPhone = "";
    defaultProvince = "";
    defaultDistrict = "";
    defaultStreet = "";
    defaultAddress = "";
    isDefaultAddr = false;
    try {
      localStorage.removeItem(SHIPPING_INFO_KEY);
    } catch (_) {}
  }

  // 1. Nếu đã đăng nhập: lấy thông tin tài khoản đăng ký và sổ địa chỉ từ API
  if (token && typeof api !== "undefined" && api.get) {
    try {
      // A. Lấy thông tin tài khoản /auth/me nếu chưa có
      if (!user || !user.full_name) {
        try {
          user = await api.get("/auth/me");
          if (user) localStorage.setItem("user", JSON.stringify(user));
        } catch (_) {}
      }

      const isCurrentAdmin = Boolean(
        user && (
          user.role === "admin" ||
          user.role === "staff" ||
          user.role === "ADMIN" ||
          user.role === "STAFF" ||
          user.email?.toLowerCase().includes("admin") ||
          user.full_name?.toLowerCase().includes("quản trị")
        )
      );

      // B. Chỉ lấy sổ địa chỉ nếu KHÔNG PHẢI là admin/staff
      if (!isCurrentAdmin) {
        try {
          const addrList = await api.get("/auth/me/addresses");
          const addresses = Array.isArray(addrList) ? addrList : (addrList?.data || []);
          // Lọc bỏ bất kỳ địa chỉ seed mẫu nào
          const validAddrs = (Array.isArray(addresses) ? addresses : []).filter(a => {
            const st = ((a.street_detail || "") + " " + (a.ward || "") + " " + (a.province || "")).toLowerCase();
            return !st.includes("duy tân") && !st.includes("124 lê lợi");
          });

          if (validAddrs.length > 0) {
            userAddressBook = validAddrs;
            const defaultAddr = validAddrs.find(a => a.is_default === 1 || a.is_default === true) || validAddrs[0];
            if (defaultAddr) {
              defaultName = defaultAddr.receiver_name || user.full_name || "";
              defaultPhone = defaultAddr.phone || user.phone || "";
              defaultProvince = defaultAddr.province || "";
              defaultDistrict = defaultAddr.ward || "";
              defaultStreet = defaultAddr.street_detail || "";
              const fullAddr = [defaultStreet, defaultDistrict, defaultProvince]
                .filter(Boolean)
                .join(", ");
              if (fullAddr) {
                defaultAddress = fullAddr;
                isDefaultAddr = Boolean(defaultAddr.is_default === 1 || defaultAddr.is_default === true);
              }
            }
          } else {
            userAddressBook = [];
            defaultName = "";
            defaultPhone = "";
            defaultProvince = "";
            defaultDistrict = "";
            defaultStreet = "";
            defaultAddress = "";
            isDefaultAddr = false;
            try {
              localStorage.removeItem(SHIPPING_INFO_KEY);
            } catch (_) {}
          }
        } catch (errAddr) {
          console.warn("Chưa tải được sổ địa chỉ từ API:", errAddr);
        }
      }
    } catch (errUser) {
      console.warn("Lỗi đồng bộ hồ sơ người dùng:", errUser);
    }
  }

  // Nếu chưa có địa chỉ chi tiết nhưng có defaultAddress (từ chuỗi lưu trước đó)
  if (defaultAddress && (!defaultProvince || !defaultDistrict || !defaultStreet)) {
    const parts = defaultAddress.split(",").map(p => p.trim());
    if (parts.length >= 3) {
      if (!defaultProvince) defaultProvince = parts[parts.length - 1];
      if (!defaultDistrict) defaultDistrict = parts[parts.length - 2];
      if (!defaultStreet) defaultStreet = parts.slice(0, parts.length - 2).join(", ");
    } else if (parts.length === 2) {
      if (!defaultProvince) defaultProvince = parts[1];
      if (!defaultStreet) defaultStreet = parts[0];
    } else {
      if (!defaultStreet) defaultStreet = defaultAddress;
    }
  }

  if (defaultStreet || defaultDistrict || defaultProvince) {
    defaultAddress = [defaultStreet, defaultDistrict, defaultProvince].filter(Boolean).join(", ");
  }

  // Nếu chưa có địa chỉ giao hàng hợp lệ -> để trống hoàn toàn để người dùng nhập
  if (!defaultAddress) {
    defaultName = "";
    defaultPhone = "";
    defaultProvince = "";
    defaultDistrict = "";
    defaultStreet = "";
    defaultAddress = "";
    isDefaultAddr = false;
  }

  // Cập nhật state địa chỉ hiện tại
  currentShippingData = {
    name: defaultName,
    phone: defaultPhone,
    province: defaultProvince,
    district: defaultDistrict,
    street: defaultStreet,
    address: defaultAddress,
    isDefault: isDefaultAddr
  };

  // Điền vào các ô input trong Form chỉnh sửa (để trống khi chưa có)
  if (nameInput) nameInput.value = defaultName;
  if (phoneInput) {
    phoneInput.value = defaultPhone;
    if (defaultPhone) validatePhone(defaultPhone);
    else {
      const validIcon = document.getElementById("phone-valid-icon");
      if (validIcon) validIcon.classList.remove("valid");
    }
  }
  if (provinceInput) provinceInput.value = defaultProvince;
  if (districtInput) districtInput.value = defaultDistrict;
  if (streetInput) streetInput.value = defaultStreet;
  if (addressInput) addressInput.value = defaultAddress;

  if (noteInput) {
    if (savedInfo.note && !isAdminOrStaff && !savedInfo.note.includes("Giao trong giờ hành chính")) {
      noteInput.value = savedInfo.note;
    } else {
      noteInput.value = "";
    }
  }

  // Hiển thị Khối Xem Trước (Preview Card)
  renderShippingPreview(currentShippingData);

  const editCard = document.getElementById("shipping-edit-card");
  const selectorCard = document.getElementById("shipping-address-selector-card");
  const btnChangeAddress = document.getElementById("btn-change-address");
  const btnChangeText = document.getElementById("btn-change-address-text");
  const shippingEditTitle = document.getElementById("shipping-edit-title");
  const saveDefaultCheckbox = document.getElementById("save-as-default-checkbox");

  // Nếu chưa có địa chỉ: Form là "Tạo địa chỉ nhận hàng mặc định mới", mở sẵn form
  if (!userAddressBook || userAddressBook.length === 0 || !isShippingComplete()) {
    if (editCard) editCard.style.display = "block";
    if (selectorCard) selectorCard.style.display = "none";
    if (shippingEditTitle) shippingEditTitle.textContent = "Tạo địa chỉ nhận hàng mặc định mới";
    if (saveDefaultCheckbox) {
      saveDefaultCheckbox.checked = true;
      saveDefaultCheckbox.disabled = true;
    }
    if (btnChangeAddress) btnChangeAddress.classList.add("is-editing");
    if (btnChangeText) btnChangeText.textContent = "Đóng";
  } else {
    if (editCard) editCard.style.display = "none";
    if (selectorCard) selectorCard.style.display = "none";
    if (btnChangeAddress) btnChangeAddress.classList.remove("is-editing");
    if (btnChangeText) {
      btnChangeText.textContent = userAddressBook.length > 1 ? "Thay đổi địa chỉ" : "+ Thêm địa chỉ mới";
    }
    if (saveDefaultCheckbox) {
      saveDefaultCheckbox.disabled = false;
    }
  }

  // Thiết lập sự kiện tương tác địa chỉ (được bảo vệ chỉ chạy 1 lần duy nhất)
  setupShippingAddressActions();
}

/**
 * Render danh sách địa chỉ từ sổ địa chỉ để khách hàng chọn
 */
function renderAddressBookList() {
  const listContainer = document.getElementById("address-book-list");
  if (!listContainer) return;

  if (!userAddressBook || userAddressBook.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #64748b; font-size: 13.5px;">
        Chưa có địa chỉ nào trong sổ địa chỉ. Hãy thêm địa chỉ mới!
      </div>
    `;
    return;
  }

  listContainer.innerHTML = userAddressBook.map(addr => {
    const fullStreet = [addr.street_detail, addr.ward, addr.province].filter(Boolean).join(", ");
    const isSelected = (
      currentShippingData &&
      (currentShippingData.address === fullStreet || (currentShippingData.phone === addr.phone && currentShippingData.name === addr.receiver_name))
    );
    const isDefault = Boolean(addr.is_default === 1 || addr.is_default === true);

    return `
      <div class="address-book-item ${isSelected ? 'active' : ''}" data-address-id="${addr.id}">
        <input type="radio" name="selected_address_radio" class="address-book-radio" ${isSelected ? 'checked' : ''}>
        <div class="address-book-info">
          <div class="address-book-header">
            <span class="address-book-name">${escapeHtml(addr.receiver_name || "")}</span>
            <span class="address-book-phone">${escapeHtml(addr.phone || "")}</span>
            ${isDefault ? '<span class="address-book-badge">Mặc định</span>' : ''}
          </div>
          <div class="address-book-detail">${escapeHtml(fullStreet)}</div>
        </div>
      </div>
    `;
  }).join("");

  listContainer.querySelectorAll(".address-book-item").forEach(item => {
    item.addEventListener("click", () => {
      const addrId = Number(item.dataset.addressId);
      const chosen = userAddressBook.find(a => a.id === addrId);
      if (!chosen) return;

      const fullStreet = [chosen.street_detail, chosen.ward, chosen.province].filter(Boolean).join(", ");
      currentShippingData = {
        name: chosen.receiver_name || "",
        phone: chosen.phone || "",
        province: chosen.province || "",
        district: chosen.ward || "",
        street: chosen.street_detail || "",
        address: fullStreet,
        isDefault: Boolean(chosen.is_default === 1 || chosen.is_default === true)
      };

      const nameInput = document.getElementById("shipping-name");
      const phoneInput = document.getElementById("shipping-phone");
      const provinceInput = document.getElementById("shipping-province");
      const districtInput = document.getElementById("shipping-district");
      const streetInput = document.getElementById("shipping-street");
      const addressInput = document.getElementById("shipping-address");

      if (nameInput) nameInput.value = currentShippingData.name;
      if (phoneInput) {
        phoneInput.value = currentShippingData.phone;
        validatePhone(currentShippingData.phone);
      }
      if (provinceInput) provinceInput.value = currentShippingData.province;
      if (districtInput) districtInput.value = currentShippingData.district;
      if (streetInput) streetInput.value = currentShippingData.street;
      if (addressInput) addressInput.value = currentShippingData.address;

      renderShippingPreview(currentShippingData);

      localStorage.setItem(SHIPPING_INFO_KEY, JSON.stringify({
        name: currentShippingData.name,
        phone: currentShippingData.phone,
        province: currentShippingData.province,
        district: currentShippingData.district,
        street: currentShippingData.street,
        address: currentShippingData.address,
        is_default: currentShippingData.isDefault
      }));

      const selectorCard = document.getElementById("shipping-address-selector-card");
      if (selectorCard) selectorCard.style.display = "none";
      const btnChangeAddress = document.getElementById("btn-change-address");
      if (btnChangeAddress) btnChangeAddress.classList.remove("is-editing");
      const btnChangeText = document.getElementById("btn-change-address-text");
      if (btnChangeText) btnChangeText.textContent = userAddressBook.length > 1 ? "Thay đổi địa chỉ" : "+ Thêm địa chỉ mới";

      if (typeof showToast === "function") {
        showToast("Đã chọn địa chỉ nhận hàng!", "success");
      }
    });
  });
}

/**
 * Quản lý tương tác: Mở / Đóng hộp sửa địa chỉ và Xác nhận thay đổi
 */
function setupShippingAddressActions() {
  if (isShippingActionsSetup) return;
  isShippingActionsSetup = true;

  const btnChangeAddress = document.getElementById("btn-change-address");
  const btnChangeText = document.getElementById("btn-change-address-text");
  const editCard = document.getElementById("shipping-edit-card");
  const selectorCard = document.getElementById("shipping-address-selector-card");
  const btnCloseSelector = document.getElementById("btn-close-address-selector");
  const btnOpenAddNew = document.getElementById("btn-open-add-new-address");
  const shippingEditTitle = document.getElementById("shipping-edit-title");
  const btnCloseEdit = document.getElementById("btn-close-edit-shipping");
  const btnCancelEdit = document.getElementById("btn-cancel-address-change");
  const btnSaveEdit = document.getElementById("btn-save-address-change");
  const saveDefaultCheckbox = document.getElementById("save-as-default-checkbox");

  const nameInput = document.getElementById("shipping-name");
  const phoneInput = document.getElementById("shipping-phone");
  const provinceInput = document.getElementById("shipping-province");
  const districtInput = document.getElementById("shipping-district");
  const streetInput = document.getElementById("shipping-street");
  const addressInput = document.getElementById("shipping-address");

  if (!btnChangeAddress) return;

  function closeAllAddressDrawers() {
    if (editCard) editCard.style.display = "none";
    if (selectorCard) selectorCard.style.display = "none";
    btnChangeAddress.classList.remove("is-editing");
    if (btnChangeText) {
      if (!isShippingComplete() || userAddressBook.length === 0) {
        btnChangeText.textContent = "+ Thêm địa chỉ nhận hàng";
      } else {
        btnChangeText.textContent = userAddressBook.length > 1 ? "Thay đổi địa chỉ" : "+ Thêm địa chỉ mới";
      }
    }
    clearShippingErrors();
  }

  // 1. Click nút "Thay đổi địa chỉ" / "+ Thêm địa chỉ mới"
  btnChangeAddress.addEventListener("click", () => {
    const isEditOpen = editCard && editCard.style.display === "block";
    const isSelectorOpen = selectorCard && selectorCard.style.display === "block";

    if (isEditOpen || isSelectorOpen) {
      closeAllAddressDrawers();
      return;
    }

    // Nếu đã có địa chỉ trong sổ địa chỉ: mở danh sách lựa chọn
    if (userAddressBook && userAddressBook.length > 0) {
      renderAddressBookList();
      if (selectorCard) selectorCard.style.display = "block";
      if (editCard) editCard.style.display = "none";
      btnChangeAddress.classList.add("is-editing");
      if (btnChangeText) btnChangeText.textContent = "Đóng";
    } else {
      // Chưa có địa chỉ nào: mở form tạo địa chỉ mặc định mới
      if (shippingEditTitle) shippingEditTitle.textContent = "Tạo địa chỉ nhận hàng mặc định mới";
      if (saveDefaultCheckbox) {
        saveDefaultCheckbox.checked = true;
        saveDefaultCheckbox.disabled = true;
      }
      if (nameInput) nameInput.value = currentShippingData.name || "";
      if (phoneInput) {
        phoneInput.value = currentShippingData.phone || "";
        if (currentShippingData.phone) validatePhone(currentShippingData.phone);
      }
      if (provinceInput) provinceInput.value = "";
      if (districtInput) districtInput.value = "";
      if (streetInput) streetInput.value = "";
      if (addressInput) addressInput.value = "";

      clearShippingErrors();
      if (editCard) editCard.style.display = "block";
      if (selectorCard) selectorCard.style.display = "none";
      btnChangeAddress.classList.add("is-editing");
      if (btnChangeText) btnChangeText.textContent = "Đóng";
      setTimeout(() => (nameInput?.value ? streetInput?.focus() : nameInput?.focus()), 100);
    }
  });

  // 2. Click nút đóng danh sách chọn địa chỉ
  if (btnCloseSelector) {
    btnCloseSelector.addEventListener("click", closeAllAddressDrawers);
  }

  // 3. Click nút "+ Thêm địa chỉ mới" từ danh sách chọn
  if (btnOpenAddNew) {
    btnOpenAddNew.addEventListener("click", () => {
      if (selectorCard) selectorCard.style.display = "none";
      if (shippingEditTitle) shippingEditTitle.textContent = "Thêm địa chỉ nhận hàng mới";
      if (saveDefaultCheckbox) {
        saveDefaultCheckbox.checked = false;
        saveDefaultCheckbox.disabled = false;
      }
      if (nameInput) nameInput.value = currentShippingData.name || "";
      if (phoneInput) {
        phoneInput.value = currentShippingData.phone || "";
        if (currentShippingData.phone) validatePhone(currentShippingData.phone);
      }
      if (provinceInput) provinceInput.value = "";
      if (districtInput) districtInput.value = "";
      if (streetInput) streetInput.value = "";
      if (addressInput) addressInput.value = "";

      clearShippingErrors();
      if (editCard) editCard.style.display = "block";
      btnChangeAddress.classList.add("is-editing");
      if (btnChangeText) btnChangeText.textContent = "Đóng";
      setTimeout(() => (nameInput?.value ? streetInput?.focus() : nameInput?.focus()), 100);
    });
  }

  // 4. Click nút đóng hoặc Hủy bỏ form nhập địa chỉ
  if (btnCloseEdit) btnCloseEdit.addEventListener("click", closeAllAddressDrawers);
  if (btnCancelEdit) btnCancelEdit.addEventListener("click", closeAllAddressDrawers);

  // 5. Click nút "Xác nhận địa chỉ"
  if (btnSaveEdit) {
    btnSaveEdit.addEventListener("click", async () => {
      if (isSavingAddress) return;

      if (!validateShippingForm()) {
        if (typeof showToast === "function") {
          showToast("Vui lòng kiểm tra lại thông tin người nhận và địa chỉ", "error");
        }
        return;
      }

      const newName = nameInput?.value.trim() || "";
      const newPhone = phoneInput?.value.trim() || "";
      const newProvince = provinceInput?.value.trim() || "";
      const newDistrict = districtInput?.value.trim() || "";
      const newStreet = streetInput?.value.trim() || "";
      const fullAddress = [newStreet, newDistrict, newProvince].filter(Boolean).join(", ");
      const isSaveDefault = (userAddressBook.length === 0) ? true : (saveDefaultCheckbox ? saveDefaultCheckbox.checked : false);

      isSavingAddress = true;
      btnSaveEdit.disabled = true;
      const oldBtnText = btnSaveEdit.textContent;
      btnSaveEdit.textContent = "Đang lưu...";

      try {
        currentShippingData = {
          name: newName,
          phone: newPhone,
          province: newProvince,
          district: newDistrict,
          street: newStreet,
          address: fullAddress,
          isDefault: isSaveDefault
        };

        if (addressInput) addressInput.value = fullAddress;
        renderShippingPreview(currentShippingData);

        const noteVal = document.getElementById("shipping-note")?.value.trim() || "";
        localStorage.setItem(SHIPPING_INFO_KEY, JSON.stringify({
          name: newName,
          phone: newPhone,
          province: newProvince,
          district: newDistrict,
          street: newStreet,
          address: fullAddress,
          note: noteVal,
          is_default: isSaveDefault
        }));

        // Gửi API Backend lưu vào sổ địa chỉ
        const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
        if (token && typeof api !== "undefined" && api.post) {
          try {
            const createdAddr = await api.post("/auth/me/addresses", {
              receiver_name: newName,
              phone: newPhone,
              province: newProvince,
              ward: newDistrict,
              street_detail: newStreet,
              is_default: isSaveDefault ? 1 : 0
            });

            if (createdAddr && createdAddr.id) {
              if (isSaveDefault) {
                userAddressBook.forEach(a => a.is_default = 0);
              }
              userAddressBook.push(createdAddr);
            }
          } catch (errApi) {
            console.warn("Chưa đồng bộ được địa chỉ mới lên API backend:", errApi);
          }
        }

        // Đóng form
        if (editCard) editCard.style.display = "none";
        btnChangeAddress.classList.remove("is-editing");
        if (btnChangeText) {
          btnChangeText.textContent = userAddressBook.length > 1 ? "Thay đổi địa chỉ" : "+ Thêm địa chỉ mới";
        }

        if (typeof showToast === "function") {
          showToast(isSaveDefault ? "Đã lưu làm địa chỉ nhận hàng mặc định!" : "Đã cập nhật địa chỉ nhận hàng!", "success");
        }
      } finally {
        isSavingAddress = false;
        btnSaveEdit.disabled = false;
        btnSaveEdit.textContent = oldBtnText;
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
  const provinceError = document.getElementById("province-error");
  const districtError = document.getElementById("district-error");
  const streetError = document.getElementById("street-error");
  const addressError = document.getElementById("address-error");

  const nameInput = document.getElementById("shipping-name");
  const phoneInput = document.getElementById("shipping-phone");
  const provinceInput = document.getElementById("shipping-province");
  const districtInput = document.getElementById("shipping-district");
  const streetInput = document.getElementById("shipping-street");
  const addressInput = document.getElementById("shipping-address");

  if (nameError) nameError.textContent = "";
  if (phoneError) phoneError.textContent = "";
  if (provinceError) provinceError.textContent = "";
  if (districtError) districtError.textContent = "";
  if (streetError) streetError.textContent = "";
  if (addressError) addressError.textContent = "";

  nameInput?.classList.remove("is-invalid");
  phoneInput?.classList.remove("is-invalid");
  provinceInput?.classList.remove("is-invalid");
  districtInput?.classList.remove("is-invalid");
  streetInput?.classList.remove("is-invalid");
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
  const provinceInput = document.getElementById("shipping-province");
  const districtInput = document.getElementById("shipping-district");
  const streetInput = document.getElementById("shipping-street");

  const nameError = document.getElementById("name-error");
  const phoneError = document.getElementById("phone-error");
  const provinceError = document.getElementById("province-error");
  const districtError = document.getElementById("district-error");
  const streetError = document.getElementById("street-error");

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

  // 3. Tỉnh / Thành phố
  const provinceVal = (provinceInput?.value || "").trim();
  if (!provinceVal || provinceVal.length < 2) {
    if (provinceError) provinceError.textContent = "Vui lòng nhập Tỉnh / Thành phố";
    provinceInput?.classList.add("is-invalid");
    isValid = false;
  } else {
    if (provinceError) provinceError.textContent = "";
    provinceInput?.classList.remove("is-invalid");
  }

  // 4. Quận / Huyện
  const districtVal = (districtInput?.value || "").trim();
  if (!districtVal || districtVal.length < 2) {
    if (districtError) districtError.textContent = "Vui lòng nhập Quận / Huyện";
    districtInput?.classList.add("is-invalid");
    isValid = false;
  } else {
    if (districtError) districtError.textContent = "";
    districtInput?.classList.remove("is-invalid");
  }

  // 5. Địa chỉ cụ thể (Số nhà, tên đường...)
  const streetVal = (streetInput?.value || "").trim();
  if (!streetVal || streetVal.length < 2) {
    if (streetError) streetError.textContent = "Vui lòng nhập số nhà, tên đường cụ thể";
    streetInput?.classList.add("is-invalid");
    isValid = false;
  } else {
    if (streetError) streetError.textContent = "";
    streetInput?.classList.remove("is-invalid");
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

  // 3. KIỂM TRA ĐỊA CHỈ VÀ THÔNG TIN NGƯỜI NHẬN: CHƯA CÓ THÌ TUYỆT ĐỐI KHÔNG ĐẶT ĐƯỢC HÀNG
  const nameInput = document.getElementById("shipping-name");
  const phoneInput = document.getElementById("shipping-phone");
  const provinceInput = document.getElementById("shipping-province");
  const districtInput = document.getElementById("shipping-district");
  const streetInput = document.getElementById("shipping-street");
  const addressInput = document.getElementById("shipping-address");

  const name = (nameInput?.value || currentShippingData.name || "").trim();
  const phone = (phoneInput?.value || currentShippingData.phone || "").trim();
  const province = (provinceInput?.value || currentShippingData.province || "").trim();
  const district = (districtInput?.value || currentShippingData.district || "").trim();
  const street = (streetInput?.value || currentShippingData.street || "").trim();
  const address = currentShippingData.address || [street, district, province].filter(Boolean).join(", ");
  const note = document.getElementById("shipping-note")?.value.trim() || "";

  if (!isShippingComplete() || !validateShippingForm()) {
    if (typeof showToast === "function") {
      showToast("Chưa có đầy đủ thông tin nhận hàng! Vui lòng hoàn tất họ tên, SĐT, Tỉnh/Thành phố, Quận/Huyện và địa chỉ.", "error");
    } else {
      alert("Chưa có đầy đủ thông tin nhận hàng! Vui lòng hoàn tất họ tên, SĐT, Tỉnh/Thành phố, Quận/Huyện và địa chỉ.");
    }

    // Tự động mở form chỉnh sửa địa chỉ và scroll đến vị trí form
    const editCard = document.getElementById("shipping-edit-card");
    if (editCard) {
      editCard.style.display = "block";
      editCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const btnChangeAddress = document.getElementById("btn-change-address");
    if (btnChangeAddress) btnChangeAddress.classList.add("is-editing");

    validateShippingForm();

    if (!name || name.length < 2) nameInput?.focus();
    else if (!phone || !validatePhone(phone)) phoneInput?.focus();
    else if (!province || province.length < 2) provinceInput?.focus();
    else if (!district || district.length < 2) districtInput?.focus();
    else if (!street || street.length < 2) streetInput?.focus();

    return;
  }

  // Lưu lại thông tin giao hàng cho các lần sau
  localStorage.setItem(SHIPPING_INFO_KEY, JSON.stringify({
    name,
    phone,
    province,
    district,
    street,
    address,
    note
  }));

  const btnPlaceOrder = document.getElementById("btn-place-order");
  const btnOrderText = document.getElementById("btn-order-text");

  // Kiểm tra phương thức thanh toán được chọn (COD hay Chuyển khoản VietQR)
  const isBankPayment = document.getElementById("payment-radio-bank")?.checked;
  const paymentMethod = isBankPayment ? "chuyển khoản" : "COD";

  const selectedList = Array.from(selectedProductIds);

  const orderPayload = {
    receiver_name: name,
    receiver_phone: phone,
    shipping_address: address,
    note: note,
    payment_method: paymentMethod,
    selected_product_ids: selectedList,
    voucher_code: appliedVoucher ? appliedVoucher.code : null
  };

  // =========================================================================
  // NẾU KHÁCH CHỌN CHUYỂN KHOẢN VIETQR:
  // QUY TẮC QUAN TRỌNG: CHƯA ĐƯỢC GỌI API TẠO ĐƠN VÀ CHƯA ĐƯỢC XÓA GIỎ HÀNG!
  // Vì nếu gọi API tạo đơn bây giờ, Backend sẽ commit xóa các sản phẩm khỏi giỏ hàng.
  // Khi đó nếu khách không quét hoặc bấm "Chọn lại phương thức thanh toán", giỏ hàng sẽ bị trống trơn.
  // GIẢI PHÁP: Chỉ tạo thông tin đơn hàng tạm (preview) để hiển thị mã QR có số tiền và mã thanh toán.
  // Giỏ hàng và toàn bộ sản phẩm vẫn được GIỮ NGUYÊN 100%!
  // =========================================================================
  if (isBankPayment) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const previewOrderCode = `SE-${dateStr}-${randomCode}`;

    // Lấy đúng số tiền của các sản phẩm đang được tích chọn
    const previewTotal = currentCartState.total_amount || 0;

    const previewOrder = {
      order_code: previewOrderCode,
      total_amount: previewTotal,
      shipping_name: name,
      shipping_phone: phone,
      shipping_address: address,
      payment_method: "chuyển khoản"
    };

    currentPendingQrOrder = {
      payload: orderPayload,
      previewOrder: previewOrder,
      name: name,
      phone: phone,
      address: address,
      isBackend: currentCartState.isBackend
    };

    // Mở popup Modal Quét mã QR thanh toán (Sản phẩm trong giỏ vẫn còn nguyên 100%)
    showQRPaymentModal(previewOrder, name, phone, address);
    return;
  }

  // =========================================================================
  // NẾU KHÁCH CHỌN PHƯƠNG THỨC COD: TIẾN HÀNH ĐẶT HÀNG TRỰC TIẾP
  // =========================================================================
  if (btnPlaceOrder) btnPlaceOrder.disabled = true;
  if (btnOrderText) {
    btnOrderText.textContent = "Đang xử lý đặt hàng...";
  }

  try {
    let orderResult = null;

    // A. Backend API nếu đang online / có token
    if (currentCartState.isBackend && typeof api !== "undefined" && api.post) {
      orderResult = await api.post("/orders", orderPayload);

      // Cập nhật trạng thái Stepper sang Bước 3 Hoàn tất
      setStepperCompleted();

      // Hiển thị modal đặt hàng COD thành công
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
      const discount = currentCartState.discount_amount || 0;
      const orderedTotal = Math.max(0, orderedSubtotal + orderedShipping - discount);

      orderResult = {
        order_code: generatedOrderCode,
        shipping_name: name,
        shipping_phone: phone,
        shipping_address: address,
        payment_method: paymentMethod,
        subtotal_amount: orderedSubtotal,
        shipping_fee: orderedShipping,
        discount_amount: discount,
        voucher_code: appliedVoucher ? appliedVoucher.code : null,
        total_amount: orderedTotal,
        items: orderedItems,
        created_at: now.toISOString(),
        status: "PENDING"
      };

      // 1. Lưu vào danh sách đơn demo
      const savedOrders = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || "[]");
      savedOrders.unshift(orderResult);
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(savedOrders));

      // Cập nhật trạng thái Stepper sang Bước 3 Hoàn tất
      setStepperCompleted();

      // Chỉ lưu lại các sản phẩm CHƯA ĐƯỢC CHỌN trong giỏ hàng
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(remainingItems));

      // Cập nhật state giỏ hàng hiện tại với các món còn lại
      currentCartState.items = remainingItems;
      selectedProductIds = new Set(remainingItems.map(it => it.product_id));
      recalculateState();
      renderCart();

      // Hiển thị modal đặt hàng COD thành công
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
      const isBank = document.getElementById("payment-radio-bank")?.checked;
      btnOrderText.textContent = selectedCount > 0
        ? (isBank ? `Thanh toán chuyển khoản QR (${selectedCount} món)` : `Đặt hàng ngay (${selectedCount} món)`)
        : "Đặt hàng ngay";
    }
  }
}

// ==========================================================
// 6. XỬ LÝ CHUYỂN ĐỔI PHƯƠNG THỨC THANH TOÁN (COD VS VIETQR)
// ==========================================================
function setupPaymentMethodSwitch() {
  const radioCod = document.getElementById("payment-radio-cod");
  const radioBank = document.getElementById("payment-radio-bank");
  const labelCod = document.getElementById("payment-label-cod");
  const labelBank = document.getElementById("payment-label-bank");

  function updatePaymentMethodUI() {
    const isBank = radioBank && radioBank.checked;
    if (labelCod) labelCod.classList.toggle("active", !isBank);
    if (labelBank) labelBank.classList.toggle("active", isBank);

    const btnOrderText = document.getElementById("btn-order-text");
    const selectedCount = selectedProductIds.size;
    if (btnOrderText && selectedCount > 0) {
      btnOrderText.textContent = isBank
        ? `Thanh toán chuyển khoản QR (${selectedCount} món)`
        : `Đặt hàng ngay (${selectedCount} món)`;
    }
  }

  if (radioCod) radioCod.addEventListener("change", updatePaymentMethodUI);
  if (radioBank) radioBank.addEventListener("change", updatePaymentMethodUI);
}

// ==========================================================
// 7. XỬ LÝ MODAL QUÉT MÃ QR THANH TOÁN CHUYỂN KHOẢN (VIETQR)
// ==========================================================
/**
 * Gắn các sự kiện cho Modal Thanh toán QR
 */
function setupQRPaymentModalEvents() {
  const modal = document.getElementById("qr-payment-modal");
  const btnCloseModal = document.getElementById("btn-close-qr-modal");
  const btnChangePayment = document.getElementById("btn-qr-change-payment");
  const btnConfirmPaid = document.getElementById("btn-qr-confirm-paid");

  // Sự kiện nút đóng & nút "Chọn lại phương thức thanh toán"
  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => closeQRPaymentModal(true));
  }
  if (btnChangePayment) {
    btnChangePayment.addEventListener("click", () => closeQRPaymentModal(true));
  }

  // Đóng khi click vào vùng nền ngoài modal (backdrop)
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeQRPaymentModal(true);
      }
    });
  }

  // Đóng khi bấm phím Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeQRPaymentModal(true);
    }
  });

  // Sự kiện nút "Tôi đã thanh toán thành công"
  if (btnConfirmPaid) {
    btnConfirmPaid.addEventListener("click", handleConfirmPaidQR);
  }

  // Sự kiện cho các nút Sao chép (STK, Số tiền, Nội dung CK)
  document.querySelectorAll(".btn-copy-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const textToCopy = btn.getAttribute("data-copy") || "";
      if (textToCopy) {
        copyToClipboard(textToCopy, btn);
      }
    });
  });
}

/**
 * Hiển thị Modal Quét mã QR thanh toán chuyển khoản
 */
function showQRPaymentModal(order, name, phone, address) {
  const modal = document.getElementById("qr-payment-modal");
  if (!modal) return;

  const orderCode = order.order_code || order.code || "SE-20261120-8888";
  const totalAmount = order.total_amount || 0;

  // 1. Tạo URL mã QR động chuẩn VietQR có nhúng số tiền và mã đơn hàng
  // Khi quét trong App ngân hàng (Techcombank, VCB, MB, Momo...) sẽ TỰ ĐỘNG ĐIỀN ĐÚNG SỐ TIỀN & NỘI DUNG!
  const vietQrUrl = `https://img.vietqr.io/image/${BANK_ACCOUNT_CONFIG.bankBin}-${BANK_ACCOUNT_CONFIG.accountNumber}-qr_only.png?amount=${totalAmount}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(BANK_ACCOUNT_CONFIG.accountName)}`;

  const qrImage = document.getElementById("qr-payment-image");
  if (qrImage) {
    qrImage.src = vietQrUrl;
    // Fallback: nếu lỗi mạng hoặc offline, hiển thị ảnh mã QR gốc đã crop gọn gàng
    qrImage.onerror = () => {
      qrImage.src = BANK_ACCOUNT_CONFIG.localQrSquare;
    };
  }

  // 2. Điền thông tin vào các trường
  const accNameElem = document.getElementById("qr-account-name");
  const accNoElem = document.getElementById("qr-account-no");
  const amountElem = document.getElementById("qr-amount-val");
  const memoElem = document.getElementById("qr-memo-val");

  if (accNameElem) accNameElem.textContent = BANK_ACCOUNT_CONFIG.accountName;
  if (accNoElem) accNoElem.textContent = BANK_ACCOUNT_CONFIG.accountNumberFormatted;
  if (amountElem) amountElem.textContent = formatMoney(totalAmount);
  if (memoElem) memoElem.textContent = orderCode;

  // 3. Gán giá trị sao chép cho các nút copy
  const btnCopyAcc = document.getElementById("btn-copy-acc");
  const btnCopyAmount = document.getElementById("btn-copy-amount");
  const btnCopyMemo = document.getElementById("btn-copy-memo");

  if (btnCopyAcc) btnCopyAcc.setAttribute("data-copy", BANK_ACCOUNT_CONFIG.accountNumber);
  if (btnCopyAmount) btnCopyAmount.setAttribute("data-copy", String(totalAmount));
  if (btnCopyMemo) btnCopyMemo.setAttribute("data-copy", orderCode);

  // 4. Bắt đầu bộ đếm ngược 15 phút (900 giây)
  startQRCountdown(15 * 60);

  // 5. Hiển thị modal nổi lên
  modal.classList.add("active");
}

/**
 * Đếm ngược thời gian hết hạn mã QR
 */
function startQRCountdown(seconds) {
  if (qrCountdownInterval) clearInterval(qrCountdownInterval);

  let remaining = seconds;
  const timerElem = document.getElementById("qr-countdown-timer");

  function updateDisplay() {
    if (!timerElem) return;
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    timerElem.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  updateDisplay();

  qrCountdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(qrCountdownInterval);
      if (timerElem) timerElem.textContent = "00:00 (Hết hạn)";
      if (typeof showToast === "function") {
        showToast("Mã QR đã hết hạn thanh toán. Vui lòng thử lại hoặc chọn phương thức khác.", "warning");
      }
    } else {
      updateDisplay();
    }
  }, 1000);
}

/**
 * Xử lý khi khách hàng bấm "Tôi đã thanh toán thành công"
 */
async function handleConfirmPaidQR() {
  if (!currentPendingQrOrder) {
    closeQRPaymentModal(false);
    return;
  }

  const btnConfirm = document.getElementById("btn-qr-confirm-paid");
  const btnSpinner = document.getElementById("qr-btn-spinner");
  const checkIcon = document.getElementById("qr-check-icon");
  const confirmText = document.getElementById("qr-confirm-text");

  // Hiển thị trạng thái kiểm tra giao dịch & hoàn tất đơn
  if (btnConfirm) btnConfirm.disabled = true;
  if (btnSpinner) btnSpinner.style.display = "inline-block";
  if (checkIcon) checkIcon.style.display = "none";
  if (confirmText) confirmText.textContent = "Đang kiểm tra & hoàn tất đơn hàng...";

  try {
    let finalOrderCode = currentPendingQrOrder.previewOrder?.order_code || "";

    // CHỈ TẠO ĐƠN VÀ XÓA CÁC MÓN ĐÃ MUA KHỎI GIỎ KHI KHÁCH ĐÃ XÁC NHẬN THANH TOÁN THÀNH CÔNG
    if (currentPendingQrOrder.isBackend && typeof api !== "undefined" && api.post) {
      // 1. Gửi request tạo đơn hàng chính thức lên Backend API
      const orderResult = await api.post("/orders", currentPendingQrOrder.payload);
      finalOrderCode = orderResult.order_code || finalOrderCode;

      // 2. Cập nhật trạng thái Stepper sang Bước 3 Hoàn tất
      setStepperCompleted();

      // 3. Xóa các ID đã mua khỏi danh sách chọn và tải lại giỏ hàng từ Backend
      // (Backend chỉ xóa các món đã đặt mua, các món chưa chọn vẫn còn nguyên vẹn trong CSDL!)
      selectedProductIds.clear();
      await loadCartData();
    } else {
      // Chế độ Demo Cục bộ (Local Fallback)
      await new Promise(r => setTimeout(r, 600));

      const now = new Date();
      const orderedItems = currentCartState.items.filter(it => selectedProductIds.has(it.product_id));
      const remainingItems = currentCartState.items.filter(it => !selectedProductIds.has(it.product_id));

      const orderedSubtotal = orderedItems.reduce((s, it) => s + (it.price * it.quantity), 0);
      const orderedShipping = orderedSubtotal >= 500000 ? 0 : 30000;
      const discount = currentCartState.discount_amount || 0;
      const orderedTotal = Math.max(0, orderedSubtotal + orderedShipping - discount);

      const orderResult = {
        order_code: finalOrderCode,
        shipping_name: currentPendingQrOrder.name,
        shipping_phone: currentPendingQrOrder.phone,
        shipping_address: currentPendingQrOrder.address,
        payment_method: "chuyển khoản",
        subtotal_amount: orderedSubtotal,
        shipping_fee: orderedShipping,
        discount_amount: discount,
        voucher_code: appliedVoucher ? appliedVoucher.code : null,
        total_amount: orderedTotal,
        items: orderedItems,
        created_at: now.toISOString(),
        status: "PENDING"
      };

      // Lưu đơn vào danh sách đơn demo
      const savedOrders = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || "[]");
      savedOrders.unshift(orderResult);
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(savedOrders));

      // Cập nhật trạng thái Stepper sang Bước 3 Hoàn tất
      setStepperCompleted();

      // Chỉ lưu lại các sản phẩm CHƯA ĐƯỢC CHỌN trong giỏ hàng
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(remainingItems));
      currentCartState.items = remainingItems;
      selectedProductIds = new Set(remainingItems.map(it => it.product_id));
      recalculateState();
      renderCart();
    }

    // Đóng modal và dừng đếm ngược (không chuyển về COD vì đã thanh toán thành công)
    closeQRPaymentModal(false);

    if (typeof showToast === "function") {
      showToast(`Thanh toán thành công đơn hàng ${finalOrderCode}! Đang chuyển đến Đơn mua của bạn...`, "success");
    }

    // Chuyển hướng sang trang "Đơn mua của tôi" sau 600ms
    setTimeout(() => {
      window.location.href = `my_orders.html?order_code=${encodeURIComponent(finalOrderCode)}`;
    }, 600);

  } catch (err) {
    const errorMsg = err.message || "Có lỗi xảy ra khi xác nhận thanh toán. Vui lòng thử lại.";
    if (typeof showToast === "function") {
      showToast(errorMsg, "error");
    } else {
      alert(errorMsg);
    }
  } finally {
    if (btnConfirm) btnConfirm.disabled = false;
    if (btnSpinner) btnSpinner.style.display = "none";
    if (checkIcon) checkIcon.style.display = "inline-block";
    if (confirmText) confirmText.textContent = "Tôi đã thanh toán thành công";
  }
}

/**
 * Đóng Modal QR và xử lý khi khách hàng chọn lại phương thức thanh toán
 */
function closeQRPaymentModal(switchBackToCod = false) {
  const modal = document.getElementById("qr-payment-modal");
  if (modal) modal.classList.remove("active");

  if (qrCountdownInterval) {
    clearInterval(qrCountdownInterval);
    qrCountdownInterval = null;
  }

  // Hủy thông tin đơn hàng tạm đang chờ
  currentPendingQrOrder = null;

  // Nếu khách hàng bấm "Chọn lại phương thức thanh toán" hoặc đóng modal mà chưa thanh toán
  if (switchBackToCod) {
    // 1. Tự động chuyển radio chọn thanh toán về COD
    const radioCod = document.getElementById("payment-radio-cod");
    const radioBank = document.getElementById("payment-radio-bank");
    const labelCod = document.getElementById("payment-label-cod");
    const labelBank = document.getElementById("payment-label-bank");

    if (radioCod) radioCod.checked = true;
    if (radioBank) radioBank.checked = false;
    if (labelCod) labelCod.classList.add("active");
    if (labelBank) labelBank.classList.remove("active");

    // 2. Cập nhật lại text nút đặt hàng chính
    const btnOrderText = document.getElementById("btn-order-text");
    const selectedCount = selectedProductIds.size;
    if (btnOrderText && selectedCount > 0) {
      btnOrderText.textContent = `Đặt hàng ngay (${selectedCount} món)`;
    }

    // 3. Thông báo rõ ràng cho khách hàng rằng các sản phẩm trong giỏ vẫn được giữ nguyên 100%
    if (typeof showToast === "function") {
      showToast("Đã giữ nguyên các sản phẩm trong giỏ hàng. Bạn có thể chọn phương thức COD hoặc thanh toán sau.", "info");
    }
  }
}

/**
 * Tiện ích sao chép vào bộ nhớ tạm kèm hiệu ứng nút
 */
function copyToClipboard(text, btnElement) {
  if (!navigator.clipboard) {
    // Fallback cho trình duyệt cũ
    const tempInput = document.createElement("input");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
  } else {
    navigator.clipboard.writeText(text);
  }

  // Hiệu ứng đổi text nút tạm thời
  if (btnElement) {
    const originalHtml = btnElement.innerHTML;
    btnElement.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.8"><polyline points="20 6 9 17 4 12"/></svg>
      <span style="color: #16a34a; font-weight: 700;">Đã chép!</span>
    `;
    setTimeout(() => {
      btnElement.innerHTML = originalHtml;
    }, 1500);
  }

  if (typeof showToast === "function") {
    showToast(`Đã sao chép: "${text}"`, "success");
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

// ==========================================================
// 8. QUẢN LÝ VOUCHER GIẢM GIÁ (CHỈ DÙNG VOUCHER ĐỔI TỪ ĐIỂM THƯỞNG)
// ==========================================================

/**
 * Lấy danh sách voucher hợp lệ người dùng thực sự sở hữu (chưa sử dụng)
 */
function getAllAvailableVouchers() {
  return userVouchersList.filter(v => Number(v.is_used || 0) === 0);
}

/**
 * Tải số điểm thưởng và danh sách voucher của người dùng từ Backend
 */
async function loadUserVouchers() {
  const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
  if (!token || typeof api === "undefined" || !api.get) return;

  try {
    const res = await api.get("/auth/me/reward-points");
    if (res) {
      userRewardPoints = Number(res.reward_points || 0);
      const pointsElem = document.getElementById("user-points-val");
      if (pointsElem) pointsElem.textContent = userRewardPoints;

      if (Array.isArray(res.vouchers)) {
        userVouchersList = res.vouchers
          .filter(v => Number(v.is_used || 0) === 0)
          .map(v => {
            const vtype = v.voucher_type || "fixed";
            let descText = "";
            if (vtype === "freeship") {
              descText = `Miễn phí vận chuyển (tối đa ${formatMoney(v.discount_amount || 30000)}) cho đơn từ ${formatMoney(v.min_order_value || 0)}`;
            } else if (vtype === "percent") {
              const maxD = v.max_discount ? ` (Tối đa ${formatMoney(v.max_discount)})` : "";
              descText = `Giảm ${v.percent}%${maxD} cho đơn từ ${formatMoney(v.min_order_value || 0)}`;
            } else {
              descText = v.min_order_value > 0 ? `Đơn tối thiểu ${formatMoney(v.min_order_value)}` : "Mọi giá trị đơn hàng";
            }

            return {
              code: String(v.code).toUpperCase(),
              title: v.title || `Voucher ${v.code}`,
              discount_amount: Number(v.discount_amount || 0),
              min_order_value: Number(v.min_order_value || 0),
              type: vtype,
              percent: Number(v.percent || 0),
              max_discount: Number(v.max_discount || 0),
              expiry: v.expires_at ? new Date(v.expires_at).toLocaleDateString("vi-VN") : "30 ngày sau khi đổi",
              desc: descText
            };
          });
      }
    }
  } catch (_) {
    userVouchersList = [];
    userRewardPoints = 0;
  }
}

/**
 * Đồng bộ giao diện Thanh Voucher nhỏ gọn ngay trên nút Đặt hàng
 */
function syncVoucherSectionUI(selectedSubtotal, actualDiscount) {
  const unselectedBar = document.getElementById("voucher-bar-unselected");
  const selectedBar = document.getElementById("voucher-bar-selected");
  const appliedCodeElem = document.getElementById("applied-voucher-code");
  const appliedDescElem = document.getElementById("applied-voucher-desc");

  if (appliedVoucher) {
    if (unselectedBar) unselectedBar.style.display = "none";
    if (selectedBar) selectedBar.style.display = "flex";
    if (appliedCodeElem) appliedCodeElem.textContent = appliedVoucher.code;
    if (appliedDescElem) {
      if (actualDiscount > 0) {
        appliedDescElem.textContent = `Giảm ${formatMoney(actualDiscount)}`;
      } else {
        appliedDescElem.textContent = `Cần đơn từ ${formatMoney(appliedVoucher.min_order_value || 0)}`;
      }
    }
  } else {
    if (unselectedBar) unselectedBar.style.display = "flex";
    if (selectedBar) selectedBar.style.display = "none";
  }
}

/**
 * Áp dụng một mã voucher
 */
function applyVoucher(code) {
  if (!code || !code.trim()) {
    if (typeof showToast === "function") {
      showToast("Vui lòng nhập mã giảm giá!", "warning");
    }
    return;
  }

  const cleanCode = code.trim().toUpperCase();
  const allVouchers = getAllAvailableVouchers();
  const voucher = allVouchers.find(v => v.code.toUpperCase() === cleanCode);

  if (!voucher) {
    if (typeof showToast === "function") {
      showToast(`Bạn chưa sở hữu mã voucher "${cleanCode}". Hãy đổi điểm thưởng để nhận voucher!`, "error");
    } else {
      alert(`Bạn chưa sở hữu mã voucher "${cleanCode}". Hãy đổi điểm thưởng để nhận voucher!`);
    }
    return;
  }

  // Lọc tổng tiền các món đang được tích chọn
  const selectedItems = currentCartState.items.filter(it => selectedProductIds.has(it.product_id));
  const selectedSubtotal = selectedItems.reduce((s, it) => s + (it.price * it.quantity), 0);

  if (selectedSubtotal < (voucher.min_order_value || 0)) {
    const diff = (voucher.min_order_value || 0) - selectedSubtotal;
    if (typeof showToast === "function") {
      showToast(`Mã ${voucher.code} áp dụng cho đơn từ ${formatMoney(voucher.min_order_value)}. Hãy mua thêm ${formatMoney(diff)} để sử dụng!`, "warning");
    }
  }

  appliedVoucher = voucher;
  renderSummarySidebar();

  // Đóng modal voucher nếu đang mở
  closeVoucherModal();

  // Xóa trắng input
  const inputModal = document.getElementById("modal-voucher-input");
  if (inputModal) inputModal.value = "";

  if (typeof showToast === "function") {
    showToast(`Đã áp dụng mã giảm giá ${voucher.code}!`, "success");
  }
}

/**
 * Bỏ áp dụng mã voucher
 */
function removeVoucher() {
  if (!appliedVoucher) return;
  const oldCode = appliedVoucher.code;
  appliedVoucher = null;
  renderSummarySidebar();
  if (typeof showToast === "function") {
    showToast(`Đã hủy áp dụng mã ${oldCode}.`, "info");
  }
}

// Danh sách các gói quy đổi điểm thưởng chuẩn đồng bộ hệ thống ShopEase
const AVAILABLE_REDEEM_TIERS = [
  { tier_id: "FREESHIP_15K", title: "FreeShip - Giảm 15.000₫ phí ship", voucher_type: "freeship", points_required: 50, discount_amount: 15000, min_order_value: 100000, percent: 0, max_discount: 15000 },
  { tier_id: "FREESHIP_MAX", title: "FreeShip Xtra - Miễn phí vận chuyển 100% (tối đa 30.000₫)", voucher_type: "freeship", points_required: 100, discount_amount: 30000, min_order_value: 150000, percent: 0, max_discount: 30000 },
  { tier_id: "VOUCHER_PCT_10", title: "Giảm 10% (tối đa 50.000₫)", voucher_type: "percent", percent: 10, max_discount: 50000, points_required: 120, discount_amount: 0, min_order_value: 200000 },
  { tier_id: "VOUCHER_PCT_20", title: "Giảm 20% (tối đa 100.000₫)", voucher_type: "percent", percent: 20, max_discount: 100000, points_required: 220, discount_amount: 0, min_order_value: 300000 },
  { tier_id: "VOUCHER_PCT_30", title: "Giảm 30% (tối đa 200.000₫)", voucher_type: "percent", percent: 30, max_discount: 200000, points_required: 350, discount_amount: 0, min_order_value: 500000 },
  { tier_id: "VOUCHER_PCT_50", title: "Giảm 50% Siêu Sale (tối đa 500.000₫)", voucher_type: "percent", percent: 50, max_discount: 500000, points_required: 650, discount_amount: 0, min_order_value: 800000 },
  { tier_id: "VOUCHER_PCT_70", title: "Giảm 70% Khủng Nhất (tối đa 1.000.000₫)", voucher_type: "percent", percent: 70, max_discount: 1000000, points_required: 1200, discount_amount: 0, min_order_value: 1200000 },
  { tier_id: "VOUCHER_20K", title: "Voucher giảm 20.000₫", voucher_type: "fixed", points_required: 80, discount_amount: 20000, min_order_value: 100000, percent: 0, max_discount: 20000 },
  { tier_id: "VOUCHER_50K", title: "Voucher giảm 50.000₫", voucher_type: "fixed", points_required: 160, discount_amount: 50000, min_order_value: 250000, percent: 0, max_discount: 50000 },
  { tier_id: "VOUCHER_100K", title: "Voucher giảm 100.000₫", voucher_type: "fixed", points_required: 280, discount_amount: 100000, min_order_value: 500000, percent: 0, max_discount: 100000 },
  { tier_id: "VOUCHER_200K", title: "Voucher giảm 200.000₫", voucher_type: "fixed", points_required: 480, discount_amount: 200000, min_order_value: 800000, percent: 0, max_discount: 200000 },
  { tier_id: "VOUCHER_500K", title: "Voucher giảm 500.000₫ Siêu Ưu Đãi", voucher_type: "fixed", points_required: 950, discount_amount: 500000, min_order_value: 1500000, percent: 0, max_discount: 500000 },
  { tier_id: "VOUCHER_1M", title: "Voucher giảm 1.000.000₫ Siêu VIP", voucher_type: "fixed", points_required: 1600, discount_amount: 1000000, min_order_value: 3000000, percent: 0, max_discount: 1000000 }
];

let currentVoucherModalTab = "my-vouchers"; // "my-vouchers" | "redeem-tiers"
let currentRedeemFilter = "all"; // "all" | "freeship" | "percent" | "fixed"

/**
 * Chuyển đổi tab trong Voucher Modal
 */
function switchVoucherModalTab(tabName) {
  currentVoucherModalTab = tabName;

  const btnMyVouchers = document.getElementById("tab-btn-my-vouchers");
  const btnRedeemTiers = document.getElementById("tab-btn-redeem-vouchers");
  const paneMyVouchers = document.getElementById("pane-my-vouchers");
  const paneRedeemTiers = document.getElementById("pane-redeem-tiers");
  const btnFooterToggle = document.getElementById("btn-footer-toggle-tab");

  if (tabName === "redeem-tiers") {
    btnMyVouchers?.classList.remove("active");
    btnRedeemTiers?.classList.add("active");
    if (paneMyVouchers) paneMyVouchers.style.display = "none";
    if (paneRedeemTiers) paneRedeemTiers.style.display = "block";
    if (btnFooterToggle) btnFooterToggle.textContent = "🎟️ Xem voucher của bạn";
    renderVoucherRedeemTiers(currentRedeemFilter);
  } else {
    btnRedeemTiers?.classList.remove("active");
    btnMyVouchers?.classList.add("active");
    if (paneRedeemTiers) paneRedeemTiers.style.display = "none";
    if (paneMyVouchers) paneMyVouchers.style.display = "block";
    if (btnFooterToggle) btnFooterToggle.textContent = "🎁 Đổi voucher bằng điểm";
    renderVoucherModalCards();
  }
}

/**
 * Render danh sách các gói đổi voucher bằng điểm thưởng (Tab 2)
 */
function renderVoucherRedeemTiers(filter = "all") {
  const container = document.getElementById("redeem-tiers-grid");
  const pointsBadge = document.getElementById("redeem-pane-points-val");
  const bannerPoints = document.getElementById("user-points-val");

  if (pointsBadge) pointsBadge.textContent = userRewardPoints;
  if (bannerPoints) bannerPoints.textContent = userRewardPoints;

  if (!container) return;

  const filteredTiers = AVAILABLE_REDEEM_TIERS.filter(tier => {
    if (filter === "all") return true;
    return tier.voucher_type === filter;
  });

  if (filteredTiers.length === 0) {
    container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 24px; color: #64748b;">Không có gói ưu đãi nào thuộc danh mục này.</div>`;
    return;
  }

  container.innerHTML = filteredTiers.map(tier => {
    const canRedeem = userRewardPoints >= tier.points_required;
    const missingPoints = tier.points_required - userRewardPoints;

    let conditionText = tier.min_order_value > 0
      ? `Đơn tối thiểu ${formatMoney(tier.min_order_value)}`
      : "Mọi giá trị đơn hàng";

    return `
      <div class="redeem-tier-card">
        <div>
          <div class="tier-card-header">
            <span class="tier-card-title">${escapeHtml(tier.title)}</span>
            <span class="tier-points-tag">🪙 ${tier.points_required} điểm</span>
          </div>
          <div class="tier-card-condition">${conditionText}</div>
        </div>
        <div>
          ${canRedeem
            ? `<button type="button" class="btn-redeem-action can-redeem" data-redeem-tier="${tier.tier_id}">🎁 Đổi ngay</button>`
            : `<button type="button" class="btn-redeem-action need-more" disabled title="Bạn cần thêm ${missingPoints} điểm">Cần thêm ${missingPoints} điểm</button>`
          }
        </div>
      </div>
    `;
  }).join("");

  // Gắn sự kiện click đổi voucher
  container.querySelectorAll(".btn-redeem-action.can-redeem").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tierId = btn.getAttribute("data-redeem-tier");
      if (tierId) await handleRedeemVoucher(tierId);
    });
  });
}

/**
 * Thực hiện quy đổi điểm thưởng lấy mã giảm giá
 */
async function handleRedeemVoucher(tierId) {
  const tier = AVAILABLE_REDEEM_TIERS.find(t => t.tier_id === tierId);
  if (!tier) return;

  if (userRewardPoints < tier.points_required) {
    const missing = tier.points_required - userRewardPoints;
    if (typeof showToast === "function") {
      showToast(`Bạn cần thêm ${missing} điểm để đổi gói ưu đãi này!`, "warning");
    } else {
      alert(`Bạn cần thêm ${missing} điểm để đổi gói ưu đãi này!`);
    }
    return;
  }

  const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
  let newVoucher = null;

  // A. Thử gọi API backend nếu đã đăng nhập
  if (token && typeof api !== "undefined" && api.post) {
    try {
      const res = await api.post("/auth/me/redeem-voucher", { tier_id: tierId });
      newVoucher = res?.data || res;
    } catch (errApi) {
      console.warn("Chưa gọi được API đổi voucher, chuyển sang lưu trữ cục bộ:", errApi);
    }
  }

  // B. Fallback cục bộ / demo
  if (!newVoucher || !newVoucher.code) {
    const codeSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    newVoucher = {
      code: `${tier.tier_id.substring(0, 8)}_${codeSuffix}`,
      title: tier.title,
      voucher_type: tier.voucher_type,
      discount_amount: tier.discount_amount,
      percent: tier.percent,
      max_discount: tier.max_discount,
      min_order_value: tier.min_order_value,
      is_used: 0,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  // Khấu trừ điểm thưởng
  userRewardPoints = Math.max(0, userRewardPoints - tier.points_required);

  // Thêm vào danh sách voucher
  const vtype = newVoucher.voucher_type || tier.voucher_type || "fixed";
  let descText = "";
  if (vtype === "freeship") {
    descText = `Miễn phí vận chuyển (tối đa ${formatMoney(newVoucher.discount_amount || 30000)}) cho đơn từ ${formatMoney(newVoucher.min_order_value || 0)}`;
  } else if (vtype === "percent") {
    const maxD = newVoucher.max_discount ? ` (Tối đa ${formatMoney(newVoucher.max_discount)})` : "";
    descText = `Giảm ${newVoucher.percent}%${maxD} cho đơn từ ${formatMoney(newVoucher.min_order_value || 0)}`;
  } else {
    descText = newVoucher.min_order_value > 0 ? `Đơn tối thiểu ${formatMoney(newVoucher.min_order_value)}` : "Mọi giá trị đơn hàng";
  }

  const normalizedVoucher = {
    code: String(newVoucher.code).toUpperCase(),
    title: newVoucher.title || tier.title,
    discount_amount: Number(newVoucher.discount_amount || 0),
    min_order_value: Number(newVoucher.min_order_value || 0),
    type: vtype,
    percent: Number(newVoucher.percent || 0),
    max_discount: Number(newVoucher.max_discount || 0),
    expiry: "30 ngày sau khi đổi",
    desc: descText
  };

  userVouchersList.unshift(normalizedVoucher);

  // Cập nhật lại các vị trí hiển thị điểm
  const pointsElem = document.getElementById("user-points-val");
  const panePoints = document.getElementById("redeem-pane-points-val");
  if (pointsElem) pointsElem.textContent = userRewardPoints;
  if (panePoints) panePoints.textContent = userRewardPoints;

  // Cập nhật số lượng voucher
  const countBadge = document.getElementById("my-vouchers-count");
  if (countBadge) countBadge.textContent = userVouchersList.length;

  if (typeof showToast === "function") {
    showToast(`🎉 Đổi thành công mã giảm giá ${normalizedVoucher.code}!`, "success");
  }

  // Tự động chuyển về Tab 1 và áp dụng ngay voucher vừa đổi cho đơn hàng
  switchVoucherModalTab("my-vouchers");
  applyVoucher(normalizedVoucher.code);
}

/**
 * Mở modal chọn voucher và render danh sách voucher
 */
function openVoucherModal() {
  const modal = document.getElementById("voucher-select-modal");
  if (!modal) return;

  // Đồng bộ số điểm hiện tại
  const pointsElem = document.getElementById("user-points-val");
  const panePoints = document.getElementById("redeem-pane-points-val");
  if (pointsElem) pointsElem.textContent = userRewardPoints;
  if (panePoints) panePoints.textContent = userRewardPoints;

  // Mặc định mở Tab Voucher của bạn
  switchVoucherModalTab("my-vouchers");
  modal.classList.add("active");
}

/**
 * Đóng modal chọn voucher
 */
function closeVoucherModal() {
  const modal = document.getElementById("voucher-select-modal");
  if (modal) modal.classList.remove("active");
}

/**
 * Render danh sách thẻ Voucher trong Modal (Hiển thị trống nếu chưa có voucher nào)
 */
function renderVoucherModalCards() {
  const container = document.getElementById("voucher-cards-list");
  const noteElem = document.getElementById("voucher-eligible-note");
  const pointsElem = document.getElementById("user-points-val");
  const countBadge = document.getElementById("my-vouchers-count");
  if (!container) return;

  if (pointsElem) pointsElem.textContent = userRewardPoints;

  const selectedItems = currentCartState.items.filter(it => selectedProductIds.has(it.product_id));
  const selectedSubtotal = selectedItems.reduce((s, it) => s + (it.price * it.quantity), 0);
  const allVouchers = getAllAvailableVouchers();

  if (countBadge) countBadge.textContent = allVouchers.length;

  if (noteElem) {
    noteElem.textContent = `Tạm tính: ${formatMoney(selectedSubtotal)}`;
  }

  // TRƯỜNG HỢP 1: Tài khoản chưa có voucher nào (chưa đổi điểm)
  if (allVouchers.length === 0) {
    container.innerHTML = `
      <div class="voucher-empty-state">
        <div class="voucher-empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
        </div>
        <div class="voucher-empty-title">Bạn chưa có voucher giảm giá nào</div>
        <div class="voucher-empty-desc">Hãy quy đổi điểm thưởng tích lũy từ các đơn hàng để nhận ngay mã giảm giá lên đến 1.000.000₫!</div>

        <!-- NÚT BỔ SUNG ĐỂ ĐỔI VOUCHER NGAY -->
        <button type="button" class="btn-empty-redeem-cta" id="btn-empty-redeem-cta">
          🎁 Đổi voucher bằng điểm thưởng ngay
        </button>

        <div class="voucher-points-guide-box">
          <div style="font-weight: 700; color: #00288e; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>💡</span> <span>Quy tắc tích lũy điểm thưởng ShopEase:</span>
          </div>
          <div>• Đơn hàng có mức chi tiêu <strong>trên 500.000₫</strong> sẽ được tích điểm khi được <strong>Admin duyệt đơn</strong>.</div>
          <div>• Với mỗi <strong>10.000₫</strong> vượt mức 500.000₫ sẽ nhận được <strong>1 điểm thưởng</strong>.</div>
          <div style="margin-top: 6px; color: #64748b; font-style: italic;">(Ví dụ: Đơn 490k: 0 điểm | Đơn 510k: nhận 1 điểm | Đơn 600k: nhận 10 điểm).</div>
        </div>

        <div style="margin-top: 14px; font-size: 13px; color: #475569;">
          Điểm thưởng hiện có: <strong style="color: #d97706; font-size: 15.5px;">${userRewardPoints}</strong> điểm
        </div>
      </div>
    `;

    // Gắn sự kiện click nút đổi voucher trong empty state
    const emptyRedeemBtn = document.getElementById("btn-empty-redeem-cta");
    if (emptyRedeemBtn) {
      emptyRedeemBtn.addEventListener("click", () => {
        switchVoucherModalTab("redeem-tiers");
      });
    }

    return;
  }

  // TRƯỜNG HỢP 2: Đã có voucher do đổi điểm thưởng
  container.innerHTML = allVouchers.map(v => {
    const isApplied = appliedVoucher && appliedVoucher.code.toUpperCase() === v.code.toUpperCase();
    const isEligible = selectedSubtotal >= (v.min_order_value || 0);

    let discountDisplay = "";
    if (v.type === "freeship") {
      discountDisplay = "FreeShip";
    } else if (v.type === "percent") {
      discountDisplay = `Giảm ${v.percent}%`;
    } else {
      discountDisplay = `-${formatMoney(v.discount_amount)}`;
    }

    let cardClass = "voucher-ticket-card";
    if (isApplied) cardClass += " is-applied";
    else if (!isEligible) cardClass += " is-disabled";

    let btnHtml = "";
    if (isApplied) {
      btnHtml = `<button type="button" class="btn-ticket-action btn-applied" disabled>✓ Đang dùng</button>`;
    } else if (isEligible) {
      btnHtml = `<button type="button" class="btn-ticket-action btn-apply" data-apply-code="${escapeHtml(v.code)}">Áp dụng</button>`;
    } else {
      const diff = (v.min_order_value || 0) - selectedSubtotal;
      btnHtml = `<button type="button" class="btn-ticket-action btn-disabled" title="Cần mua thêm ${formatMoney(diff)}" data-apply-code="${escapeHtml(v.code)}">Mua thêm</button>`;
    }

    return `
      <div class="${cardClass}">
        <div class="ticket-left-side">
          <span class="ticket-badge-tag">${escapeHtml(v.code)}</span>
          <span class="ticket-discount-text">${discountDisplay}</span>
        </div>
        <div class="ticket-right-side">
          <div>
            <div class="ticket-title">${escapeHtml(v.title)}</div>
            <div class="ticket-condition">${escapeHtml(v.desc)}</div>
          </div>
          <div class="ticket-bottom-bar">
            <span class="ticket-expiry">HSD: ${v.expiry || "30 ngày sau khi đổi"}</span>
            ${btnHtml}
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Gắn sự kiện click nút Áp dụng trên từng thẻ voucher
  container.querySelectorAll(".btn-ticket-action[data-apply-code]").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-apply-code");
      if (code) applyVoucher(code);
    });
  });
}

/**
 * Gắn các sự kiện cho thanh Voucher nhỏ gọn và Modal Voucher
 */
function setupVoucherEvents() {
  const compactBar = document.getElementById("cart-voucher-compact-bar");
  const btnChangeVoucher = document.getElementById("btn-change-voucher");
  const btnCloseModal = document.getElementById("btn-close-voucher-modal");
  const btnFooterClose = document.getElementById("btn-footer-close-voucher");
  const modal = document.getElementById("voucher-select-modal");

  // Bấm vào thanh nhỏ gọn hoặc nút đổi mã -> mở popup
  if (compactBar) {
    compactBar.addEventListener("click", (e) => {
      if (e.target.closest("#btn-remove-voucher")) return;
      openVoucherModal();
    });
  }
  if (btnChangeVoucher) {
    btnChangeVoucher.addEventListener("click", (e) => {
      e.stopPropagation();
      openVoucherModal();
    });
  }

  // Đóng modal
  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", closeVoucherModal);
  }
  if (btnFooterClose) {
    btnFooterClose.addEventListener("click", closeVoucherModal);
  }
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeVoucherModal();
    });
  }

  // Chuyển tab trong modal
  const tabBtnMy = document.getElementById("tab-btn-my-vouchers");
  const tabBtnRedeem = document.getElementById("tab-btn-redeem-vouchers");
  const btnBannerRedeem = document.getElementById("btn-banner-redeem-tab");
  const btnFooterToggle = document.getElementById("btn-footer-toggle-tab");
  const btnShowRule = document.getElementById("btn-show-points-rule");

  if (tabBtnMy) {
    tabBtnMy.addEventListener("click", () => switchVoucherModalTab("my-vouchers"));
  }
  if (tabBtnRedeem) {
    tabBtnRedeem.addEventListener("click", () => switchVoucherModalTab("redeem-tiers"));
  }
  if (btnBannerRedeem) {
    btnBannerRedeem.addEventListener("click", () => switchVoucherModalTab("redeem-tiers"));
  }
  if (btnFooterToggle) {
    btnFooterToggle.addEventListener("click", () => {
      if (currentVoucherModalTab === "my-vouchers") {
        switchVoucherModalTab("redeem-tiers");
      } else {
        switchVoucherModalTab("my-vouchers");
      }
    });
  }
  if (btnShowRule) {
    btnShowRule.addEventListener("click", () => {
      if (typeof showToast === "function") {
        showToast("Quy tắc: Đơn hàng trên 500k sẽ nhận 1 điểm thưởng cho mỗi 10k vượt 500k khi được Admin duyệt đơn!", "info");
      } else {
        alert("Quy tắc: Đơn hàng trên 500k sẽ nhận 1 điểm thưởng cho mỗi 10k vượt 500k khi được Admin duyệt đơn!");
      }
    });
  }

  // Filter chips trong Tab 2
  const filterChips = document.querySelectorAll(".redeem-chip");
  filterChips.forEach(chip => {
    chip.addEventListener("click", () => {
      filterChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentRedeemFilter = chip.getAttribute("data-filter") || "all";
      renderVoucherRedeemTiers(currentRedeemFilter);
    });
  });

  // Nút xóa mã voucher
  const btnRemove = document.getElementById("btn-remove-voucher");
  if (btnRemove) {
    btnRemove.addEventListener("click", (e) => {
      e.stopPropagation();
      removeVoucher();
    });
  }

  // Nhập mã ở Modal
  const btnApplyModal = document.getElementById("btn-modal-apply-code");
  const inputModal = document.getElementById("modal-voucher-input");
  if (btnApplyModal && inputModal) {
    btnApplyModal.addEventListener("click", () => {
      applyVoucher(inputModal.value);
    });
    inputModal.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyVoucher(inputModal.value);
      }
    });
  }
}

// ==========================================================
// TỰ ĐỘNG ĐỒNG BỘ KHI XÓA ĐỊA CHỈ Ở SỔ ĐỊA CHỈ (PROFILE.HTML)
// ==========================================================
window.addEventListener("storage", (e) => {
  if (e.key === SHIPPING_INFO_KEY || e.key === "shopease_address_cleared") {
    initShippingFormAutofill();
  }
});

// Tự động kiểm tra và cập nhật khi người dùng chuyển lại tab Giỏ hàng
window.addEventListener("focus", () => {
  initShippingFormAutofill();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    initShippingFormAutofill();
  }
});
