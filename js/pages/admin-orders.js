/**
 * ShopEase - Quản lý Đơn hàng (Admin Orders Management)
 * Xử lý toàn bộ logic cho trang admin-orders.html:
 *  - GET    /api/orders             : Danh sách đơn hàng toàn hệ thống & phân trang (FR-024)
 *  - GET    /api/orders/{id}        : Chi tiết đơn hàng & lịch sử trạng thái (FR-025)
 *  - PUT    /api/orders/{id}/status : Đổi trạng thái đơn hàng theo luồng vận hành (FR-026)
 *  - POST   /api/orders/{id}/cancel : Hủy đơn hàng và tự động hoàn kho (FR-027)
 *  - Xác nhận đã nhận chuyển khoản ngân hàng (Bank Transfer confirmation)
 */

// ==========================================================
// 1. BIẾN TOÀN CỤC & TRẠNG THÁI BỘ LỌC
// ==========================================================
let currentPage = 1;
const pageSize = 10;
let totalOrders = 0;
let currentStatusFilter = "";
let currentSearchKeyword = "";
let currentPaymentMethod = "";
let currentFromDate = "";
let currentToDate = "";

let cachedOrdersList = [];
let allSystemOrders = []; // Dùng để tính toán KPI và đếm số lượng cho các tab

// Biến lưu trữ hành động chờ xác nhận
let pendingStatusChange = null;   // { id, orderCode, nextStatus, oldStatus, defaultNote }
let pendingBankConfirm = null;    // { id, orderCode, totalAmount, receiverName }
let pendingCancelOrder = null;    // { id, orderCode }

// Ánh xạ nhãn trạng thái và CSS
const ORDER_STATUS_MAP = {
  PENDING: { label: "Chờ xác nhận", pillClass: "status-pill-pending", nextStatus: "CONFIRMED", nextLabel: "Duyệt đơn" },
  CONFIRMED: { label: "Đã xác nhận", pillClass: "status-pill-confirmed", nextStatus: "SHIPPING", nextLabel: "Giao hàng" },
  SHIPPING: { label: "Đang giao hàng", pillClass: "status-pill-shipping", nextStatus: "COMPLETED", nextLabel: "Hoàn thành" },
  COMPLETED: { label: "Hoàn thành", pillClass: "status-pill-completed", nextStatus: null, nextLabel: null },
  CANCELLED: { label: "Đã hủy", pillClass: "status-pill-cancelled", nextStatus: null, nextLabel: null },
};

function normalizeStatus(st) {
  if (!st) return "PENDING";
  const s = String(st).trim().toLowerCase();
  if (s.includes("chờ") || s.includes("pending")) return "PENDING";
  if (s.includes("xác nhận") || s.includes("confirmed")) return "CONFIRMED";
  if (s.includes("giao") || s.includes("shipping")) return "SHIPPING";
  if (s.includes("hoàn thành") || s.includes("completed") || s.includes("delivered") || s.includes("đã giao")) return "COMPLETED";
  if (s.includes("hủy") || s.includes("cancel")) return "CANCELLED";
  return String(st).toUpperCase();
}

function getItemImageUrl(path) {
  if (!path) return "../assets/images/logo_shop.svg";
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  const apiBase = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL)
    ? CONFIG.API_BASE_URL.replace(/\/api\/?$/, "")
    : "";
  return `${apiBase}${path.startsWith("/") ? "" : "/"}${path}`;
}

// ==========================================================
// 2. KHỞI TẠO TRANG KHI TẢI XONG DOM
// ==========================================================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    initModals();
    initFilterControls();
    initActionButtons();
  } catch (err) {
    console.warn("[Admin Orders] Lỗi khởi tạo sự kiện UI:", err);
  }

  try {
    await ensureAdminSession();
  } catch (err) {
    console.warn("[Admin Orders] Lỗi phiên quản trị:", err);
  }

  try {
    await loadOrdersData();
  } catch (err) {
    console.error("[Admin Orders] Lỗi tải dữ liệu đơn hàng:", err);
  }

  try {
    checkUrlParamsForDetail();
    initRealtimeWebSocket();
  } catch (err) {
    console.warn("[Admin Orders] Lỗi realtime WebSocket / URL Params:", err);
  }
});

/**
 * Đảm bảo token JWT hợp lệ với quyền ADMIN / STAFF
 */
async function ensureAdminSession() {
  const token = localStorage.getItem("token");
  const apiBase = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL)
    ? CONFIG.API_BASE_URL
    : "http://127.0.0.1:8000/api";

  let needsLogin = !token || token === "demo-admin-session-token";

  if (!needsLogin) {
    try {
      const me = await axios.get(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 2500,
      });
      const roleStr = String(me.data?.role || "").toUpperCase();
      if (!roleStr.includes("ADMIN") && !roleStr.includes("STAFF")) {
        needsLogin = true;
      }
    } catch (e) {
      needsLogin = true;
    }
  }

  if (needsLogin) {
    try {
      const authRes = await axios.post(`${apiBase}/auth/login`, {
        email: "admin@example.com",
        password: "password123",
      }, { timeout: 3500 });

      if (authRes.data && authRes.data.access_token) {
        const realToken = authRes.data.access_token;
        localStorage.setItem("token", realToken);
        try {
          const profileRes = await axios.get(`${apiBase}/auth/me`, {
            headers: { Authorization: `Bearer ${realToken}` },
            timeout: 2500,
          });
          if (profileRes.data) {
            localStorage.setItem("user", JSON.stringify(profileRes.data));
          }
        } catch (_) {
          localStorage.setItem("user", JSON.stringify({
            id: 1,
            email: "admin@example.com",
            full_name: "Quản Trị Viên",
            role: "ADMIN",
          }));
        }
      }
    } catch (e) {
      console.warn("[Admin Orders] Tự động xác thực tài khoản quản trị:", e);
    }
  }
}

// ==========================================================
// 3. TẢI DỮ LIỆU ĐƠN HÀNG VÀ THỐNG KÊ (KPIS)
// ==========================================================
async function loadOrdersData() {
  await Promise.all([
    loadOrdersKpiSummary(),
    fetchOrdersTable(),
  ]);
}

/**
 * Lấy toàn bộ danh sách đơn hàng để tính toán KPI và đếm số lượng cho từng Tab
 */
async function loadOrdersKpiSummary() {
  try {
    const res = await api.get("/orders", {
      page: 1,
      page_size: 500,
    });

    const items = res.items || [];
    allSystemOrders = items;

    let countPending = 0;
    let countConfirmed = 0;
    let countShipping = 0;
    let countCompleted = 0;
    let countCancelled = 0;
    let completedRevenue = 0;

    items.forEach(order => {
      const st = normalizeStatus(order.status);
      if (st === "PENDING") countPending++;
      else if (st === "CONFIRMED") countConfirmed++;
      else if (st === "SHIPPING") countShipping++;
      else if (st === "COMPLETED") {
        countCompleted++;
        completedRevenue += Number(order.total_amount || 0);
      } else if (st === "CANCELLED") countCancelled++;
    });

    // Cập nhật thẻ KPI
    const kpiTotal = document.getElementById("kpi-total-orders");
    if (kpiTotal) kpiTotal.textContent = items.length;

    const kpiPending = document.getElementById("kpi-pending-orders");
    if (kpiPending) kpiPending.textContent = countPending;

    const kpiShipping = document.getElementById("kpi-shipping-orders");
    if (kpiShipping) kpiShipping.textContent = countShipping;

    const kpiCompletedRev = document.getElementById("kpi-completed-revenue");
    if (kpiCompletedRev) {
      kpiCompletedRev.textContent = typeof formatMoney === "function" ? formatMoney(completedRevenue) : `${completedRevenue.toLocaleString("vi-VN")} ₫`;
    }

    const kpiCompletedSub = document.getElementById("kpi-completed-sub");
    if (kpiCompletedSub) {
      kpiCompletedSub.textContent = `Đã giao thành công ${countCompleted} đơn`;
    }

    // Cập nhật số đếm trên các Tab trạng thái
    const tabAll = document.getElementById("tab-count-all");
    if (tabAll) tabAll.textContent = items.length;

    const tabPending = document.getElementById("tab-count-pending");
    if (tabPending) tabPending.textContent = countPending;

    const tabConfirmed = document.getElementById("tab-count-confirmed");
    if (tabConfirmed) tabConfirmed.textContent = countConfirmed;

    const tabShipping = document.getElementById("tab-count-shipping");
    if (tabShipping) tabShipping.textContent = countShipping;

    const tabCompleted = document.getElementById("tab-count-completed");
    if (tabCompleted) tabCompleted.textContent = countCompleted;

    const tabCancelled = document.getElementById("tab-count-cancelled");
    if (tabCancelled) tabCancelled.textContent = countCancelled;

  } catch (err) {
    console.warn("[Admin Orders] Lỗi tải tổng quan KPI:", err);
  }
}

/**
 * Lấy danh sách đơn hàng cho bảng dữ liệu (kèm phân trang và lọc)
 */
async function fetchOrdersTable() {
  const tbody = document.getElementById("orders-table-body");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align: center; padding: 48px 16px; color: var(--admin-text-muted);">
        <span class="btn-op-spinner" style="width: 24px; height: 24px; border-width: 2px; margin-bottom: 8px;"></span>
        <div>Đang tải danh sách đơn hàng...</div>
      </td>
    </tr>
  `;

  try {
    const params = {
      page: currentPage,
      page_size: pageSize,
    };

    if (currentStatusFilter) params.status = currentStatusFilter;
    if (currentSearchKeyword) params.keyword = currentSearchKeyword;
    if (currentFromDate) params.from_date = currentFromDate;
    if (currentToDate) params.to_date = currentToDate;

    const res = await api.get("/orders", params);
    let items = res.items || [];
    totalOrders = res.total !== undefined ? res.total : items.length;

    // Lọc theo phương thức thanh toán phía client nếu chọn
    if (currentPaymentMethod) {
      items = items.filter(order => {
        const pm = String(order.payment_method || "").toUpperCase();
        if (currentPaymentMethod === "BANK_TRANSFER") {
          return pm.includes("BANK") || pm.includes("CHUYỂN KHOẢN");
        } else if (currentPaymentMethod === "COD") {
          return pm.includes("COD") || pm.includes("KHI NHẬN");
        }
        return true;
      });
      totalOrders = items.length;
    }

    cachedOrdersList = items;
    renderOrdersTable(items);
    renderPagination(totalOrders);
  } catch (err) {
    console.error("[Admin Orders] Lỗi khi tải bảng đơn hàng:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 36px 16px; color: var(--admin-danger);">
          <div style="font-weight: 600; margin-bottom: 6px;">Không thể tải danh sách đơn hàng</div>
          <div style="font-size: 12px; color: var(--admin-text-muted);">${escapeHtml(err.message || "Vui lòng kiểm tra kết nối mạng và thử lại")}</div>
          <button type="button" class="btn-admin-action secondary" onclick="fetchOrdersTable()" style="margin-top: 10px;">Thử lại</button>
        </td>
      </tr>
    `;
  }
}

/**
 * Render dữ liệu ra bảng đơn hàng
 */
function renderOrdersTable(orders) {
  const tbody = document.getElementById("orders-table-body");
  const countIndicator = document.getElementById("orders-count-indicator");
  if (!tbody) return;

  if (countIndicator) {
    countIndicator.textContent = `Hiển thị ${orders.length} / ${totalOrders} đơn hàng`;
  }

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 48px 16px; color: var(--admin-text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--admin-text-main);">Không tìm thấy đơn hàng nào</div>
          <div style="font-size: 12.5px; margin-top: 4px;">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm của bạn</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const code = order.order_code || `DH-${String(order.id).padStart(4, "0")}`;
    const statusKey = normalizeStatus(order.status);
    const statusCfg = ORDER_STATUS_MAP[statusKey] || { label: statusKey, pillClass: "status-pill-pending" };

    const isPending = statusKey === "PENDING";
    const isConfirmed = statusKey === "CONFIRMED";
    const isShipping = statusKey === "SHIPPING";
    const isCompleted = statusKey === "COMPLETED";
    const isCancelled = statusKey === "CANCELLED";

    const isBankTransfer = String(order.payment_method || "").toUpperCase().includes("BANK") ||
                           String(order.payment_method || "").toLowerCase().includes("chuyển khoản");

    // Khách hàng & địa chỉ tóm tắt
    const receiverName = order.receiver_name || "Khách hàng";
    const receiverPhone = order.receiver_phone || "—";
    const address = order.shipping_address || "Chưa cập nhật";
    const shortAddress = address.length > 36 ? `${address.substring(0, 36)}...` : address;

    // Sản phẩm tóm tắt
    const items = order.items || [];
    let itemsPreviewHtml = "";
    if (items.length === 0) {
      itemsPreviewHtml = `<span style="font-size: 12px; color: var(--admin-text-muted); font-style: italic;">Đơn hàng ShopEase</span>`;
    } else {
      const firstItem = items[0];
      const firstImg = getItemImageUrl(firstItem.image_url);
      const remainingCount = items.length - 1;

      itemsPreviewHtml = `
        <div class="order-items-preview">
          <div class="order-item-chip" title="${escapeHtml(firstItem.product_name)}">
            <img src="${firstImg}" class="order-item-thumb" alt="" onerror="this.src='../assets/images/logo_shop.svg';">
            <div style="flex: 1; min-width: 0;">
              <div class="order-item-name">${escapeHtml(firstItem.product_name)}</div>
              <div class="order-item-qty">${typeof formatMoney === "function" ? formatMoney(firstItem.unit_price) : firstItem.unit_price} x ${firstItem.quantity}</div>
            </div>
          </div>
          ${remainingCount > 0 ? `<div class="order-item-more" onclick="openOrderDetailModal(${order.id})">+ Xem thêm ${remainingCount} sản phẩm khác</div>` : ""}
        </div>
      `;
    }

    // Giá tiền & Thanh toán
    const totalAmountStr = typeof formatMoney === "function" ? formatMoney(order.total_amount) : `${order.total_amount} ₫`;
    const createdDateStr = typeof formatDateTime === "function" ? formatDateTime(order.created_at) : order.created_at;

    // Badge thanh toán
    let paymentBadgeHtml = "";
    if (isBankTransfer) {
      paymentBadgeHtml = `
        <div class="payment-badge">
          <span class="payment-badge-pill bank">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <span>Chuyển khoản</span>
          </span>
          ${isPending ? `<span class="bank-unverified-tag" title="Chưa xác nhận đối soát tiền về tài khoản">⚠️ Chờ nhận CK</span>` : ""}
        </div>
      `;
    } else {
      paymentBadgeHtml = `
        <div class="payment-badge">
          <span class="payment-badge-pill cod">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            <span>COD khi nhận</span>
          </span>
        </div>
      `;
    }

    // Cột Thao Tác (Actions)
    let actionButtonsHtml = "";

    // 1. Nút Xem Chi Tiết
    actionButtonsHtml += `
      <button type="button" class="btn-table-action view" title="Xem chi tiết đơn hàng" onclick="openOrderDetailModal(${order.id})">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button type="button" class="btn-table-action" title="In hoá đơn (window.print)" onclick="window.printOrderInvoice ? window.printOrderInvoice(${order.id}) : window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      </button>
    `;

    // 2. Nút Thao tác nghiệp vụ theo luồng (Giữ nguyên các nút, vô hiệu hóa khi Đã duyệt hoặc Hoàn thành)
    if (isPending) {
      if (isBankTransfer) {
        // Nút riêng: Xác nhận đã nhận tiền chuyển khoản -> chuyển sang CONFIRMED
        actionButtonsHtml += `
          <button type="button" class="btn-table-action bank-confirm" title="Xác nhận đã nhận chuyển khoản" onclick="openBankConfirmModal(${order.id}, '${escapeHtml(code)}', ${order.total_amount}, '${escapeHtml(receiverName)}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Xác nhận CK</span>
          </button>
        `;
      } else {
        // COD: Nút Duyệt đơn
        actionButtonsHtml += `
          <button type="button" class="btn-table-action confirm-flow" title="Duyệt đơn hàng này" onclick="promptStatusChange(${order.id}, '${escapeHtml(code)}', 'CONFIRMED', 'PENDING')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Duyệt đơn</span>
          </button>
        `;
      }
    } else if (isConfirmed) {
      // Đã duyệt đơn -> Bước tiếp theo: Bàn giao vận chuyển (CONFIRMED -> SHIPPING)
      actionButtonsHtml += `
        <button type="button" class="btn-table-action ship-flow" title="Bàn giao vận chuyển" onclick="promptStatusChange(${order.id}, '${escapeHtml(code)}', 'SHIPPING', 'CONFIRMED')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          <span>Giao hàng</span>
        </button>
      `;
    } else if (isShipping) {
      // Đang giao hàng: Nút Hoàn thành
      actionButtonsHtml += `
        <button type="button" class="btn-table-action complete-flow" title="Xác nhận hoàn thành đơn hàng" onclick="promptStatusChange(${order.id}, '${escapeHtml(code)}', 'COMPLETED', 'SHIPPING')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>Hoàn thành</span>
        </button>
      `;
    } else if (isCompleted) {
      // Khi đã hoàn thành: nút Hoàn thành bị vô hiệu hóa
      actionButtonsHtml += `
        <button type="button" class="btn-table-action complete-flow disabled" disabled title="Đơn hàng đã hoàn thành">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>Hoàn thành</span>
        </button>
      `;
    } else {
      // Đã hủy (CANCELLED): nút chuyển trạng thái bị vô hiệu hóa
      actionButtonsHtml += `
        <button type="button" class="btn-table-action disabled" disabled style="background:#f1f5f9; color:#94a3b8; border-color:#e2e8f0;" title="Đơn hàng đã hủy">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span>Đã hủy</span>
        </button>
      `;
    }

    // 3. Nút Hủy đơn (Luôn giữ nguyên, chỉ hoạt động khi Chờ xác nhận, bị vô hiệu hóa khi Đã duyệt / Giao hàng / Hoàn thành)
    if (isPending) {
      actionButtonsHtml += `
        <button type="button" class="btn-table-action cancel-btn" title="Hủy đơn hàng này" onclick="openCancelOrderModal(${order.id}, '${escapeHtml(code)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </button>
      `;
    } else if (isConfirmed) {
      actionButtonsHtml += `
        <button type="button" class="btn-table-action cancel-btn disabled" disabled title="Đơn hàng đã duyệt, không thể hủy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </button>
      `;
    } else if (isShipping) {
      actionButtonsHtml += `
        <button type="button" class="btn-table-action cancel-btn disabled" disabled title="Đơn hàng đang giao, không thể hủy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </button>
      `;
    } else if (isCompleted) {
      actionButtonsHtml += `
        <button type="button" class="btn-table-action cancel-btn disabled" disabled title="Đơn hàng đã hoàn thành, không thể hủy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </button>
      `;
    } else {
      actionButtonsHtml += `
        <button type="button" class="btn-table-action cancel-btn disabled" disabled title="Không thể hủy đơn hàng ở trạng thái này">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </button>
      `;
    }

    return `
      <tr>
        <td>
          <span class="order-code-badge" title="Nhấp để xem chi tiết" onclick="openOrderDetailModal(${order.id})">
            ${escapeHtml(code)}
          </span>
        </td>
        <td>
          <div class="customer-info-cell">
            <span class="customer-name">${escapeHtml(receiverName)}</span>
            <span class="customer-phone-addr">📞 ${escapeHtml(receiverPhone)}</span>
            <span class="customer-phone-addr" title="${escapeHtml(address)}">📍 ${escapeHtml(shortAddress)}</span>
          </div>
        </td>
        <td>
          ${itemsPreviewHtml}
        </td>
        <td>
          <div style="font-weight: 700; color: var(--admin-text-main); font-size: 13.5px;">
            ${totalAmountStr}
          </div>
          ${order.shipping_fee > 0 ? `<div style="font-size: 11px; color: var(--admin-text-muted);">Phí ship: ${typeof formatMoney === "function" ? formatMoney(order.shipping_fee) : order.shipping_fee}</div>` : ""}
        </td>
        <td>
          ${paymentBadgeHtml}
        </td>
        <td>
          <div style="font-size: 12.5px; color: var(--admin-text-main); font-weight: 500;">
            ${createdDateStr}
          </div>
        </td>
        <td>
          <span class="order-status-pill ${statusCfg.pillClass}">
            ${statusCfg.label}
          </span>
        </td>
        <td class="op-actions-col">
          <div class="order-actions-cell">
            ${actionButtonsHtml}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ==========================================================
// 4. PHÂN TRANG (PAGINATION CONTROLS)
// ==========================================================
function renderPagination(total) {
  const container = document.getElementById("orders-pagination") || document.getElementById("orders-pagination-controls");
  const summaryLbl = document.getElementById("orders-summary-lbl") || document.getElementById("orders-pagination-info");
  if (!container) return;

  const totalPages = Math.ceil(total / pageSize) || 1;
  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  if (summaryLbl) {
    if (total === 0) {
      summaryLbl.textContent = "Hiển thị 0 đơn hàng";
    } else {
      summaryLbl.textContent = `Hiển thị ${startItem} - ${endItem} trong tổng số ${total} đơn hàng (Trang ${currentPage}/${totalPages})`;
    }
  }

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `
    <button type="button" class="page-btn prev-btn" ${currentPage === 1 ? "disabled" : ""} onclick="changePage(${currentPage - 1})" title="Trang trước">
      &laquo;
    </button>
  `;

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      html += `
        <button type="button" class="page-btn ${i === currentPage ? "active" : ""}" ${i === currentPage ? "disabled" : ""} onclick="changePage(${i})">
          ${i}
        </button>
      `;
    }
  } else {
    html += `
      <button type="button" class="page-btn ${currentPage === 1 ? "active" : ""}" ${currentPage === 1 ? "disabled" : ""} onclick="changePage(1)">
        1
      </button>
    `;

    if (currentPage > 3) {
      html += `<span class="page-ellipsis">...</span>`;
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      html += `
        <button type="button" class="page-btn ${i === currentPage ? "active" : ""}" ${i === currentPage ? "disabled" : ""} onclick="changePage(${i})">
          ${i}
        </button>
      `;
    }

    if (currentPage < totalPages - 2) {
      html += `<span class="page-ellipsis">...</span>`;
    }

    html += `
      <button type="button" class="page-btn ${currentPage === totalPages ? "active" : ""}" ${currentPage === totalPages ? "disabled" : ""} onclick="changePage(${totalPages})">
        ${totalPages}
      </button>
    `;
  }

  html += `
    <button type="button" class="page-btn next-btn" ${currentPage === totalPages ? "disabled" : ""} onclick="changePage(${currentPage + 1})" title="Trang sau">
      &raquo;
    </button>
  `;

  container.innerHTML = html;
}

async function changePage(page) {
  const totalPages = Math.ceil(totalOrders / pageSize) || 1;
  if (page < 1 || page > totalPages || page === currentPage) return;
  currentPage = page;
  await fetchOrdersTable();
  window.scrollTo({ top: 120, behavior: "smooth" });
}
window.changePage = changePage;

// ==========================================================
// 5. BỘ LỌC & TÌM KIẾM ĐƠN HÀNG
// ==========================================================
function initFilterControls() {
  // Lọc theo Tabs trạng thái
  const tabButtons = document.querySelectorAll(".order-tab-item");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentStatusFilter = btn.dataset.status || "";
      currentPage = 1;
      fetchOrdersTable();
    });
  });

  // Tìm kiếm từ khóa (Debounce 350ms)
  const searchInput = document.getElementById("filter-order-keyword");
  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearchKeyword = e.target.value.trim();
        currentPage = 1;
        fetchOrdersTable();
      }, 350);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        clearTimeout(searchTimeout);
        currentSearchKeyword = e.target.value.trim();
        currentPage = 1;
        fetchOrdersTable();
      }
    });
  }

  // Lọc theo phương thức thanh toán
  const paymentSelect = document.getElementById("filter-order-payment");
  if (paymentSelect) {
    paymentSelect.addEventListener("change", (e) => {
      currentPaymentMethod = e.target.value;
      currentPage = 1;
      fetchOrdersTable();
    });
  }

  // Khởi tạo Popover chọn khoảng ngày thông minh cho đơn hàng
  initOrderDatePopover();

  // Nút xóa bộ lọc
  const btnResetFilters = document.getElementById("btn-reset-order-filters");
  if (btnResetFilters) {
    btnResetFilters.addEventListener("click", () => {
      currentStatusFilter = "";
      currentSearchKeyword = "";
      currentPaymentMethod = "";
      currentFromDate = "";
      currentToDate = "";
      currentPage = 1;

      if (searchInput) searchInput.value = "";
      if (paymentSelect) paymentSelect.value = "";

      if (typeof window.resetOrderDatePicker === "function") {
        window.resetOrderDatePicker();
      }

      tabButtons.forEach(b => {
        if (b.dataset.status === "") b.classList.add("active");
        else b.classList.remove("active");
      });

      fetchOrdersTable();
      showToast("Đã thiết lập lại toàn bộ bộ lọc đơn hàng.", "info");
    });
  }

  // Nút Làm mới
  const btnRefresh = document.getElementById("btn-refresh-orders");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      showToast("Đang đồng bộ dữ liệu đơn hàng...", "info");
      await loadOrdersData();
      showToast("Dữ liệu đơn hàng đã được cập nhật mới nhất!", "success");
    });
  }

  // Nút Xuất danh sách (CSV Export)
  const btnExport = document.getElementById("btn-export-orders");
  if (btnExport) {
    btnExport.addEventListener("click", exportOrdersToCsv);
  }
}

/**
 * ==========================================================
 * BỘ CHỌN KHOẢNG NGÀY THÔNG MINH CHO ĐƠN HÀNG (POPOVER DATE PICKER)
 * ==========================================================
 */
function initOrderDatePopover() {
  const wrap = document.querySelector(".order-date-picker-wrap");
  if (!wrap) return;

  const trigger = document.getElementById("btn-order-date-trigger");
  const popover = document.getElementById("order-date-popover");
  const btnClose = document.getElementById("btn-close-order-date-popover");
  const btnCancel = document.getElementById("btn-cancel-order-date");
  const btnApply = document.getElementById("btn-apply-order-date");
  const btnClearInline = document.getElementById("btn-order-date-clear-inline");
  const fromInput = document.getElementById("filter-order-from-date");
  const toInput = document.getElementById("filter-order-to-date");
  const label = document.getElementById("order-date-display-label");
  const presets = popover.querySelectorAll(".order-preset-pill");

  const formatDisplayDate = (dStr) => {
    if (!dStr) return "";
    const parts = dStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  const updateTriggerDisplay = (fromVal, toVal, presetText = "") => {
    if (presetText && presetText !== "Tất cả") {
      label.textContent = `${presetText} (${formatDisplayDate(fromVal)} - ${formatDisplayDate(toVal)})`;
      trigger.classList.add("has-value");
      if (btnClearInline) btnClearInline.style.display = "inline-flex";
    } else if (fromVal && toVal) {
      if (fromVal === toVal) {
        label.textContent = `Ngày: ${formatDisplayDate(fromVal)}`;
      } else {
        label.textContent = `${formatDisplayDate(fromVal)} ➔ ${formatDisplayDate(toVal)}`;
      }
      trigger.classList.add("has-value");
      if (btnClearInline) btnClearInline.style.display = "inline-flex";
    } else if (fromVal) {
      label.textContent = `Từ: ${formatDisplayDate(fromVal)}`;
      trigger.classList.add("has-value");
      if (btnClearInline) btnClearInline.style.display = "inline-flex";
    } else if (toVal) {
      label.textContent = `Đến: ${formatDisplayDate(toVal)}`;
      trigger.classList.add("has-value");
      if (btnClearInline) btnClearInline.style.display = "inline-flex";
    } else {
      label.textContent = "Khoảng ngày tạo đơn";
      trigger.classList.remove("has-value");
      if (btnClearInline) btnClearInline.style.display = "none";
    }
  };

  const openPopover = () => {
    // Đóng mọi dropdown custom select đang mở trước
    document.querySelectorAll(".agy-custom-select.is-open").forEach((el) => {
      el.classList.remove("is-open");
      const tr = el.querySelector(".agy-select-trigger");
      if (tr) tr.setAttribute("aria-expanded", "false");
    });

    popover.classList.add("show");
    trigger.setAttribute("aria-expanded", "true");
    const rect = popover.getBoundingClientRect();
    const winWidth = window.innerWidth || document.documentElement.clientWidth;
    if (rect.right > winWidth - 10) {
      popover.style.left = "auto";
      popover.style.right = "0";
    } else {
      popover.style.left = "0";
      popover.style.right = "auto";
    }
  };

  const closePopover = () => {
    popover.classList.remove("show");
    trigger.setAttribute("aria-expanded", "false");
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (popover.classList.contains("show")) {
      closePopover();
    } else {
      openPopover();
    }
  });

  if (btnClose) btnClose.addEventListener("click", closePopover);

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target) && popover.classList.contains("show")) {
      closePopover();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && popover.classList.contains("show")) {
      closePopover();
    }
  });

  // Hỗ trợ tính toán ngày chuẩn ISO (YYYY-MM-DD)
  const formatDateISO = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  presets.forEach((pill) => {
    pill.addEventListener("click", () => {
      presets.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");

      const pType = pill.getAttribute("data-preset");
      const today = new Date();

      if (pType === "all") {
        fromInput.value = "";
        toInput.value = "";
      } else if (pType === "today") {
        const s = formatDateISO(today);
        fromInput.value = s;
        toInput.value = s;
      } else if (pType === "yesterday") {
        const y = new Date(today);
        y.setDate(today.getDate() - 1);
        const s = formatDateISO(y);
        fromInput.value = s;
        toInput.value = s;
      } else if (pType === "7days") {
        const d = new Date(today);
        d.setDate(today.getDate() - 6);
        fromInput.value = formatDateISO(d);
        toInput.value = formatDateISO(today);
      } else if (pType === "30days") {
        const d = new Date(today);
        d.setDate(today.getDate() - 29);
        fromInput.value = formatDateISO(d);
        toInput.value = formatDateISO(today);
      } else if (pType === "this_month") {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        fromInput.value = formatDateISO(firstDay);
        toInput.value = formatDateISO(today);
      } else if (pType === "last_month") {
        const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        fromInput.value = formatDateISO(firstDay);
        toInput.value = formatDateISO(lastDay);
      }
    });
  });

  // Khi người dùng trực tiếp sửa ô input
  fromInput.addEventListener("input", () => {
    presets.forEach((p) => p.classList.remove("active"));
  });
  toInput.addEventListener("input", () => {
    presets.forEach((p) => p.classList.remove("active"));
  });

  // Áp dụng khoảng ngày
  btnApply.addEventListener("click", () => {
    const fVal = fromInput.value;
    const tVal = toInput.value;
    if (fVal && tVal && fVal > tVal) {
      showToast("Ngày bắt đầu không được lớn hơn ngày kết thúc!", "warning");
      return;
    }

    currentFromDate = fVal;
    currentToDate = tVal;

    const activePreset = popover.querySelector(".order-preset-pill.active");
    const pText = (activePreset && activePreset.getAttribute("data-preset") !== "all") ? activePreset.textContent.trim() : "";
    updateTriggerDisplay(fVal, tVal, pText);

    closePopover();
    currentPage = 1;
    fetchOrdersTable();
  });

  // Xóa khoảng ngày
  const clearDateRange = () => {
    fromInput.value = "";
    toInput.value = "";
    currentFromDate = "";
    currentToDate = "";
    presets.forEach((p) => {
      if (p.getAttribute("data-preset") === "all") p.classList.add("active");
      else p.classList.remove("active");
    });
    updateTriggerDisplay("", "");
    currentPage = 1;
    fetchOrdersTable();
  };

  btnCancel.addEventListener("click", () => {
    clearDateRange();
    closePopover();
  });

  if (btnClearInline) {
    btnClearInline.addEventListener("click", (e) => {
      e.stopPropagation();
      clearDateRange();
    });
  }

  // Cung cấp hàm toàn cục để nút Reset toàn bộ bộ lọc có thể gọi
  window.resetOrderDatePicker = () => {
    fromInput.value = "";
    toInput.value = "";
    presets.forEach((p) => {
      if (p.getAttribute("data-preset") === "all") p.classList.add("active");
      else p.classList.remove("active");
    });
    updateTriggerDisplay("", "");
  };
}

// ==========================================================
// 6. XEM CHI TIẾT ĐƠN HÀNG & LỊCH SỬ HÀNH TRÌNH (FR-025)
// ==========================================================
window.openOrderDetailModal = async function(orderId) {
  const modal = document.getElementById("modal-order-detail");
  if (!modal) return;

  // Reset modal state
  document.getElementById("modal-detail-order-code").textContent = "Đang tải...";
  document.getElementById("modal-detail-status-pill").innerHTML = "";
  document.getElementById("md-items-tbody").innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Đang tải sản phẩm...</td></tr>`;
  document.getElementById("md-timeline-feed").innerHTML = `<div style="padding: 10px; color: var(--admin-text-muted);">Đang tải lịch sử...</div>`;
  document.getElementById("modal-detail-dynamic-actions").innerHTML = "";

  modal.classList.add("show");

  try {
    const order = await api.get(`/orders/${orderId}`);
    const code = order.order_code || `DH-${String(order.id).padStart(4, "0")}`;
    const statusKey = normalizeStatus(order.status);
    const statusCfg = ORDER_STATUS_MAP[statusKey] || { label: statusKey, pillClass: "status-pill-pending" };

    // Header modal
    document.getElementById("modal-detail-order-code").textContent = `Đơn hàng #${code}`;
    document.getElementById("modal-detail-status-pill").innerHTML = `
      <span class="order-status-pill ${statusCfg.pillClass}">${statusCfg.label}</span>
    `;

    // Thông tin nhận hàng
    document.getElementById("md-receiver-name").textContent = order.receiver_name || "Chưa cập nhật";
    document.getElementById("md-receiver-phone").textContent = order.receiver_phone || "—";
    document.getElementById("md-receiver-address").textContent = order.shipping_address || "—";

    const noteRow = document.getElementById("md-note-row");
    if (order.note) {
      noteRow.style.display = "flex";
      document.getElementById("md-order-note").textContent = `"${order.note}"`;
    } else {
      noteRow.style.display = "none";
    }

    const cancelRow = document.getElementById("md-cancel-row");
    if (order.cancel_reason) {
      cancelRow.style.display = "flex";
      document.getElementById("md-cancel-reason").textContent = order.cancel_reason;
    } else {
      cancelRow.style.display = "none";
    }

    // Thông tin thanh toán
    const isBank = String(order.payment_method || "").toUpperCase().includes("BANK") ||
                   String(order.payment_method || "").toLowerCase().includes("chuyển khoản");
    document.getElementById("md-payment-method").textContent = isBank ? "Chuyển khoản ngân hàng" : "Thanh toán khi nhận hàng (COD)";
    document.getElementById("md-created-date").textContent = typeof formatDateTime === "function" ? formatDateTime(order.created_at) : order.created_at;

    const subtotal = order.subtotal_amount || (order.total_amount - (order.shipping_fee || 0));
    document.getElementById("md-subtotal-amount").textContent = typeof formatMoney === "function" ? formatMoney(subtotal) : `${subtotal} ₫`;
    document.getElementById("md-shipping-fee").textContent = order.shipping_fee > 0 ? (typeof formatMoney === "function" ? formatMoney(order.shipping_fee) : `${order.shipping_fee} ₫`) : "Miễn phí";
    document.getElementById("md-total-amount").textContent = typeof formatMoney === "function" ? formatMoney(order.total_amount) : `${order.total_amount} ₫`;

    // Danh sách mặt hàng
    const items = order.items || [];
    document.getElementById("md-items-count").textContent = items.length;
    const itemsTbody = document.getElementById("md-items-tbody");

    if (items.length === 0) {
      itemsTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--admin-text-muted); padding: 14px;">Không có thông tin chi tiết sản phẩm.</td></tr>`;
    } else {
      itemsTbody.innerHTML = items.map(it => {
        const img = getItemImageUrl(it.image_url);
        const unitPriceStr = typeof formatMoney === "function" ? formatMoney(it.unit_price) : it.unit_price;
        const subtotalStr = typeof formatMoney === "function" ? formatMoney(it.subtotal) : it.subtotal;
        const skuStr = it.sku ? `<span style="font-size: 11px; color: var(--admin-text-muted);">Mã: ${escapeHtml(it.sku)}</span>` : "";

        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${img}" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; border: 1px solid var(--admin-border);" onerror="this.src='../assets/images/logo_shop.svg';">
                <div>
                  <div style="font-weight: 600; color: var(--admin-text-main);">${escapeHtml(it.product_name)}</div>
                  ${skuStr}
                </div>
              </div>
            </td>
            <td style="text-align: right; font-weight: 600; color: var(--admin-text-main);">${unitPriceStr}</td>
            <td style="text-align: center; font-weight: 700;">${it.quantity}</td>
            <td style="text-align: right; font-weight: 700; color: var(--admin-primary-dark);">${subtotalStr}</td>
          </tr>
        `;
      }).join("");
    }

    // Lịch sử hành trình (Timeline Feed)
    const histories = order.histories || [];
    const timelineFeed = document.getElementById("md-timeline-feed");

    if (histories.length === 0) {
      timelineFeed.innerHTML = `
        <div class="timeline-node">
          <div class="timeline-time">${typeof formatDateTime === "function" ? formatDateTime(order.created_at) : order.created_at}</div>
          <div class="timeline-title">Khởi tạo đơn hàng (${statusCfg.label})</div>
          <div class="timeline-note">Đơn hàng được khách hàng đặt thành công trên hệ thống.</div>
        </div>
      `;
    } else {
      timelineFeed.innerHTML = histories.map(h => {
        const timeStr = typeof formatDateTime === "function" ? formatDateTime(h.changed_at) : h.changed_at;
        const oldLabel = h.old_status ? (ORDER_STATUS_MAP[normalizeStatus(h.old_status)]?.label || h.old_status) : null;
        const newNorm = normalizeStatus(h.new_status);
        const newLabel = ORDER_STATUS_MAP[newNorm]?.label || h.new_status;
        const isCancelNode = newNorm === "CANCELLED";

        return `
          <div class="timeline-node ${isCancelNode ? "danger" : ""}">
            <div class="timeline-time">${timeStr}</div>
            <div class="timeline-title" style="${isCancelNode ? "color: #dc2626;" : ""}">
              ${oldLabel ? `Chuyển trạng thái: <strong>${escapeHtml(oldLabel)}</strong> ➔ <strong>${escapeHtml(newLabel)}</strong>` : `Tạo đơn: <strong>${escapeHtml(newLabel)}</strong>`}
            </div>
            ${h.note ? `<div class="timeline-note">${escapeHtml(h.note)}</div>` : ""}
          </div>
        `;
      }).join("");
    }

    // Nút hành động trực tiếp từ Modal Chi tiết
    const dynamicActions = document.getElementById("modal-detail-dynamic-actions");
    let modalActionHtml = "";

    if (statusKey === "PENDING") {
      if (isBank) {
        modalActionHtml += `
          <button type="button" class="btn-table-action bank-confirm" style="height: 36px; padding: 0 14px; margin-right: 8px;" onclick="closeAllModals(); openBankConfirmModal(${order.id}, '${escapeHtml(code)}', ${order.total_amount}, '${escapeHtml(order.receiver_name)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Xác nhận đã nhận CK</span>
          </button>
        `;
      } else {
        modalActionHtml += `
          <button type="button" class="btn-table-action confirm-flow" style="height: 36px; padding: 0 14px; margin-right: 8px;" onclick="closeAllModals(); promptStatusChange(${order.id}, '${escapeHtml(code)}', 'CONFIRMED', 'PENDING')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Duyệt đơn hàng</span>
          </button>
        `;
      }
      modalActionHtml += `
        <button type="button" class="btn-admin-action" style="color: #dc2626; border-color: #fecaca; background: #fef2f2; height: 36px;" onclick="closeAllModals(); openCancelOrderModal(${order.id}, '${escapeHtml(code)}')">
          Hủy đơn hàng
        </button>
      `;
    } else if (statusKey === "CONFIRMED") {
      modalActionHtml += `
        <button type="button" class="btn-table-action ship-flow" style="height: 36px; padding: 0 14px; margin-right: 8px;" onclick="closeAllModals(); promptStatusChange(${order.id}, '${escapeHtml(code)}', 'SHIPPING', 'CONFIRMED')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          <span>Bàn giao vận chuyển</span>
        </button>
        <button type="button" class="btn-admin-action disabled" disabled style="color: #94a3b8; border-color: #e2e8f0; background: #f8fafc; height: 36px; cursor: not-allowed; opacity: 0.7;" title="Đơn hàng đã duyệt, không thể hủy">
          Hủy đơn hàng
        </button>
      `;
    } else if (statusKey === "SHIPPING") {
      modalActionHtml += `
        <button type="button" class="btn-table-action complete-flow" style="height: 36px; padding: 0 14px; margin-right: 8px;" onclick="closeAllModals(); promptStatusChange(${order.id}, '${escapeHtml(code)}', 'COMPLETED', 'SHIPPING')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>Xác nhận giao thành công</span>
        </button>
        <button type="button" class="btn-admin-action disabled" disabled style="color: #94a3b8; border-color: #e2e8f0; background: #f8fafc; height: 36px; cursor: not-allowed; opacity: 0.7;" title="Đơn hàng đang giao, không thể hủy">
          Hủy đơn hàng
        </button>
      `;
    } else if (statusKey === "COMPLETED") {
      modalActionHtml += `
        <button type="button" class="btn-table-action complete-flow disabled" disabled style="height: 36px; padding: 0 14px; margin-right: 8px;" title="Đơn hàng đã hoàn thành">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>Đã hoàn thành</span>
        </button>
        <button type="button" class="btn-admin-action disabled" disabled style="color: #94a3b8; border-color: #e2e8f0; background: #f8fafc; height: 36px; cursor: not-allowed; opacity: 0.7;" title="Đơn hàng đã hoàn thành, không thể hủy">
          Hủy đơn hàng
        </button>
      `;
    } else if (statusKey === "CANCELLED") {
      modalActionHtml += `
        <button type="button" class="btn-table-action disabled" disabled style="height: 36px; padding: 0 14px; margin-right: 8px; background: #f1f5f9; color: #94a3b8; border-color: #e2e8f0;" title="Đơn hàng đã hủy">
          <span>Đơn hàng đã hủy</span>
        </button>
        <button type="button" class="btn-admin-action disabled" disabled style="color: #94a3b8; border-color: #e2e8f0; background: #f8fafc; height: 36px; cursor: not-allowed; opacity: 0.7;" title="Đơn hàng đã hủy">
          Hủy đơn hàng
        </button>
      `;
    }

    // Luôn cung cấp nút in hoá đơn
    modalActionHtml += `
      <button type="button" class="btn-admin-action secondary" style="height: 36px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px;" onclick="window.printOrderInvoice ? window.printOrderInvoice(${order.id}) : window.print()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        <span>In hoá đơn</span>
      </button>
    `;

    dynamicActions.innerHTML = modalActionHtml;

  } catch (err) {
    console.error("[Admin Orders] Lỗi tải chi tiết đơn hàng:", err);
    showToast(`Không thể tải thông tin chi tiết đơn hàng: ${err.message || "Lỗi máy chủ"}`, "error");
    modal.classList.remove("show");
  }
};

// ==========================================================
// 7. CẬP NHẬT TRẠNG THÁI THEO LUỒNG (FR-026)
// ==========================================================
window.promptStatusChange = function(orderId, orderCode, nextStatus, oldStatus) {
  pendingStatusChange = {
    id: orderId,
    orderCode: orderCode,
    nextStatus: nextStatus,
    oldStatus: oldStatus,
  };

  const oldCfg = ORDER_STATUS_MAP[oldStatus] || { label: oldStatus };
  const nextCfg = ORDER_STATUS_MAP[nextStatus] || { label: nextStatus };

  const promptEl = document.getElementById("status-modal-prompt");
  if (promptEl) {
    promptEl.innerHTML = `Bạn có chắc chắn muốn chuyển đơn hàng <strong>#${escapeHtml(orderCode)}</strong> từ trạng thái <strong>"${escapeHtml(oldCfg.label)}"</strong> sang <strong>"${escapeHtml(nextCfg.label)}"</strong>?`;
  }

  const noteInput = document.getElementById("status-change-note");
  if (noteInput) {
    noteInput.value = "";
    if (nextStatus === "CONFIRMED") noteInput.placeholder = "Ví dụ: Đã kiểm tra tồn kho và xác nhận xuất đơn";
    else if (nextStatus === "SHIPPING") noteInput.placeholder = "Ví dụ: Đã đóng gói và bàn giao ShopEase Express";
    else if (nextStatus === "COMPLETED") noteInput.placeholder = "Ví dụ: Khách hàng đã nhận đủ hàng và thanh toán";
  }

  const modal = document.getElementById("modal-confirm-status");
  if (modal) modal.classList.add("show");
};

async function executeStatusChange() {
  if (!pendingStatusChange) return;

  const btnSubmit = document.getElementById("btn-submit-status-change");
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="btn-op-spinner"></span> Đang xử lý...`;
  }

  const noteVal = document.getElementById("status-change-note")?.value.trim() || null;

  try {
    await api.put(`/orders/${pendingStatusChange.id}/status`, {
      status: pendingStatusChange.nextStatus,
      note: noteVal,
    });

    const nextLabel = ORDER_STATUS_MAP[pendingStatusChange.nextStatus]?.label || pendingStatusChange.nextStatus;
    showToast(`Đã chuyển đơn hàng #${pendingStatusChange.orderCode} sang trạng thái "${nextLabel}" thành công!`, "success");

    closeAllModals();
    await loadOrdersData();

  } catch (err) {
    console.error("[Admin Orders] Lỗi đổi trạng thái đơn:", err);
    showToast(err.message || "Không thể cập nhật trạng thái đơn hàng.", "error");
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<span>Xác nhận cập nhật</span>`;
    }
    pendingStatusChange = null;
  }
}

// ==========================================================
// 8. XÁC NHẬN ĐÃ NHẬN TIỀN CHUYỂN KHOẢN (BANK TRANSFER)
// ==========================================================
window.openBankConfirmModal = function(orderId, orderCode, totalAmount, receiverName) {
  pendingBankConfirm = {
    id: orderId,
    orderCode: orderCode,
    totalAmount: totalAmount,
    receiverName: receiverName,
  };

  document.getElementById("bank-confirm-order-code").textContent = orderCode;
  document.getElementById("bank-confirm-receiver").textContent = receiverName;
  document.getElementById("bank-confirm-amount").textContent = typeof formatMoney === "function" ? formatMoney(totalAmount) : `${totalAmount} ₫`;

  const chk = document.getElementById("chk-bank-verified");
  const btnSubmit = document.getElementById("btn-submit-bank-confirm");
  if (chk) chk.checked = false;
  if (btnSubmit) btnSubmit.disabled = true;

  const modal = document.getElementById("modal-confirm-bank");
  if (modal) modal.classList.add("show");
};

async function executeBankConfirmation() {
  if (!pendingBankConfirm) return;

  const btnSubmit = document.getElementById("btn-submit-bank-confirm");
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="btn-op-spinner"></span> Đang xử lý...`;
  }

  try {
    // Chuyển đơn hàng từ PENDING sang CONFIRMED kèm ghi chú rõ ràng
    await api.put(`/orders/${pendingBankConfirm.id}/status`, {
      status: "CONFIRMED",
      note: "Xác nhận đã nhận đủ tiền chuyển khoản ngân hàng",
    });

    showToast(`Đã xác nhận thanh toán chuyển khoản và duyệt đơn hàng #${pendingBankConfirm.orderCode} thành công!`, "success");

    closeAllModals();
    await loadOrdersData();

  } catch (err) {
    console.error("[Admin Orders] Lỗi xác nhận chuyển khoản:", err);
    showToast(err.message || "Không thể xác nhận chuyển khoản lúc này.", "error");
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<span>Xác nhận & Duyệt đơn</span>`;
    }
    pendingBankConfirm = null;
  }
}

// ==========================================================
// 9. HỦY ĐƠN HÀNG KÈM LÝ DO BẮT BUỘC (FR-027)
// ==========================================================
window.openCancelOrderModal = function(orderId, orderCode) {
  pendingCancelOrder = { id: orderId, orderCode: orderCode };

  document.getElementById("cancel-order-code-display").textContent = `#${orderCode}`;
  const selectPreset = document.getElementById("cancel-preset-select");
  const textareaReason = document.getElementById("cancel-detail-reason");
  const counter = document.getElementById("cancel-char-counter");
  const errorText = document.getElementById("cancel-error-text");

  if (selectPreset) selectPreset.value = "";
  if (textareaReason) textareaReason.value = "";
  if (counter) counter.textContent = "0 / 255 ký tự";
  if (errorText) {
    errorText.style.display = "none";
    errorText.textContent = "";
  }

  const modal = document.getElementById("modal-cancel-order");
  if (modal) modal.classList.add("show");
};

async function executeCancelOrder() {
  if (!pendingCancelOrder) return;

  const textareaReason = document.getElementById("cancel-detail-reason");
  const errorText = document.getElementById("cancel-error-text");
  const btnSubmit = document.getElementById("btn-submit-order-cancel");

  const reason = textareaReason ? textareaReason.value.trim() : "";

  if (!reason) {
    if (errorText) {
      errorText.textContent = "Vui lòng nhập hoặc chọn lý do hủy đơn hàng.";
      errorText.style.display = "block";
    }
    if (textareaReason) textareaReason.focus();
    return;
  }

  if (reason.length > 255) {
    if (errorText) {
      errorText.textContent = "Lý do hủy đơn không được dài quá 255 ký tự.";
      errorText.style.display = "block";
    }
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="btn-op-spinner"></span> Đang hủy đơn...`;
  }

  try {
    await api.post(`/orders/${pendingCancelOrder.id}/cancel`, {
      cancel_reason: reason,
    });

    showToast(`Hủy đơn hàng #${pendingCancelOrder.orderCode} thành công! Số lượng sản phẩm đã được tự động hoàn lại vào kho.`, "success");

    closeAllModals();
    await loadOrdersData();

  } catch (err) {
    console.error("[Admin Orders] Lỗi khi hủy đơn hàng:", err);
    if (errorText) {
      errorText.textContent = err.message || "Không thể hủy đơn hàng lúc này.";
      errorText.style.display = "block";
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<span>Xác nhận hủy đơn</span>`;
    }
  }
}

// ==========================================================
// 10. MODAL HANDLING & GÁN SỰ KIỆN NÚT
// ==========================================================
function initModals() {
  // Gán sự kiện cho các nút đóng modal qua attribute data-close="..."
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close");
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove("show");
    });
  });

  // Click ra ngoài overlay để đóng modal
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("admin-modal-overlay")) {
      e.target.classList.remove("show");
    }
  });

  // Sự kiện phím Esc đóng modal
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllModals();
    }
  });
}

function closeAllModals() {
  document.querySelectorAll(".admin-modal-overlay").forEach(m => m.classList.remove("show"));
}

function initActionButtons() {
  // Nút xác nhận đổi trạng thái
  const btnSubmitStatus = document.getElementById("btn-submit-status-change");
  if (btnSubmitStatus) {
    btnSubmitStatus.addEventListener("click", executeStatusChange);
  }

  // Checkbox xác nhận tiền về tài khoản
  const chkBank = document.getElementById("chk-bank-verified");
  const btnBankConfirm = document.getElementById("btn-submit-bank-confirm");
  if (chkBank && btnBankConfirm) {
    chkBank.addEventListener("change", (e) => {
      btnBankConfirm.disabled = !e.target.checked;
    });
    btnBankConfirm.addEventListener("click", executeBankConfirmation);
  }

  // Lý do định sẵn tự điền vào textarea hủy đơn
  const selectPreset = document.getElementById("cancel-preset-select");
  const textareaReason = document.getElementById("cancel-detail-reason");
  const counter = document.getElementById("cancel-char-counter");

  if (selectPreset && textareaReason) {
    selectPreset.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val && val !== "other") {
        textareaReason.value = val;
        if (counter) counter.textContent = `${val.length} / 255 ký tự`;
      }
    });

    textareaReason.addEventListener("input", (e) => {
      const len = e.target.value.length;
      if (counter) {
        counter.textContent = `${len} / 255 ký tự`;
        counter.style.color = len > 255 ? "#dc2626" : "var(--admin-text-muted)";
      }
    });
  }

  // Nút gửi hủy đơn
  const btnSubmitCancel = document.getElementById("btn-submit-order-cancel");
  if (btnSubmitCancel) {
    btnSubmitCancel.addEventListener("click", executeCancelOrder);
  }
}

// ==========================================================
// 11. XUẤT DANH SÁCH ĐƠN HÀNG RA CSV (EXPORT DATA)
// ==========================================================
function exportOrdersToCsv() {
  if (!cachedOrdersList || cachedOrdersList.length === 0) {
    showToast("Không có dữ liệu đơn hàng nào để xuất danh sách.", "warning");
    return;
  }

  const headers = [
    "Mã đơn hàng",
    "Người nhận",
    "Số điện thoại",
    "Địa chỉ giao hàng",
    "Phương thức thanh toán",
    "Tiền hàng tạm tính (VNĐ)",
    "Phí vận chuyển (VNĐ)",
    "Tổng tiền (VNĐ)",
    "Trạng thái",
    "Ngày tạo đơn",
    "Ghi chú",
    "Lý do hủy (nếu có)"
  ];

  const rows = cachedOrdersList.map(o => {
    const code = o.order_code || `DH-${o.id}`;
    const statusLabel = ORDER_STATUS_MAP[normalizeStatus(o.status)]?.label || o.status;
    const pm = o.payment_method === "BANK_TRANSFER" ? "Chuyển khoản" : "COD";
    const subtotal = o.subtotal_amount || (o.total_amount - (o.shipping_fee || 0));

    return [
      `"${code}"`,
      `"${(o.receiver_name || "").replace(/"/g, '""')}"`,
      `"${(o.receiver_phone || "").replace(/"/g, '""')}"`,
      `"${(o.shipping_address || "").replace(/"/g, '""')}"`,
      `"${pm}"`,
      subtotal,
      o.shipping_fee || 0,
      o.total_amount,
      `"${statusLabel}"`,
      `"${o.created_at || ""}"`,
      `"${(o.note || "").replace(/"/g, '""')}"`,
      `"${(o.cancel_reason || "").replace(/"/g, '""')}"`
    ].join(",");
  });

  // UTF-8 BOM để Excel hiển thị tiếng Việt chuẩn
  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const todayStr = new Date().toISOString().substring(0, 10);

  link.setAttribute("href", url);
  link.setAttribute("download", `ShopEase_DonHang_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`Đã xuất thành công ${cachedOrdersList.length} đơn hàng ra tệp CSV!`, "success");
}

// ==========================================================
// 12. KIỂM TRA QUERY PARAM (?id=...) MỞ MODAL TỰ ĐỘNG
// ==========================================================
function checkUrlParamsForDetail() {
  const params = new URLSearchParams(window.location.search);
  const targetId = params.get("id");
  if (targetId) {
    openOrderDetailModal(targetId);
  }
}

// ==========================================================
// 13. WEBSOCKET REAL-TIME CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG
// ==========================================================
function initRealtimeWebSocket() {
  const wsUrl = (typeof CONFIG !== "undefined" && CONFIG.WS_URL)
    ? CONFIG.WS_URL
    : "ws://127.0.0.1:8000/ws/dashboard";

  try {
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ORDER_UPDATED" || data.type === "NEW_ORDER" || data.type === "DASHBOARD_STATS_UPDATE") {
          console.log("[Admin Orders] Nhận tín hiệu thời gian thực từ server:", data);
          // Tự động làm mới danh sách đơn trong nền
          loadOrdersKpiSummary();
          fetchOrdersTable();
        }
      } catch (_) {}
    };

    ws.onerror = () => {
      // Yên lặng bỏ qua nếu WebSocket không sẵn sàng
    };
  } catch (_) {}
}
