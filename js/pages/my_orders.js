// ==========================================================
// SHOPEASE - MY ORDERS & REAL-TIME TRACKING SCRIPT (my_orders.js)
// Thiết kế khớp chuẩn Figma: ShopEase - Đơn mua của tôi & Theo dõi đơn hàng
// Đáp ứng nghiệp vụ: FR-025, FR-027, FR-028, BR-08, BR-09
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
  // 1. KIỂM TRA ĐĂNG NHẬP
  const token = localStorage.getItem("token");
  let user = typeof Auth !== "undefined" ? Auth.getUser() : null;
  if (!user) {
    try {
      user = JSON.parse(localStorage.getItem("user") || "null");
    } catch (_) {}
  }

  if (!token || !user || !user.id) {
    if (typeof Auth !== "undefined" && Auth.clearSession) {
      Auth.clearSession();
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    sessionStorage.setItem(
      "auth_message",
      !token ? "Vui lòng đăng nhập để xem đơn mua của bạn." : "Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại."
    );
    const redirectUrl = window.location.pathname + window.location.search;
    window.location.href = `../pages/login.html?redirect=${encodeURIComponent(redirectUrl)}`;
    return;
  }

  // 2. KHỞI TẠO BIẾN TRẠNG THÁI
  let currentStatus = "";      // Rỗng = Tất cả đơn
  let currentPage = 1;
  const pageSize = 10;
  let allOrders = [];
  let currentCancelOrderId = null;

  // Bảng ánh xạ trạng thái sang nhãn tiếng Việt & class giao diện
  const STATUS_MAP = {
    PENDING: { label: "Chờ xác nhận", class: "status-pending", step: 1 },
    CONFIRMED: { label: "Đã xác nhận", class: "status-confirmed", step: 2 },
    SHIPPING: { label: "Đang giao hàng", class: "status-shipping", step: 3 },
    DELIVERED: { label: "Hoàn thành", class: "status-completed", step: 4 },
    COMPLETED: { label: "Hoàn thành", class: "status-completed", step: 4 },
    CANCELLED: { label: "Đã hủy", class: "status-cancelled", step: 0 }
  };

  function normalizeStatus(st) {
    if (!st) return "PENDING";
    const s = String(st).trim().toLowerCase();
    if (s.includes("chờ") || s.includes("pending")) return "PENDING";
    if (s.includes("xác nhận") || s.includes("confirmed")) return "CONFIRMED";
    if (s.includes("giao") || s.includes("shipping")) return "SHIPPING";
    if (s.includes("hoàn thành") || s.includes("completed") || s.includes("delivered") || s.includes("thành công") || s.includes("đã giao")) return "COMPLETED";
    if (s.includes("hủy") || s.includes("cancel")) return "CANCELLED";
    return s.toUpperCase();
  }

  function getItemImageUrl(path) {
    if (!path) return "../assets/images/logo_shop.svg";
    if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
    const apiBase = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL.replace(/\/api\/?$/, "") : "";
    return `${apiBase}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  // Các phần tử DOM
  const ordersContainer = document.getElementById("orders-container");
  const searchInput = document.getElementById("order-search-input");
  const summaryText = document.getElementById("orders-summary-text");
  const statusTabButtons = document.querySelectorAll(".order-tab-btn");
  const paginationContainer = document.getElementById("orders-pagination");

  // User Profile DOM
  const userDisplayName = document.getElementById("user-display-name");
  const userAvatarInitials = document.getElementById("user-avatar-initials");
  const userDisplayCode = document.getElementById("user-display-code");
  const userOrdersCountText = document.getElementById("user-orders-count-text");

  // Metrics DOM
  const metricPending = document.getElementById("metric-pending");
  const metricShipping = document.getElementById("metric-shipping");
  const metricCompleted = document.getElementById("metric-completed");

  // Modals DOM
  const cancelModal = document.getElementById("cancel-order-modal");
  const btnCloseCancelModal = document.getElementById("btn-close-cancel-modal");
  const btnAbortCancel = document.getElementById("btn-abort-cancel");
  const btnSubmitCancel = document.getElementById("btn-submit-cancel");
  const cancelModalOrderCode = document.getElementById("cancel-modal-order-code");
  const cancelReasonPreset = document.getElementById("cancel-reason-preset");
  const cancelReasonDetail = document.getElementById("cancel-reason-detail");
  const cancelCharCount = document.getElementById("cancel-char-count");
  const cancelErrorMsg = document.getElementById("cancel-error-msg");

  const detailModal = document.getElementById("order-detail-modal");
  const btnCloseDetailModal = document.getElementById("btn-close-detail-modal");
  const btnCloseDetailModalFooter = document.getElementById("btn-close-detail-modal-footer");

  // Re-order Modal DOM
  const reorderModal = document.getElementById("reorder-modal");
  const btnCloseReorderModal = document.getElementById("btn-close-reorder-modal");
  const btnCancelReorder = document.getElementById("btn-cancel-reorder");
  const btnReorderAll = document.getElementById("btn-reorder-all");
  const btnSubmitReorder = document.getElementById("btn-submit-reorder");
  const btnSubmitReorderText = document.getElementById("btn-submit-reorder-text");
  const reorderCheckAll = document.getElementById("reorder-check-all");
  const reorderItemsList = document.getElementById("reorder-items-list");
  const reorderSelectedCount = document.getElementById("reorder-selected-count");
  const reorderTotalCount = document.getElementById("reorder-total-count");
  const reorderSummaryQty = document.getElementById("reorder-summary-qty");
  const reorderSummaryTotal = document.getElementById("reorder-summary-total");
  const reorderModalSubtitle = document.getElementById("reorder-modal-subtitle");

  // ==========================================================
  // 3. THIẾT LẬP THÔNG TIN KHÁCH HÀNG (CUSTOMER PROFILE CANVAS)
  // ==========================================================
  function setupCustomerProfile() {
    let user = typeof Auth !== "undefined" ? Auth.getUser() : null;
    if (!user) {
      try {
        user = JSON.parse(localStorage.getItem("user") || "null");
      } catch (_) {}
    }

    if (user) {
      const fullName = user.full_name || user.email || "Khách Hàng";
      if (userDisplayName) userDisplayName.textContent = fullName;
      
      // Tạo ảnh đại diện hoặc chữ viết tắt Avatar (đồng bộ Profile)
      if (userAvatarInitials) {
        if (user.avatar) {
          const apiBase = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL.replace(/\/api\/?$/, "") : "";
          const avatarUrl = user.avatar.startsWith("http") || user.avatar.startsWith("data:")
            ? user.avatar
            : `${apiBase}${user.avatar.startsWith("/") ? "" : "/"}${user.avatar}`;
          userAvatarInitials.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" style="width: 100%; height: 100%; border-radius: inherit; object-fit: cover;" onerror="this.remove()">`;
        } else {
          const words = fullName.trim().split(/\s+/);
          let initials = "KH";
          if (words.length >= 2) {
            initials = (words[0][0] + words[words.length - 1][0]).toUpperCase();
          } else if (words.length === 1 && words[0].length >= 1) {
            initials = words[0].substring(0, 2).toUpperCase();
          }
          userAvatarInitials.textContent = initials;
        }
      }

      if (userDisplayCode) {
        userDisplayCode.textContent = `KH-${String(user.id || 108).padStart(5, "0")}`;
      }
    }
  }

  setupCustomerProfile();

  // Đồng bộ lại thông tin tài khoản mới nhất từ backend
  api.get("/auth/me").then(freshUser => {
    if (freshUser && freshUser.id) {
      localStorage.setItem("user", JSON.stringify(freshUser));
      setupCustomerProfile();
    } else {
      if (typeof Auth !== "undefined" && Auth.clearSession) {
        Auth.clearSession();
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
      sessionStorage.setItem("auth_message", "Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.");
      const redirectUrl = window.location.pathname + window.location.search;
      window.location.href = `../pages/login.html?redirect=${encodeURIComponent(redirectUrl)}`;
    }
  }).catch((err) => {
    if (err && (err.status === 401 || err.status === 404)) {
      return; // api.js interceptor đã xử lý chuyển hướng
    }
    const localUser = typeof Auth !== "undefined" ? Auth.getUser() : null;
    if (!localUser || !localUser.id) {
      if (typeof Auth !== "undefined" && Auth.clearSession) {
        Auth.clearSession();
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
      sessionStorage.setItem("auth_message", "Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.");
      window.location.href = `../pages/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
  });

  let allUserOrdersForCounts = [];

  // Tải danh sách đơn đầy đủ (tối đa 100 đơn) để cập nhật số lượng trên các tab & ribbon
  async function refreshTabCounts() {
    try {
      const res = await api.get("/orders/my", { page: 1, page_size: 50 });
      allUserOrdersForCounts = res.items || [];
      updateCountsAndMetrics(allUserOrdersForCounts);
    } catch (_) {}
  }

  // Cập nhật số liệu Quick Metrics Ribbon & Tab Badges
  function updateCountsAndMetrics(orderList) {
    const list = orderList || allUserOrdersForCounts || allOrders;
    const counts = { all: list.length, PENDING: 0, CONFIRMED: 0, SHIPPING: 0, COMPLETED: 0, CANCELLED: 0 };
    list.forEach(o => {
      const st = normalizeStatus(o.status);
      if (counts[st] !== undefined) counts[st]++;
    });

    const setEl = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    };

    setEl("count-all", counts.all);
    setEl("count-pending", counts.PENDING);
    setEl("count-confirmed", counts.CONFIRMED);
    setEl("count-shipping", counts.SHIPPING);
    setEl("count-completed", counts.COMPLETED);
    setEl("count-cancelled", counts.CANCELLED);

    // Format 2 chữ số cho Quick Metrics Ribbon
    if (metricPending) metricPending.textContent = String(counts.PENDING).padStart(2, "0");
    if (metricShipping) metricShipping.textContent = String(counts.SHIPPING).padStart(2, "0");
    if (metricCompleted) metricCompleted.textContent = String(counts.COMPLETED).padStart(2, "0");
  }

  // ==========================================================
  // 4. TẢI DANH SÁCH ĐƠN HÀNG TỪ BACKEND (GET /api/orders/my)
  // ==========================================================
  async function loadOrders() {
    ordersContainer.innerHTML = `
      <div style="text-align: center; padding: 60px; color: var(--figma-text-muted);">
        <div style="display: inline-block; width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: var(--figma-primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <div style="margin-top: 14px; font-size: 14px; font-weight: 500;">Đang tải danh sách đơn hàng...</div>
      </div>
    `;

    try {
      const params = {
        page: currentPage,
        page_size: pageSize
      };
      if (currentStatus) {
        params.status = currentStatus;
      }

      const res = await api.get("/orders/my", params);
      allOrders = res.items || [];
      const total = res.total || 0;

      // Cập nhật thống kê số lượng
      if (summaryText) summaryText.textContent = `Tổng cộng: ${total} đơn hàng`;
      if (userOrdersCountText) userOrdersCountText.textContent = `${total} đơn`;

      // Cập nhật số liệu tab
      if (!currentStatus && allOrders.length > 0) {
        allUserOrdersForCounts = allOrders;
        updateCountsAndMetrics(allOrders);
      } else {
        refreshTabCounts();
      }

      // Lọc nhanh ô tìm kiếm nếu có nhập từ khóa
      const keyword = (searchInput.value || "").trim().toLowerCase();
      let displayedOrders = allOrders;
      if (keyword) {
        displayedOrders = allOrders.filter(o => 
          (o.order_code && o.order_code.toLowerCase().includes(keyword)) ||
          (o.receiver_phone && o.receiver_phone.includes(keyword)) ||
          (o.receiver_name && o.receiver_name.toLowerCase().includes(keyword)) ||
          (o.items && o.items.some(it => it.product_name && it.product_name.toLowerCase().includes(keyword)))
        );
      }

      renderOrderList(displayedOrders);
      renderPagination(total);
    } catch (error) {
      console.error("Lỗi tải đơn hàng:", error);
      ordersContainer.innerHTML = `
        <div class="orders-empty-state-card">
          <div class="empty-icon-box" style="color: #ef4444;">⚠️</div>
          <h3>Không thể tải danh sách đơn hàng</h3>
          <p>${escapeHtml(error.message || "Đã xảy ra lỗi khi kết nối với máy chủ API.")}</p>
          <button type="button" class="btn-empty-shop" onclick="window.location.reload()">Thử lại</button>
        </div>
      `;
      if (summaryText) summaryText.textContent = "Lỗi kết nối";
    }
  }

  // ==========================================================
  // 5. RENDER DANH SÁCH THẺ ĐƠN HÀNG (ORDER CARDS) THEO FIGMA
  // ==========================================================
  function renderOrderList(orders) {
    if (!orders || orders.length === 0) {
      ordersContainer.innerHTML = `
        <div class="orders-empty-state-card">
          <div class="empty-icon-box">📦</div>
          <h3>Chưa có đơn hàng nào</h3>
          <p>Bạn hiện chưa có đơn hàng nào trong mục này. Khám phá các sản phẩm hot và mua sắm ngay nhé!</p>
          <a href="customer-home.html#products" class="btn-empty-shop">
            Khám phá sản phẩm ngay
          </a>
        </div>
      `;
      return;
    }

    ordersContainer.innerHTML = orders.map(order => {
      const stKey = normalizeStatus(order.status);
      const stInfo = STATUS_MAP[stKey] || { label: stKey, class: "status-pending", step: 1 };
      const isPending = stKey === "PENDING";
      const isShipping = stKey === "SHIPPING";
      const isCompleted = stKey === "COMPLETED";
      const isCancelled = stKey === "CANCELLED";

      const formattedDate = typeof formatDateTime === "function" ? formatDateTime(order.created_at) : order.created_at;
      const formattedTotal = typeof formatMoney === "function" ? formatMoney(order.total_amount) : `${order.total_amount} ₫`;
      const shippingFeeText = (order.shipping_fee === 0 || order.total_amount >= 500000) ? "Miễn phí (Ưu đãi)" : (typeof formatMoney === "function" ? formatMoney(order.shipping_fee) : `${order.shipping_fee} ₫`);
      const paymentText = order.payment_method === "BANK_TRANSFER" || order.payment_method === "chuyển khoản" ? "Chuyển khoản ngân hàng" : "COD khi nhận hàng";

      // 1. Tạo Stepper Tracker Node Classes
      const stepIndex = stInfo.step; // 1: PENDING, 2: CONFIRMED, 3: SHIPPING, 4: COMPLETED
      let fillWidthPercent = "0%";
      if (stepIndex === 1) fillWidthPercent = "0%";
      else if (stepIndex === 2) fillWidthPercent = "33.333%";
      else if (stepIndex === 3) fillWidthPercent = "66.667%";
      else if (stepIndex >= 4) fillWidthPercent = "100%";

      const step1Class = stepIndex > 1 ? "done" : (stepIndex === 1 ? "active" : "");
      const step2Class = stepIndex > 2 ? "done" : (stepIndex === 2 ? "active" : "");
      const step3Class = stepIndex > 3 ? "done" : (stepIndex === 3 ? "active" : "");
      const step4Class = stepIndex >= 4 ? "done" : "";

      // 2. Render danh sách sản phẩm trong đơn (Product Line - 8 cols)
      const items = (order.items && order.items.length > 0) ? order.items : [
        {
          product_name: "Sản phẩm đặt mua tại ShopEase",
          category_name: "Chính hãng ShopEase",
          sku: `DH-${order.order_code}`,
          quantity: 1,
          unit_price: order.total_amount || 0,
          subtotal: order.total_amount || 0,
          image_url: null
        }
      ];

      const productItemsHtml = items.map(item => {
        const itemImg = getItemImageUrl(item.image_url);
        const catName = item.category_name || "Sản phẩm chính hãng ShopEase";
        const skuText = item.sku ? `Mã sản phẩm: ${escapeHtml(item.sku)}` : `Mã đơn vị: SP-${item.product_id || "001"}`;
        const itemPriceFormatted = typeof formatMoney === "function" ? formatMoney(item.unit_price) : `${item.unit_price} ₫`;
        const itemSubtotalFormatted = typeof formatMoney === "function" ? formatMoney(item.subtotal) : `${item.subtotal} ₫`;

        return `
          <div class="order-product-card">
            <div class="product-img-box">
              <img src="${itemImg}" alt="${escapeHtml(item.product_name)}" onerror="this.src='../assets/images/logo_shop.svg';">
            </div>
            <div class="product-info-col">
              <span class="product-cat-tag">${escapeHtml(catName)}</span>
              <h3 class="product-name-heading" title="${escapeHtml(item.product_name)}">${escapeHtml(item.product_name)}</h3>
              <span class="product-sku-meta">${escapeHtml(skuText)}</span>
              <div class="product-price-qty-row">
                <span class="product-qty-text">
                  Số lượng: <strong>${item.quantity} cái</strong> (${itemPriceFormatted} / cái)
                </span>
                <span class="product-subtotal-price">${itemSubtotalFormatted}</span>
              </div>
            </div>
          </div>
        `;
      }).join("");

      // 3. Khối thông tin Live Shipping Track nếu đơn đang giao
      const liveShippingHtml = isShipping ? `
        <div class="live-shipping-track-card">
          <div class="shipping-icon-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          </div>
          <div class="shipping-track-content">
            <div class="shipping-driver-info">Đơn vị vận chuyển: ShopEase Express</div>
            <div class="shipping-status-desc">Hàng đã xuất kho trung chuyển lúc 08:30 sáng nay, đang trên tuyến giao tới địa chỉ nhận của bạn.</div>
          </div>
        </div>
      ` : "";

      // 4. Khối nút hành động theo từng trạng thái (Right Col Actions)
      let actionsHtml = "";
      if (isPending) {
        actionsHtml = `
          <button type="button" class="btn-action-cancel btn-trigger-cancel" data-id="${order.id}" data-code="${escapeHtml(order.order_code)}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            Hủy đơn hàng này
          </button>
          <button type="button" class="btn-action-detail btn-trigger-detail" data-id="${order.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            Xem chi tiết & Hóa đơn
          </button>
        `;
      } else if (isShipping) {
        actionsHtml = `
          <button type="button" class="btn-action-locked" title="Đơn hàng đang giao không thể hủy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            Không thể hủy đơn (Đang giao)
          </button>
          <button type="button" class="btn-action-contact" onclick="showToast('Tổng đài hỗ trợ vận đơn: 1900 6868 (Miễn phí từ 8h - 21h)', 'info')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            Liên hệ hỗ trợ đơn hàng
          </button>
        `;
      } else if (isCompleted) {
        actionsHtml = `
          <button type="button" class="btn-action-reorder btn-trigger-reorder" data-id="${order.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
            Mua lại sản phẩm này
          </button>
          <div class="reorder-sub-actions">
            <button type="button" class="btn-sub-action btn-trigger-order-review" data-id="${order.id}">
              ⭐ Đánh giá
            </button>
            <button type="button" class="btn-sub-action btn-trigger-print-invoice" data-id="${order.id}">
              📄 In hóa đơn
            </button>
          </div>
        `;
      } else if (isCancelled) {
        actionsHtml = `
          <button type="button" class="btn-action-reorder btn-trigger-reorder" data-id="${order.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
            Mua lại sản phẩm này
          </button>
          <button type="button" class="btn-action-detail btn-trigger-detail" data-id="${order.id}">
            Xem chi tiết đơn đã hủy
          </button>
        `;
      } else {
        actionsHtml = `
          <button type="button" class="btn-action-detail btn-trigger-detail" data-id="${order.id}">
            Xem chi tiết & Hóa đơn
          </button>
        `;
      }

      // 5. Thanh Tracker hoặc Banner Hủy
      const trackerHtml = isCancelled ? `
        <div class="cancelled-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <div>
            <strong>Đơn hàng đã được hủy thành công.</strong>
            <div>Lý do: <em>${escapeHtml(order.cancel_reason || "Khách hàng yêu cầu hủy đơn")}</em></div>
          </div>
        </div>
      ` : `
        <div class="linear-tracker-box">
          <div class="tracker-title">TIẾN TRÌNH XỬ LÝ ĐƠN HÀNG</div>
          <div class="tracker-stepper-track">
            <div class="tracker-line-bar">
              <div class="tracker-line-fill" style="width: ${fillWidthPercent};"></div>
            </div>

            <div class="stepper-step-col ${step1Class}">
              <div class="step-node-circle">
                ${step1Class === "done" ? "✓" : "1"}
              </div>
              <span class="step-label">Chờ xác nhận</span>
              <span class="step-subtext">Đã tạo đơn</span>
            </div>

            <div class="stepper-step-col ${step2Class}">
              <div class="step-node-circle">
                ${step2Class === "done" ? "✓" : "2"}
              </div>
              <span class="step-label">Đã xác nhận</span>
              <span class="step-subtext">${stepIndex >= 2 ? "Duyệt kho" : "--"}</span>
            </div>

            <div class="stepper-step-col ${step3Class}">
              <div class="step-node-circle">
                ${step3Class === "done" ? "✓" : "3"}
              </div>
              <span class="step-label">Đang giao</span>
              <span class="step-subtext">${stepIndex >= 3 ? "Bưu cục Q.1" : "--"}</span>
            </div>

            <div class="stepper-step-col ${step4Class}">
              <div class="step-node-circle">
                ${step4Class === "done" ? "✓" : "4"}
              </div>
              <span class="step-label">Hoàn thành</span>
              <span class="step-subtext">${stepIndex >= 4 ? "Thành công" : "--"}</span>
            </div>
          </div>
        </div>
      `;

      return `
        <article class="order-card-frame" data-order-id="${order.id}">
          <!-- Top Status Bar -->
          <div class="order-top-bar">
            <div class="order-top-left">
              <span class="order-code-title">DH-${escapeHtml(order.order_code)}</span>
              <span class="order-date-text">Ngày đặt: ${escapeHtml(formattedDate)} (UTC+7)</span>
              ${isShipping ? `<span class="order-tracking-badge">Vận đơn: SPX-${escapeHtml(order.order_code)}</span>` : ""}
              ${isCompleted && order.completed_at ? `<span class="order-date-text">• Hoàn thành: ${typeof formatDateTime === "function" ? formatDateTime(order.completed_at) : order.completed_at}</span>` : ""}
            </div>
            <span class="status-pill ${stInfo.class}">
              <span class="status-pill-dot"></span>
              ${stInfo.label}
            </span>
          </div>

          <!-- Card Body -->
          <div class="order-card-body">
            <!-- Tiến trình xử lý (Lifecycle Linear Tracker BR-08) -->
            ${trackerHtml}

            <!-- Bento Grid: 8 cột sản phẩm, 4 cột thanh toán/vận chuyển -->
            <div class="order-bento-grid">
              <div class="bento-left-col">
                ${productItemsHtml}
                ${liveShippingHtml}
              </div>

              <div class="bento-right-col">
                <!-- Logistics Address -->
                <div class="logistics-section">
                  <div class="logistics-title-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    <span>Địa chỉ giao nhận COD</span>
                  </div>
                  <div class="receiver-name-phone">${escapeHtml(order.receiver_name)} • ${escapeHtml(order.receiver_phone || "—")}</div>
                  <div class="receiver-address">${escapeHtml(order.shipping_address || "124 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh")}</div>
                </div>

                <!-- Billing Summary -->
                <div class="bill-section">
                  <div class="bill-line-item">
                    <span>Hình thức thanh toán:</span>
                    <span class="val-highlight">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                      ${escapeHtml(paymentText)}
                    </span>
                  </div>
                  <div class="bill-line-item">
                    <span>Phí vận chuyển:</span>
                    <span class="val-highlight">${shippingFeeText}</span>
                  </div>
                  <div class="bill-line-item total-line">
                    <span>Tổng tiền thanh toán:</span>
                    <span class="grand-total-price">${formattedTotal}</span>
                  </div>
                </div>

                <!-- Actions Group -->
                <div class="order-actions-group">
                  ${actionsHtml}
                </div>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    // Gắn sự kiện in hoá đơn trực tiếp từ thẻ đơn hàng
    document.querySelectorAll(".btn-trigger-print-invoice").forEach(btn => {
      btn.addEventListener("click", () => {
        const orderId = btn.getAttribute("data-id");
        if (typeof window.printOrderInvoice === "function") {
          window.printOrderInvoice(orderId);
        } else {
          window.print();
        }
      });
    });

    // Gắn sự kiện click xem chi tiết
    document.querySelectorAll(".btn-trigger-detail").forEach(btn => {
      btn.addEventListener("click", () => {
        const orderId = btn.getAttribute("data-id");
        openOrderDetail(orderId);
      });
    });

    // Gắn sự kiện click hủy đơn (BR-09)
    document.querySelectorAll(".btn-trigger-cancel").forEach(btn => {
      btn.addEventListener("click", () => {
        const orderId = btn.getAttribute("data-id");
        const orderCode = btn.getAttribute("data-code");
        openCancelModal(orderId, orderCode);
      });
    });

    // Gắn sự kiện mua lại sản phẩm
    document.querySelectorAll(".btn-trigger-reorder").forEach(btn => {
      btn.addEventListener("click", () => {
        const orderId = btn.getAttribute("data-id");
        handleReorder(orderId);
      });
    });

    document.querySelectorAll(".btn-trigger-order-review").forEach(btn => {
      btn.addEventListener("click", () => {
        const orderId = btn.getAttribute("data-id");
        const order = allOrders.find(item => String(item.id) === String(orderId));
        const items = order?.items || [];
        if (!items.length) {
          showToast("Không tìm thấy sản phẩm trong đơn hàng này.", "warning");
        } else if (items.length === 1 && items[0].product_id) {
          openProductReview(items[0].product_id);
        } else {
          openOrderDetail(orderId);
        }
      });
    });
  }

  function openProductReview(productId) {
    const target = `product-detail.html?id=${encodeURIComponent(productId)}&review=1#tab-reviews`;
    window.location.href = target;
  }

  // ==========================================================
  // 6. XEM CHI TIẾT ĐƠN HÀNG & LỊCH SỬ DÒNG THỜI GIAN (FR-025)
  // ==========================================================
  async function openOrderDetail(orderId) {
    try {
      const order = await api.get(`/orders/${orderId}`);

      document.getElementById("modal-order-code").textContent = `Chi tiết đơn hàng #DH-${order.order_code}`;
      document.getElementById("modal-order-date").textContent = `Thời gian tạo: ${typeof formatDateTime === "function" ? formatDateTime(order.created_at) : order.created_at}`;

      const stKey = normalizeStatus(order.status);
      const stInfo = STATUS_MAP[stKey] || { label: stKey, class: "status-pending", step: 1 };

      const badgeElem = document.getElementById("modal-status-badge");
      if (badgeElem) {
        badgeElem.className = `status-pill ${stInfo.class}`;
        badgeElem.innerHTML = `<span class="status-pill-dot"></span> ${stInfo.label}`;
      }

      // Cập nhật Stepper trong Modal
      updateModalStepper(stKey);

      // Cập nhật Nhật ký trạng thái (Order Status Histories)
      const historyFeed = document.getElementById("modal-history-timeline");
      const histories = order.histories || [];
      if (histories.length === 0) {
        historyFeed.innerHTML = `<div style="font-size: 12.5px; color: #94a3b8; font-style: italic;">Chưa có bản ghi lịch sử trạng thái nào.</div>`;
      } else {
        historyFeed.innerHTML = histories.map(h => {
          const time = typeof formatDateTime === "function" ? formatDateTime(h.changed_at) : h.changed_at;
          const oldSt = h.old_status ? (STATUS_MAP[normalizeStatus(h.old_status)]?.label || h.old_status) : "Tạo đơn";
          const newSt = STATUS_MAP[normalizeStatus(h.new_status)]?.label || h.new_status;
          return `
            <div class="history-entry">
              <div class="history-time">${escapeHtml(time)}</div>
              <div class="history-desc">
                ${h.old_status ? `Chuyển trạng thái: <strong>${escapeHtml(oldSt)}</strong> ➔ <strong>${escapeHtml(newSt)}</strong>` : `Khởi tạo đơn hàng (${escapeHtml(newSt)})`}
              </div>
              ${h.note ? `<div class="history-note">Ghi chú điều phối: "${escapeHtml(h.note)}"</div>` : ""}
            </div>
          `;
        }).join("");
      }

      // Thông tin người nhận
      document.getElementById("modal-receiver-name").textContent = order.receiver_name || "Chưa cập nhật";
      document.getElementById("modal-receiver-phone").textContent = order.receiver_phone || "—";
      document.getElementById("modal-shipping-address").textContent = order.shipping_address || "—";
      document.getElementById("modal-payment-method").textContent = order.payment_method === "BANK_TRANSFER" || order.payment_method === "chuyển khoản" ? "Chuyển khoản ngân hàng" : "Thanh toán khi nhận hàng (COD)";

      // Ghi chú đơn nếu có
      const noteRow = document.getElementById("modal-note-row");
      if (order.note) {
        noteRow.style.display = "block";
        document.getElementById("modal-note").textContent = order.note;
      } else {
        noteRow.style.display = "none";
      }

      // Lý do hủy nếu có
      const cancelReasonRow = document.getElementById("modal-cancel-reason-row");
      if (order.cancel_reason) {
        cancelReasonRow.style.display = "block";
        document.getElementById("modal-cancel-reason").textContent = order.cancel_reason;
      } else {
        cancelReasonRow.style.display = "none";
      }

      // Danh sách sản phẩm trong Modal
      const modalProductsContainer = document.getElementById("modal-products-container");
      const items = order.items || [];
      const isDelivered = normalizeStatus(order.status) === "COMPLETED";
      if (items.length === 0) {
        modalProductsContainer.innerHTML = `<div style="font-size: 13px; color: var(--figma-text-muted);">Không có thông tin mặt hàng.</div>`;
      } else {
        modalProductsContainer.innerHTML = items.map(it => {
          const itemImg = getItemImageUrl(it.image_url);
          return `
            <div class="modal-product-item">
              <div class="modal-product-summary">
                <img src="${itemImg}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover;" onerror="this.src='../assets/images/logo_shop.svg';">
                <div>
                  <strong style="color: var(--figma-text-dark);">${escapeHtml(it.product_name)}</strong>
                  <div style="font-size: 11.5px; color: var(--figma-text-muted);">Số lượng: ${it.quantity} x ${typeof formatMoney === "function" ? formatMoney(it.unit_price) : `${it.unit_price} ₫`}</div>
                  ${isDelivered && it.product_id ? `<a class="order-review-link" href="product-detail.html?id=${encodeURIComponent(it.product_id)}&review=1#tab-reviews">⭐ Đánh giá sản phẩm</a>` : ""}
                </div>
              </div>
              <strong style="color: var(--figma-primary); font-size: 14px;">
                ${typeof formatMoney === "function" ? formatMoney(it.subtotal) : `${it.subtotal} ₫`}
              </strong>
            </div>
          `;
        }).join("");
      }

      // Bảng tiền trong Modal
      const subtotalVal = order.subtotal_amount || (order.total_amount - (order.shipping_fee || 0));
      document.getElementById("modal-subtotal-price").textContent = typeof formatMoney === "function" ? formatMoney(subtotalVal) : `${subtotalVal} ₫`;
      document.getElementById("modal-shipping-fee").textContent = order.shipping_fee === 0 || order.total_amount >= 500000 ? "Miễn phí" : (typeof formatMoney === "function" ? formatMoney(order.shipping_fee) : `${order.shipping_fee} ₫`);
      document.getElementById("modal-total-price").textContent = typeof formatMoney === "function" ? formatMoney(order.total_amount) : `${order.total_amount} ₫`;

      // Gắn sự kiện in hoá đơn trong Modal
      const modalPrintBtn = document.getElementById("btn-modal-print-invoice-user");
      if (modalPrintBtn) {
        modalPrintBtn.onclick = () => {
          if (typeof window.printOrderInvoice === "function") {
            window.printOrderInvoice(order);
          } else {
            window.print();
          }
        };
      }

      detailModal.classList.add("active");
    } catch (err) {
      console.error("Lỗi khi mở chi tiết đơn hàng:", err);
      showToast(`Không thể tải chi tiết đơn hàng: ${err.message || "Lỗi kết nối máy chủ"}`, "error");
    }
  }

  function updateModalStepper(statusKey) {
    const stepNodes = [
      document.getElementById("modal-step-pending"),
      document.getElementById("modal-step-confirmed"),
      document.getElementById("modal-step-shipping"),
      document.getElementById("modal-step-completed")
    ];
    const progressBar = document.getElementById("modal-stepper-progress");

    stepNodes.forEach(node => {
      if (node) node.className = "step-node";
    });

    const normKey = normalizeStatus(statusKey);
    let currentStep = STATUS_MAP[normKey]?.step || 1;
    if (normKey === "CANCELLED") {
      if (progressBar) progressBar.style.width = "0%";
      return;
    }

    const fillWidths = ["0%", "0%", "33.33%", "66.66%", "100%"];
    if (progressBar) progressBar.style.width = fillWidths[currentStep] || "0%";

    stepNodes.forEach((node, idx) => {
      if (!node) return;
      const stepNum = idx + 1;
      if (stepNum < currentStep) {
        node.classList.add("done");
      } else if (stepNum === currentStep) {
        if (currentStep === 4) {
          node.classList.add("done");
        } else {
          node.classList.add("active");
        }
      }
    });
  }

  // ==========================================================
  // 7. HỦY ĐƠN HÀNG KÈM LÝ DO BẮT BUỘC (BR-09 & FR-026)
  // ==========================================================
  function openCancelModal(orderId, orderCode) {
    currentCancelOrderId = orderId;
    cancelModalOrderCode.textContent = `Đơn hàng #${orderCode}`;
    cancelReasonPreset.value = "";
    cancelReasonDetail.value = "";
    cancelCharCount.textContent = "0 / 255 ký tự";
    cancelErrorMsg.style.display = "none";
    cancelErrorMsg.textContent = "";

    cancelModal.classList.add("active");
  }

  function closeCancelModal() {
    cancelModal.classList.remove("active");
    currentCancelOrderId = null;
  }

  // Chọn lý do có sẵn tự điền vào textarea
  cancelReasonPreset.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val && val !== "other") {
      cancelReasonDetail.value = val;
      cancelCharCount.textContent = `${val.length} / 255 ký tự`;
    }
  });

  // Đếm số ký tự trong ô lý do
  cancelReasonDetail.addEventListener("input", (e) => {
    const len = e.target.value.length;
    cancelCharCount.textContent = `${len} / 255 ký tự`;
    if (len > 255) {
      cancelCharCount.style.color = "#dc2626";
    } else {
      cancelCharCount.style.color = "var(--figma-text-muted)";
    }
  });

  // Gửi yêu cầu hủy đơn lên backend POST /api/orders/{id}/cancel
  btnSubmitCancel.addEventListener("click", async () => {
    if (!currentCancelOrderId) return;

    const reason = cancelReasonDetail.value.trim();
    if (!reason) {
      cancelErrorMsg.textContent = "Vui lòng nhập hoặc chọn lý do hủy đơn hàng.";
      cancelErrorMsg.style.display = "block";
      cancelReasonDetail.focus();
      return;
    }

    if (reason.length > 255) {
      cancelErrorMsg.textContent = "Lý do hủy đơn không được vượt quá 255 ký tự.";
      cancelErrorMsg.style.display = "block";
      return;
    }

    btnSubmitCancel.disabled = true;
    btnSubmitCancel.textContent = "Đang xử lý...";
    cancelErrorMsg.style.display = "none";

    try {
      await api.post(`/orders/${currentCancelOrderId}/cancel`, {
        cancel_reason: reason
      });

      closeCancelModal();
      showToast("Hủy đơn hàng thành công! Số lượng sản phẩm đã được tự động hoàn lại vào kho hàng.", "success");
      await loadOrders();
    } catch (err) {
      console.error("Lỗi khi hủy đơn hàng:", err);
      cancelErrorMsg.textContent = err.message || "Không thể hủy đơn hàng lúc này. Vui lòng thử lại.";
      cancelErrorMsg.style.display = "block";
    } finally {
      btnSubmitCancel.disabled = false;
      btnSubmitCancel.textContent = "Xác nhận hủy đơn";
    }
  });

  // Sự kiện đóng các Modal
  if (btnCloseCancelModal) btnCloseCancelModal.addEventListener("click", closeCancelModal);
  if (btnAbortCancel) btnAbortCancel.addEventListener("click", closeCancelModal);

  if (btnCloseDetailModal) {
    btnCloseDetailModal.addEventListener("click", () => detailModal.classList.remove("active"));
  }
  if (btnCloseDetailModalFooter) {
    btnCloseDetailModalFooter.addEventListener("click", () => detailModal.classList.remove("active"));
  }

  // Click ra ngoài overlay để đóng modal
  window.addEventListener("click", (e) => {
    if (e.target === cancelModal) closeCancelModal();
    if (e.target === detailModal) detailModal.classList.remove("active");
    if (e.target === reorderModal) closeReorderModal();
  });

  // ==========================================================
  // 8. TÍNH NĂNG MUA LẠI SẢN PHẨM (RE-ORDER MODAL & DIRECT RE-ORDER)
  // ==========================================================
  let currentReorderItems = [];

  function closeReorderModal() {
    if (reorderModal) reorderModal.classList.remove("active");
  }

  function updateReorderSummary() {
    const selectedItems = currentReorderItems.filter(it => it.selected);
    const totalQty = selectedItems.reduce((sum, it) => sum + Number(it.buyQty || 1), 0);
    const totalAmount = selectedItems.reduce((sum, it) => sum + (Number(it.unit_price || 0) * Number(it.buyQty || 1)), 0);

    if (reorderSelectedCount) reorderSelectedCount.textContent = selectedItems.length;
    if (reorderTotalCount) reorderTotalCount.textContent = currentReorderItems.length;
    if (reorderSummaryQty) reorderSummaryQty.textContent = totalQty;
    if (reorderSummaryTotal) {
      reorderSummaryTotal.textContent = typeof formatMoney === "function" ? formatMoney(totalAmount) : `${totalAmount.toLocaleString("vi-VN")} ₫`;
    }

    if (reorderCheckAll) {
      reorderCheckAll.checked = selectedItems.length === currentReorderItems.length && currentReorderItems.length > 0;
      reorderCheckAll.indeterminate = selectedItems.length > 0 && selectedItems.length < currentReorderItems.length;
    }

    if (btnSubmitReorderText) {
      btnSubmitReorderText.textContent = `Thêm vào giỏ hàng (${selectedItems.length})`;
    }
    if (btnSubmitReorder) {
      btnSubmitReorder.disabled = selectedItems.length === 0;
    }
  }

  function updateItemRowUI(idx) {
    const item = currentReorderItems[idx];
    if (!item || !reorderItemsList) return;
    const input = reorderItemsList.querySelector(`.reorder-qty-input[data-index="${idx}"]`);
    if (input) input.value = item.buyQty;
    const subtotalElem = document.getElementById(`reorder-subtotal-${idx}`);
    if (subtotalElem) {
      const subtotalVal = (item.unit_price || 0) * item.buyQty;
      subtotalElem.textContent = typeof formatMoney === "function" ? formatMoney(subtotalVal) : `${subtotalVal} ₫`;
    }
  }

  async function executeReorder(itemsToBuy) {
    if (!itemsToBuy || itemsToBuy.length === 0) {
      showToast("Vui lòng chọn ít nhất 1 sản phẩm để thêm vào giỏ hàng!", "warning");
      return;
    }

    if (btnSubmitReorder) btnSubmitReorder.disabled = true;
    if (btnReorderAll) btnReorderAll.disabled = true;
    if (btnSubmitReorderText) btnSubmitReorderText.textContent = "Đang thêm vào giỏ...";

    let successProducts = 0;
    let totalQuantityAdded = 0;
    let failedNames = [];

    for (const item of itemsToBuy) {
      try {
        await api.post("/cart/items", {
          product_id: item.product_id,
          quantity: item.buyQty || 1
        });
        successProducts++;
        totalQuantityAdded += (item.buyQty || 1);
      } catch (err) {
        console.error("Lỗi khi thêm sản phẩm vào giỏ:", item, err);
        failedNames.push(item.product_name || `SP #${item.product_id}`);
      }
    }

    closeReorderModal();

    if (typeof window.refreshCartCount === "function") {
      await window.refreshCartCount();
    }

    if (successProducts > 0) {
      showToast(`Đã thêm thành công ${successProducts} sản phẩm (${totalQuantityAdded} món) vào giỏ hàng của bạn!`, "success");
    }
    if (failedNames.length > 0) {
      showToast(`Không thể thêm ${failedNames.length} sản phẩm do hết hàng hoặc tạm khóa: ${failedNames.join(", ")}`, "warning");
    }

    if (btnSubmitReorder) btnSubmitReorder.disabled = false;
    if (btnReorderAll) btnReorderAll.disabled = false;
    if (btnSubmitReorderText) btnSubmitReorderText.textContent = `Thêm vào giỏ hàng (${itemsToBuy.length})`;
  }

  async function handleReorder(orderId) {
    try {
      let order = allOrders.find(o => String(o.id) === String(orderId));
      if (!order || !order.items || order.items.length === 0) {
        order = await api.get(`/orders/${orderId}`);
      }

      if (!order || !order.items || order.items.length === 0) {
        showToast("Đơn hàng này không có sản phẩm để mua lại.", "warning");
        return;
      }

      // Khởi tạo danh sách sản phẩm mua lại (mặc định chọn tất cả sản phẩm trong đơn)
      currentReorderItems = order.items.map((it, idx) => ({
        ...it,
        index: idx,
        selected: true,
        buyQty: (it.quantity && Number(it.quantity) > 0) ? Number(it.quantity) : 1
      }));

      if (reorderModalSubtitle) {
        reorderModalSubtitle.textContent = `Đơn hàng #DH-${order.order_code} (${currentReorderItems.length} sản phẩm)`;
      }

      // Render danh sách sản phẩm trong modal
      if (reorderItemsList) {
        reorderItemsList.innerHTML = currentReorderItems.map((it, idx) => {
          const itemImg = getItemImageUrl(it.image_url);
          const priceFormatted = typeof formatMoney === "function" ? formatMoney(it.unit_price) : `${it.unit_price} ₫`;
          const subtotalFormatted = typeof formatMoney === "function" ? formatMoney(it.unit_price * it.buyQty) : `${it.unit_price * it.buyQty} ₫`;
          return `
            <div class="reorder-item-row selected" id="reorder-row-${idx}" data-index="${idx}">
              <label class="reorder-item-check" title="Chọn sản phẩm này">
                <input type="checkbox" class="reorder-item-checkbox" data-index="${idx}" checked>
              </label>
              <img src="${itemImg}" alt="${escapeHtml(it.product_name)}" class="reorder-item-img" onerror="this.src='../assets/images/logo_shop.svg';">
              <div class="reorder-item-info">
                <div class="reorder-item-name" title="${escapeHtml(it.product_name)}">${escapeHtml(it.product_name)}</div>
                <div class="reorder-item-meta">
                  <span>${escapeHtml(it.category_name || "Sản phẩm chính hãng")}</span>
                  <span>·</span>
                  <span>${it.sku ? "Mã: " + escapeHtml(it.sku) : "SP-" + (it.product_id || idx + 1)}</span>
                </div>
                <div class="reorder-item-price">${priceFormatted}</div>
              </div>
              <div class="reorder-qty-control">
                <button type="button" class="reorder-qty-btn reorder-qty-minus" data-index="${idx}" aria-label="Giảm số lượng">−</button>
                <input type="text" inputmode="numeric" pattern="[0-9]*" class="reorder-qty-input" data-index="${idx}" value="${it.buyQty}" maxlength="3" aria-label="Số lượng">
                <button type="button" class="reorder-qty-btn reorder-qty-plus" data-index="${idx}" aria-label="Tăng số lượng">+</button>
              </div>
              <div class="reorder-item-subtotal" id="reorder-subtotal-${idx}">${subtotalFormatted}</div>
            </div>
          `;
        }).join("");

        // Đảm bảo giá trị hiển thị trên các ô input
        currentReorderItems.forEach((it, idx) => {
          const inp = reorderItemsList.querySelector(`.reorder-qty-input[data-index="${idx}"]`);
          if (inp) {
            inp.value = it.buyQty;
          }
        });

        // Gắn sự kiện cho checkbox từng dòng
        reorderItemsList.querySelectorAll(".reorder-item-checkbox").forEach(cb => {
          cb.addEventListener("change", (e) => {
            const idx = Number(e.target.dataset.index);
            const isChecked = e.target.checked;
            currentReorderItems[idx].selected = isChecked;
            const row = document.getElementById(`reorder-row-${idx}`);
            if (row) row.classList.toggle("selected", isChecked);
            updateReorderSummary();
          });
        });

        // Gắn sự kiện cho nút giảm số lượng
        reorderItemsList.querySelectorAll(".reorder-qty-minus").forEach(btn => {
          btn.addEventListener("click", (e) => {
            const idx = Number(e.currentTarget.dataset.index);
            if (currentReorderItems[idx].buyQty > 1) {
              currentReorderItems[idx].buyQty--;
              updateItemRowUI(idx);
              updateReorderSummary();
            }
          });
        });

        // Gắn sự kiện cho nút tăng số lượng
        reorderItemsList.querySelectorAll(".reorder-qty-plus").forEach(btn => {
          btn.addEventListener("click", (e) => {
            const idx = Number(e.currentTarget.dataset.index);
            if (currentReorderItems[idx].buyQty < 99) {
              currentReorderItems[idx].buyQty++;
              updateItemRowUI(idx);
              updateReorderSummary();
            }
          });
        });

        // Gắn sự kiện cho ô nhập số lượng (chỉ cho phép nhập số)
        reorderItemsList.querySelectorAll(".reorder-qty-input").forEach(inp => {
          inp.addEventListener("input", (e) => {
            const cleaned = e.target.value.replace(/[^0-9]/g, "");
            e.target.value = cleaned;
          });
          inp.addEventListener("blur", (e) => {
            const idx = Number(e.target.dataset.index);
            let val = parseInt(e.target.value, 10);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 99) val = 99;
            currentReorderItems[idx].buyQty = val;
            updateItemRowUI(idx);
            updateReorderSummary();
          });
          inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.target.blur();
            }
          });
        });
      }

      updateReorderSummary();

      if (reorderModal) {
        reorderModal.classList.add("active");
      }
    } catch (err) {
      console.error("Lỗi khi mở modal mua lại:", err);
      showToast(`Không thể khởi tạo mua lại: ${err.message || "Lỗi máy chủ"}`, "error");
    }
  }

  // Sự kiện nút Chọn tất cả
  if (reorderCheckAll) {
    reorderCheckAll.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      currentReorderItems.forEach((it, idx) => {
        it.selected = isChecked;
        const row = document.getElementById(`reorder-row-${idx}`);
        if (row) row.classList.toggle("selected", isChecked);
        const cb = reorderItemsList ? reorderItemsList.querySelector(`.reorder-item-checkbox[data-index="${idx}"]`) : null;
        if (cb) cb.checked = isChecked;
      });
      updateReorderSummary();
    });
  }

  // Sự kiện nút "Mua lại tất cả"
  if (btnReorderAll) {
    btnReorderAll.addEventListener("click", () => {
      currentReorderItems.forEach(it => { it.selected = true; });
      executeReorder(currentReorderItems);
    });
  }

  // Sự kiện nút "Thêm vào giỏ hàng"
  if (btnSubmitReorder) {
    btnSubmitReorder.addEventListener("click", () => {
      const selected = currentReorderItems.filter(it => it.selected);
      executeReorder(selected);
    });
  }

  // Sự kiện đóng Reorder Modal
  if (btnCloseReorderModal) btnCloseReorderModal.addEventListener("click", closeReorderModal);
  if (btnCancelReorder) btnCancelReorder.addEventListener("click", closeReorderModal);

  // ==========================================================
  // 9. CHUYỂN TAB TRẠNG THÁI & TÌM KIẾM
  // ==========================================================
  statusTabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      statusTabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentStatus = btn.getAttribute("data-status") || "";
      currentPage = 1;
      loadOrders();
    });
  });

  // Ô tìm kiếm có debounce
  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const keyword = (searchInput.value || "").trim().toLowerCase();
        if (!keyword) {
          renderOrderList(allOrders);
          return;
        }

        const filtered = allOrders.filter(o => 
          (o.order_code && o.order_code.toLowerCase().includes(keyword)) ||
          (o.receiver_phone && o.receiver_phone.includes(keyword)) ||
          (o.receiver_name && o.receiver_name.toLowerCase().includes(keyword)) ||
          (o.items && o.items.some(it => it.product_name && it.product_name.toLowerCase().includes(keyword)))
        );
        renderOrderList(filtered);
      }, 250);
    });
  }

  // ==========================================================
  // 10. PHÂN TRANG (PAGINATION)
  // ==========================================================
  function renderPagination(total) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) {
      paginationContainer.style.display = "none";
      return;
    }

    paginationContainer.style.display = "flex";
    let html = "";

    // Nút trước
    html += `
      <button type="button" class="page-btn" ${currentPage === 1 ? "disabled" : ""} id="btn-page-prev">
        &laquo; Trước
      </button>
    `;

    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
        html += `
          <button type="button" class="page-btn ${p === currentPage ? "active" : ""}" data-page="${p}">
            ${p}
          </button>
        `;
      } else if (p === currentPage - 2 || p === currentPage + 2) {
        html += `<span class="page-ellipsis">...</span>`;
      }
    }

    // Nút sau
    html += `
      <button type="button" class="page-btn" ${currentPage === totalPages ? "disabled" : ""} id="btn-page-next">
        Sau &raquo;
      </button>
    `;

    paginationContainer.innerHTML = html;

    // Gắn sự kiện click phân trang
    paginationContainer.querySelectorAll(".page-btn[data-page]").forEach(btn => {
      btn.addEventListener("click", () => {
        currentPage = parseInt(btn.getAttribute("data-page"), 10);
        loadOrders();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    const btnPrev = document.getElementById("btn-page-prev");
    if (btnPrev) {
      btnPrev.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          loadOrders();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    }

    const btnNext = document.getElementById("btn-page-next");
    if (btnNext) {
      btnNext.addEventListener("click", () => {
        if (currentPage < totalPages) {
          currentPage++;
          loadOrders();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    }
  }

  // Khởi động tải dữ liệu ban đầu
  loadOrders();
});
