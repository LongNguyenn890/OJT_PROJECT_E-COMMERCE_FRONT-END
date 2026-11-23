// Layout chung: tự chèn header (menu) và footer vào mọi trang,
// quản lý phân quyền giao diện (RBAC) và bảo vệ trang quản trị (Route Guard).

// ==========================================================
// 1. ROUTE GUARD: BẢO VỆ VÀ CHẶN TRANG QUẢN TRỊ
// ==========================================================
function checkRouteGuard() {
  const root = document.body.dataset.root || "./";
  const currentPath = window.location.pathname;

  // Nhận diện trang quản trị qua data-auth="admin" hoặc tên file có chứa "admin-"
  const isAdminPage = document.body.dataset.auth === "admin" ||
                      currentPath.includes("/admin-") ||
                      currentPath.includes("/admin/");
  const isAuthRequired = document.body.dataset.auth === "required";

  const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
  let user = typeof Auth !== "undefined" ? Auth.getUser() : null;
  if (!user) {
    try {
      user = JSON.parse(localStorage.getItem("user") || "null");
    } catch (_) {}
  }

  // Chặn trang yêu cầu đăng nhập
  if (isAuthRequired) {
    if (!token) {
      sessionStorage.setItem("auth_message", "Vui lòng đăng nhập để xem thông tin trang này.");
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `${root}pages/login.html?redirect=${encodeURIComponent(currentUrl)}`;
      return false;
    }
    if (!user || !user.id) {
      if (typeof Auth !== "undefined" && Auth.clearSession) {
        Auth.clearSession();
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
      sessionStorage.setItem("auth_message", "Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.");
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `${root}pages/login.html?redirect=${encodeURIComponent(currentUrl)}`;
      return false;
    }
  }

  if (isAdminPage) {
    // 1. Chưa đăng nhập: Chuyển hướng về trang login kèm redirect URL
    if (!token) {
      sessionStorage.setItem("auth_message", "Vui lòng đăng nhập với tài khoản Quản trị viên để tiếp tục.");
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `${root}pages/login.html?redirect=${encodeURIComponent(currentUrl)}`;
      return false;
    }
    if (!user || !user.id) {
      if (typeof Auth !== "undefined" && Auth.clearSession) {
        Auth.clearSession();
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
      sessionStorage.setItem("auth_message", "Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.");
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `${root}pages/login.html?redirect=${encodeURIComponent(currentUrl)}`;
      return false;
    }

    // 2. Chặn riêng trang Quản lý nhân viên nếu không phải ADMIN
    const isStaffPage = currentPath.includes("admin-staff") || currentPath.includes("admin-users");
    const role = (user.role || "").toUpperCase();
    if (isStaffPage && role !== "ADMIN") {
      sessionStorage.setItem("pending_toast", JSON.stringify({
        message: "Truy cập bị từ chối! Bạn không có quyền truy cập trang Quản lý nhân viên. Chỉ Quản trị viên (ADMIN) mới có quyền truy cập.",
        type: "error"
      }));
      window.location.href = role === "STAFF" ? `${root}pages/admin-dashboard.html` : `${root}pages/customer-home.html`;
      return false;
    }

    // 3. Đã đăng nhập nhưng không có vai trò ADMIN hoặc STAFF: Chặn và đá về trang chủ
    if (role !== "ADMIN" && role !== "STAFF") {
      sessionStorage.setItem("pending_toast", JSON.stringify({
        message: "Truy cập bị từ chối! Tài khoản của bạn không có quyền quản trị hệ thống.",
        type: "error"
      }));
      window.location.href = `${root}pages/customer-home.html`;
      return false;
    }
  }

  return true;
}

// Chạy kiểm tra bảo vệ trang ngay lập tức
if (!checkRouteGuard()) {
  // Tránh việc render tiếp giao diện khi đã bị redirect
  console.warn("Chặn truy cập bởi Route Guard");
}

// ==========================================================
// 2. RENDER LAYOUT QUẢN TRỊ VIÊN & NHÂN VIÊN (ADMIN SIDEBAR & TOPBAR)
// Dùng chung cho toàn bộ thành viên nhóm theo chuẩn Figma Design (FR-041, FR-036)
// ==========================================================
function renderAdminLayout() {
  const sidebarElem = document.getElementById("admin-sidebar");
  const topbarElem = document.getElementById("admin-topbar");
  if (!sidebarElem && !topbarElem) return;

  const root = document.body.dataset.root || "./";
  const currentPath = window.location.pathname;

  const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
  let user = typeof Auth !== "undefined" ? Auth.getUser() : null;
  if (!user) {
    try {
      user = JSON.parse(localStorage.getItem("user") || "null");
    } catch (_) {}
  }

  const role = (user?.role || "").toUpperCase();
  const isAdmin = role === "ADMIN";
  const isStaff = role === "STAFF";

  const rawName = user?.full_name || user?.name || user?.email || (isAdmin ? "Nguyễn Thu Hà" : "Nhân viên vận hành");
  const displayName = typeof capitalizeWords === "function" ? capitalizeWords(rawName) : rawName;

  let avatarSrc = `${root}assets/images/avt người dùng.svg`;
  if (user && user.avatar) {
    if (user.avatar.startsWith("http") || user.avatar.startsWith("data:") || user.avatar.startsWith("blob:")) {
      avatarSrc = user.avatar;
    } else {
      const origin = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL)
        ? CONFIG.API_BASE_URL.replace(/\/api\/?$/, "")
        : "";
      avatarSrc = `${origin}${user.avatar.startsWith("/") ? "" : "/"}${user.avatar}`;
    }
  }

  // Phân tích URL hiện tại để gán active state cho menu item
  const isDashboardActive = currentPath.endsWith("/admin-dashboard.html") || currentPath.endsWith("/admin-dashboard");
  const isStaffActive = currentPath.endsWith("/admin-staff.html");
  const isCustomersActive = currentPath.endsWith("/admin-customers.html") || currentPath.endsWith("/customer-management.html") || currentPath.endsWith("/admin-users.html");
  const isProductsActive = currentPath.endsWith("/admin-products.html") || currentPath.endsWith("/items.html");
  const isCategoriesActive = currentPath.endsWith("/admin-categories.html");
  const isOrdersActive = currentPath.endsWith("/admin-orders.html");
  const isPosActive = currentPath.endsWith("/admin-pos.html");
  const isInventoryActive = currentPath.endsWith("/admin-inventory.html");
  const isReportsActive = currentPath.endsWith("/admin-reports.html");

  if (sidebarElem) {
    sidebarElem.innerHTML = `
      <div class="admin-sidebar-brand">
        <a href="${root}pages/admin-dashboard.html" class="admin-brand-link">
          <img src="${root}assets/images/logo_shop.svg" alt="ShopEase" class="admin-brand-logo">
          <div class="admin-brand-text-wrap">
            <span class="admin-brand-name">ShopEase</span>
            <span class="admin-brand-subtitle">Admin Console</span>
          </div>
        </a>
      </div>

      <div class="admin-sidebar-menu-wrap">
        <div class="admin-nav-group-title">QUẢN TRỊ HỆ THỐNG</div>
        <nav class="admin-sidebar-menu">
          <a href="${root}pages/admin-dashboard.html" class="admin-nav-item ${isDashboardActive ? "active" : ""}">
            <svg class="admin-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
            <span>Tổng quan</span>
          </a>

          <a href="${root}pages/admin-orders.html" class="admin-nav-item ${isOrdersActive ? "active" : ""}">
            <svg class="admin-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span>Quản lý Đơn hàng</span>
          </a>

          <a href="${root}pages/admin-pos.html" class="admin-nav-item ${isPosActive ? "active" : ""}">
            <svg class="admin-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/><line x1="12" y1="17" x2="12" y2="20"/></svg>
            <span>Bán tại quầy (POS)</span>
          </a>

          <a href="${root}pages/admin-products.html" class="admin-nav-item ${isProductsActive ? "active" : ""}">
            <svg class="admin-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            <span>Quản lý Sản phẩm</span>
          </a>

          <a href="${root}pages/admin-categories.html" class="admin-nav-item ${isCategoriesActive ? "active" : ""}">
            <svg class="admin-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Quản lý Danh mục</span>
          </a>

          <a href="${root}pages/admin-inventory.html" class="admin-nav-item ${isInventoryActive ? "active" : ""}">
            <svg class="admin-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            <span>Quản lý Kho hàng</span>
          </a>

          ${isAdmin ? `
          <a href="${root}pages/admin-staff.html" class="admin-nav-item ${isStaffActive ? "active" : ""}">
            <svg class="admin-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Quản lý Nhân viên</span>
          </a>
          ` : ""}

          <a href="${root}pages/admin-customers.html" class="admin-nav-item ${isCustomersActive ? "active" : ""}">
            <svg class="admin-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Quản lý Khách hàng</span>
          </a>

          <a href="${root}pages/admin-reports.html" class="admin-nav-item ${isReportsActive ? "active" : ""}">
            <svg class="admin-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            <span>Thống kê &amp; Báo cáo</span>
          </a>
        </nav>
      </div>

      <div class="admin-sidebar-bottom">
        <a href="${root}pages/customer-home.html" class="admin-sidebar-store-link">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Xem Cửa hàng bán lẻ</span>
        </a>
      </div>
    `;
  }

  if (topbarElem) {
    topbarElem.innerHTML = `
      <div class="admin-topbar-inner">
        <div class="admin-topbar-left">
          <button type="button" class="admin-hamburger" id="admin-sidebar-toggle" title="Thu gọn / Mở rộng Sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div class="admin-global-search">
            <svg class="admin-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="admin-search-input" placeholder="Tìm kiếm toàn cục (mã đơn, tên sản phẩm, khách hàng)..." aria-label="Tìm kiếm toàn cục">
          </div>
        </div>

        <div class="admin-topbar-right">
          <!-- Nút Thông báo cảnh báo tồn kho và đơn hàng với chấm đỏ -->
          <button type="button" class="admin-notify-btn" title="Thông báo cảnh báo tồn kho và đơn hàng" id="admin-notify-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span class="admin-notify-dot" id="admin-notify-badge" title="Có cảnh báo mới"></span>
          </button>

          <div class="admin-topbar-divider"></div>

          <!-- Thông tin Người dùng (Avatar + Tên + Chức danh theo Figma) -->
          <div class="admin-header-profile">
            <img src="${avatarSrc}" alt="${displayName}" class="admin-profile-avatar" onerror="this.src='${root}assets/images/avt người dùng.svg'">
            <div class="admin-profile-info">
              <div class="admin-profile-name">${displayName} (${isAdmin ? "Admin" : "Staff"})</div>
              <div class="admin-profile-role">${isAdmin ? "Quản trị viên trưởng" : "Nhân viên vận hành"}</div>
            </div>
          </div>

          <!-- Nút Đăng xuất màu đỏ #ba1a1a theo Figma -->
          <button type="button" class="admin-header-logout" id="admin-logout-btn" title="Đăng xuất">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    `;

    // Gắn sự kiện Đăng xuất
    const logoutBtn = topbarElem.querySelector("#admin-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (typeof Auth !== "undefined" && Auth.confirmLogout) {
          Auth.confirmLogout(root);
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = `${root}pages/login.html`;
        }
      });
    }

    // Gắn sự kiện click xem chi tiết thông báo trên Topbar
    const notifyBtn = topbarElem.querySelector("#admin-notify-btn");
    if (notifyBtn) {
      notifyBtn.addEventListener("click", () => {
        const pCount = typeof previousDashboardState !== "undefined" ? (previousDashboardState.countPending || 0) : 0;
        const lCount = typeof previousDashboardState !== "undefined" ? (previousDashboardState.lowStockCount || 0) : 0;
        
        let msg = "";
        if (pCount === 0 && lCount === 0) {
          msg = "✅ Hệ thống hiện tại không có cảnh báo nào chưa xử lý.";
        } else {
          const parts = [];
          if (pCount > 0) parts.push(`📋 ${pCount} đơn hàng mới cần xác nhận`);
          if (lCount > 0) parts.push(`⚠️ ${lCount} sản phẩm sắp hết hàng trong kho`);
          msg = parts.join(" · ");
        }
        if (typeof showToast === "function") {
          showToast(msg, pCount > 0 ? "warning" : "info");
        }
      });
    }

    // Hàm cập nhật huy hiệu số thông báo trên Topbar chuẩn xác tuyệt đối
    window.updateAdminNotificationBadge = function(pendingOrdersCount, lowStockCount) {
      const btn = document.getElementById("admin-notify-btn");
      const badge = document.getElementById("admin-notify-badge") || document.querySelector(".admin-notify-dot");
      if (!badge) return;
      const pCount = Math.max(0, Number(pendingOrdersCount) || 0);
      const lCount = Math.max(0, Number(lowStockCount) || 0);
      const total = pCount + lCount;

      if (total === 0) {
        badge.style.display = "none";
        if (btn) btn.title = "Không có thông báo mới";
      } else {
        badge.style.display = "inline-flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        if (pCount > 0) {
          badge.textContent = pCount > 9 ? "9+" : String(pCount);
          badge.style.minWidth = "16px";
          badge.style.height = "16px";
          badge.style.fontSize = "10px";
          badge.style.fontWeight = "700";
          badge.style.color = "#ffffff";
          badge.style.padding = "0 3px";
          badge.style.borderRadius = "10px";
          badge.style.top = "4px";
          badge.style.right = "4px";
        } else {
          badge.textContent = "";
          badge.style.width = "9px";
          badge.style.height = "9px";
          badge.style.borderRadius = "50%";
          badge.style.padding = "0";
          badge.style.top = "8px";
          badge.style.right = "8px";
        }
        const desc = [];
        if (pCount > 0) desc.push(`${pCount} đơn hàng cần xác nhận`);
        if (lCount > 0) desc.push(`${lCount} mặt hàng tồn kho thấp`);
        if (btn) btn.title = `Thông báo: ${desc.join(" · ")}`;
      }
    };

    // Gắn sự kiện Hamburger menu cho tablet/mobile
    const toggleBtn = topbarElem.querySelector("#admin-sidebar-toggle");
    if (toggleBtn && sidebarElem) {
      let backdrop = document.querySelector(".admin-sidebar-backdrop");
      if (!backdrop) {
        backdrop = document.createElement("div");
        backdrop.className = "admin-sidebar-backdrop";
        document.body.appendChild(backdrop);
      }

      toggleBtn.addEventListener("click", () => {
        const isShow = sidebarElem.classList.toggle("show");
        backdrop.classList.toggle("show", isShow);
      });

      backdrop.addEventListener("click", () => {
        sidebarElem.classList.remove("show");
        backdrop.classList.remove("show");
      });
    }
  }
}

// ==========================================================
// 3. RENDER HEADER & FOOTER CHO TRANG KHÁCH HÀNG (SHOP CLIENT)
// ==========================================================
function renderLayout() {
  if (document.body.classList.contains("admin-page") || document.getElementById("admin-sidebar") || document.getElementById("admin-topbar")) {
    renderAdminLayout();
    return;
  }

  const headerElem = document.getElementById("app-header");
  const footerElem = document.getElementById("app-footer");
  if (!headerElem && !footerElem) return;

  const root = document.body.dataset.root || "./";
  const currentPath = window.location.pathname;

  if (document.body.classList.contains("shop-page")) {
    const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
    let user = typeof Auth !== "undefined" ? Auth.getUser() : null;
    if (!user) {
      try {
        user = JSON.parse(localStorage.getItem("user") || "null");
      } catch (_) {}
    }

    const role = (user?.role || "").toUpperCase();
    const isAdminOrStaff = role === "ADMIN" || role === "STAFF";

    // Phân tích đường dẫn và hash hiện tại để highlight tab tương ứng
    const isCustomerHome = currentPath.endsWith("/customer-home.html") || currentPath.endsWith("/") || currentPath.endsWith("/index.html");
    const isProfile = currentPath.endsWith("/profile.html");
    const isOrders = currentPath.endsWith("/my_orders.html") || currentPath.endsWith("/my-orders.html");
    const isAdmin = currentPath.endsWith("/admin-dashboard.html");
    const currentHash = window.location.hash || "";

    const isHomeActive = isCustomerHome && !currentHash.includes("products") && !currentHash.includes("categories");
    const isProductsActive = isCustomerHome && currentHash.includes("products");
    const isCategoriesActive = isCustomerHome && currentHash.includes("categories");
    const isOrdersActive = isOrders;
    const isAddressesActive = isProfile && currentHash.includes("address");
    const isProfileActive = isProfile && !isAddressesActive;
    const isAdminActive = isAdmin;

    // Ảnh đại diện thực tế của người dùng
    let avatarSrc = `${root}assets/images/avt người dùng.svg`;
    if (user && user.avatar) {
      if (user.avatar.startsWith("http") || user.avatar.startsWith("data:") || user.avatar.startsWith("blob:")) {
        avatarSrc = user.avatar;
      } else {
        const origin = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL)
          ? CONFIG.API_BASE_URL.replace(/\/api\/?$/, "")
          : "";
        avatarSrc = `${origin}${user.avatar.startsWith("/") ? "" : "/"}${user.avatar}`;
      }
    }

    let userSectionHtml = "";
    if (token && user) {
      const rawName = user.full_name || user.email || "";
      const displayName = typeof capitalizeWords === "function" && user.full_name
        ? capitalizeWords(user.full_name)
        : rawName;
      userSectionHtml = `
        <div class="user-tool-wrapper">
          <div class="user-tool" id="shop-user-profile" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false" title="Tài khoản cá nhân: ${escapeHtml(displayName)}">
            <img src="${escapeHtml(avatarSrc)}" alt="Avatar" onerror="this.src='${root}assets/images/avt người dùng.svg'">
            <div class="header-tool-meta">
              <small>Xin chào,</small>
              <span class="user-tool-name">${escapeHtml(displayName)}</span>
            </div>
            <svg class="user-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="user-dropdown-menu" id="user-dropdown-menu">
            <a href="${root}pages/profile.html" class="user-dropdown-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>Hồ sơ cá nhân</span>
            </a>
            <a href="${root}pages/profile.html#addresses" class="user-dropdown-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Sổ địa chỉ</span>
            </a>
            <a href="${root}pages/cart.html" class="user-dropdown-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
              <span>Giỏ hàng của tôi</span>
            </a>
            <a href="${root}pages/wishlist.html" class="user-dropdown-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              <span>Sản phẩm yêu thích</span>
            </a>
            <a href="${root}pages/my_orders.html" class="user-dropdown-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3.75h8.5L20 8.2v11.05A1.75 1.75 0 0 1 18.25 21h-11A1.75 1.75 0 0 1 5.5 19.25v-13A2.5 2.5 0 0 1 8 3.75Z"/><path d="M15 4v4.5h4.5M8.5 12h7M8.5 15.5h7"/></svg>
              <span>Đơn mua của tôi</span>
            </a>
            ${isAdminOrStaff ? `
              <a href="${root}pages/admin-dashboard.html" class="user-dropdown-item user-dropdown-admin">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>Trang quản trị</span>
              </a>
            ` : ""}
            <div class="user-dropdown-divider"></div>
            <button type="button" class="user-dropdown-item user-dropdown-logout" id="shop-logout-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      `;
    } else {
      userSectionHtml = `
        <a href="${root}pages/login.html" class="user-tool user-tool-guest" title="Đăng nhập hoặc Đăng ký">
          <img src="${root}assets/images/avt người dùng.svg" alt="Avatar">
          <div class="user-tool-meta">
            <small>Đăng nhập / Đăng ký</small>
            <span class="user-tool-name">Tài khoản</span>
          </div>
        </a>
      `;
    }

    // Xây dựng danh sách liên kết Navbar đồng bộ cho toàn bộ hệ thống
    let navLinksHtml = `
      <a href="${root}pages/customer-home.html" class="${isHomeActive ? "selected" : ""}" id="nav-link-home">
        Trang chủ
      </a>
      <a href="${root}pages/customer-home.html#categories" class="${isCategoriesActive ? "selected" : ""}" id="nav-link-categories">
        Danh mục ngành hàng
      </a>
      <a href="${root}pages/customer-home.html#products" class="${isProductsActive ? "selected" : ""}" id="nav-link-products">
        Tất cả sản phẩm
      </a>
    `;

    if (token && user) {
      navLinksHtml += `
        <a href="${root}pages/my_orders.html" class="${isOrdersActive ? "selected" : ""}" id="nav-link-orders">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: -2px;"><path d="M7 3.75h8.5L20 8.2v11.05A1.75 1.75 0 0 1 18.25 21h-11A1.75 1.75 0 0 1 5.5 19.25v-13A2.5 2.5 0 0 1 8 3.75Z"/><path d="M15 4v4.5h4.5M8.5 12h7M8.5 15.5h7"/></svg>
          Đơn mua của tôi
        </a>
        <a href="${root}pages/profile.html" class="${isProfileActive ? "selected" : ""}" id="nav-link-profile">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: -2px;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Hồ sơ cá nhân
        </a>
        <a href="${root}pages/profile.html#addresses" class="${isAddressesActive ? "selected" : ""}" id="nav-link-addresses">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: -2px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          Sổ địa chỉ
        </a>
      `;

      if (isAdminOrStaff) {
        navLinksHtml += `
          <a href="${root}pages/admin-dashboard.html" class="${isAdminActive ? "selected" : ""} shop-nav-admin" id="nav-link-admin">
            <span class="nav-admin-badge">⚡ Trang quản trị</span>
          </a>
        `;
      }
    }

    navLinksHtml += `
      <span class="nav-spacer"></span>
      <span class="shop-nav-highlight">
        <img src="${root}assets/images/COD.svg" alt=""> COD toàn quốc
      </span>
      <span class="shop-nav-highlight">
        <img src="${root}assets/images/đổi trả.svg" alt=""> Đổi trả 7 ngày
      </span>
      <span class="shop-nav-highlight">
        <img src="${root}assets/images/giao hàng.svg" alt=""> Miễn phí giao hàng
      </span>
    `;

    document.getElementById("app-header").innerHTML = `
      <div class="shop-header-bar">
        <div class="shop-header-inner">
          <a href="${root}pages/customer-home.html" class="shop-brand" title="Về trang chủ ShopEase">
            <img src="${root}assets/images/logo_shop.svg" alt="ShopEase Logo">
            <span>ShopEase<small>Mua sắm dễ dàng mỗi ngày</small></span>
          </a>
          <div class="header-search">
            <input id="shop-search" type="search" placeholder="Tìm kiếm sản phẩm, thương hiệu... (Ctrl + K)" autocomplete="off">
            <button type="button" id="search-submit" title="Tìm kiếm">⌕ Tìm</button>
            <div class="search-suggest-dropdown" id="search-suggest-dropdown" hidden></div>
          </div>
          <div class="header-tools">
            <!-- 1. Hotline CSKH -->
            <a href="tel:19006868" class="header-hotline-link" title="Tổng đài CSKH 24/7">
              <img src="${root}assets/images/tổng đài.svg" alt="">
              <div class="header-tool-meta">
                <small>Tổng đài CSKH</small>
                <b>1900 6868</b>
              </div>
            </a>

            <!-- 2. Tra cứu Đơn mua kèm bảng thông báo đơn hàng trực tiếp bên dưới nút -->
            <div class="orders-tool-wrapper">
              <button class="orders-tool" id="shop-orders-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="shop-orders-panel" title="Đơn mua gần đây">
                <div class="orders-icon-wrap">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.75h8.5L20 8.2v11.05A1.75 1.75 0 0 1 18.25 21h-11A1.75 1.75 0 0 1 5.5 19.25v-13A2.5 2.5 0 0 1 8 3.75Z"/><path d="M15 4v4.5h4.5M8.5 12h7M8.5 15.5h7"/></svg>
                </div>
                <div class="header-tool-meta">
                  <small>Tra cứu</small>
                  <b>Đơn mua</b>
                </div>
              </button>

              <section class="orders-panel order-notify-panel" id="shop-orders-panel" hidden aria-label="Thông báo đơn hàng">
                <div class="orders-panel-heading">
                  <div class="notify-heading-title">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                    <span>Cập nhật đơn hàng</span>
                  </div>
                  <a href="${root}pages/my_orders.html" class="notify-view-all-link">Xem tất cả ›</a>
                </div>
                <div class="orders-panel-content" id="shop-orders-content">
                  <!-- Render động danh sách thông báo đơn hàng -->
                </div>
                <div class="orders-panel-footer">
                  <a href="${root}pages/my_orders.html" class="btn-all-orders">Xem tất cả đơn mua của tôi</a>
                </div>
              </section>
            </div>

            <!-- 3. Danh sách Yêu thích -->
            <a href="${root}pages/wishlist.html" class="wishlist-tool" id="shop-wishlist-btn" title="Danh sách sản phẩm yêu thích">
              <div class="wishlist-icon-wrapper">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <i id="wishlist-count" style="display: none;">0</i>
              </div>
              <div class="header-tool-meta">
                <small id="wishlist-count-label">0 sản phẩm</small>
                <b>Yêu thích</b>
              </div>
            </a>

            <!-- 4. Tài khoản người dùng (Kèm menu dropdown) -->
            ${userSectionHtml}

            <!-- 5. Giỏ hàng (Nổi bật góc ngoài cùng bên phải) -->
            <button class="cart-tool" id="shop-cart-btn" aria-label="Giỏ hàng" title="Giỏ hàng của bạn">
              <div class="cart-icon-wrapper">
                <img src="${root}assets/images/giỏ hàng.svg" alt="">
                <i id="cart-count" style="display: none;">0</i>
              </div>
              <div class="header-tool-meta">
                <small id="cart-count-label">0 sản phẩm</small>
                <b>Giỏ hàng</b>
              </div>
            </button>
          </div>
        </div>
      </div>
      <div class="shop-nav-bar">
        <nav class="shop-nav" aria-label="Menu điều hướng chính">
          ${navLinksHtml}
        </nav>
      </div>`;

    // 1. Quản lý tương tác Dropdown menu tài khoản (Hover mở tự nhiên + Grace period di chuột + Click toggle)
    const shopUserProfile = document.getElementById("shop-user-profile");
    const userToolWrapper = document.querySelector(".user-tool-wrapper");
    const userDropdownMenu = document.getElementById("user-dropdown-menu");
    if (shopUserProfile && userToolWrapper) {
      let userMenuCloseTimer = null;

      const openUserMenu = () => {
        if (userMenuCloseTimer) {
          clearTimeout(userMenuCloseTimer);
          userMenuCloseTimer = null;
        }
        userToolWrapper.classList.add("active");
        shopUserProfile.setAttribute("aria-expanded", "true");
        if (userDropdownMenu) userDropdownMenu.style.display = "";
      };

      const closeUserMenu = (immediate = false) => {
        if (userMenuCloseTimer) {
          clearTimeout(userMenuCloseTimer);
          userMenuCloseTimer = null;
        }
        if (immediate) {
          userToolWrapper.classList.remove("active");
          shopUserProfile.setAttribute("aria-expanded", "false");
          if (userDropdownMenu) userDropdownMenu.style.display = "";
        } else {
          // Grace period 280ms cho phép chuột di chuyển thoải mái từ avatar vào menu mà không bị tắt đột ngột
          userMenuCloseTimer = setTimeout(() => {
            userToolWrapper.classList.remove("active");
            shopUserProfile.setAttribute("aria-expanded", "false");
            if (userDropdownMenu) userDropdownMenu.style.display = "";
          }, 280);
        }
      };

      // Hover mở dropdown và giữ menu khi chuột di vào trong dropdown
      userToolWrapper.addEventListener("mouseenter", () => {
        openUserMenu();
      });

      userToolWrapper.addEventListener("mouseleave", () => {
        closeUserMenu(false);
      });

      // Hỗ trợ click toggle nếu người dùng bấm vào
      const toggleUserMenu = (e) => {
        e.stopPropagation();
        if (userMenuCloseTimer) {
          clearTimeout(userMenuCloseTimer);
          userMenuCloseTimer = null;
        }
        const isOpen = userToolWrapper.classList.toggle("active");
        shopUserProfile.setAttribute("aria-expanded", isOpen ? "true" : "false");
        if (userDropdownMenu) userDropdownMenu.style.display = "";
      };

      shopUserProfile.addEventListener("click", toggleUserMenu);
      shopUserProfile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleUserMenu(e);
        }
      });
    }

    if (userDropdownMenu && userToolWrapper) {
      userDropdownMenu.addEventListener("click", (e) => {
        // Đóng ngay khi click chọn một chức năng
        if (e.target.closest(".user-dropdown-item")) {
          userToolWrapper.classList.remove("active");
          if (shopUserProfile) shopUserProfile.setAttribute("aria-expanded", "false");
          if (userDropdownMenu) userDropdownMenu.style.display = "";
        }
      });
    }

    document.addEventListener("click", (e) => {
      if (userToolWrapper && !userToolWrapper.contains(e.target)) {
        userToolWrapper.classList.remove("active");
        if (shopUserProfile) shopUserProfile.setAttribute("aria-expanded", "false");
        if (userDropdownMenu) userDropdownMenu.style.display = "";
      }
    });

    // 2. Gắn sự kiện đăng xuất (hiện pop-up xác nhận modal)
    const shopLogoutBtn = document.getElementById("shop-logout-btn");
    if (shopLogoutBtn) {
      shopLogoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (userToolWrapper) {
          userToolWrapper.classList.remove("active");
          if (shopUserProfile) shopUserProfile.setAttribute("aria-expanded", "false");
        }
        if (typeof Auth !== "undefined" && typeof Auth.confirmLogout === "function") {
          Auth.confirmLogout(root);
        } else if (typeof showConfirmModal === "function") {
          showConfirmModal({
            title: "Xác nhận đăng xuất",
            message: "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản ShopEase không?",
            confirmText: "Đăng xuất",
            cancelText: "Hủy bỏ",
            type: "danger",
            onConfirm: () => {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              sessionStorage.setItem("pending_toast", JSON.stringify({
                message: "Bạn đã đăng xuất thành công.",
                type: "success"
              }));
              window.location.href = `${root}pages/login.html`;
            }
          });
        } else if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?")) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = `${root}pages/login.html`;
        }
      });
    }

    // 3. Gợi ý tìm kiếm (Debounce + Sản phẩm đã xem gần đây từ localStorage) & Tìm kiếm liên trang
    setupSearchSuggestions(root, isCustomerHome);

    // 4. Xử lý cuộn mượt nội trang & ScrollSpy tự động chuyển đổi mục active trên Navbar theo vị trí cuộn
    if (isCustomerHome) {
      const linkHome = document.getElementById("nav-link-home");
      const linkCategories = document.getElementById("nav-link-categories");
      const linkProducts = document.getElementById("nav-link-products");

      let isManualScrolling = false;
      let manualScrollTimer = null;

      const setActiveNav = (targetLink) => {
        [linkHome, linkCategories, linkProducts].forEach(link => {
          if (link) link.classList.remove("selected");
        });
        if (targetLink) targetLink.classList.add("selected");
      };

      const smoothScrollTo = (targetElem, targetLink) => {
        isManualScrolling = true;
        clearTimeout(manualScrollTimer);
        setActiveNav(targetLink);

        if (targetElem) {
          targetElem.scrollIntoView({ behavior: "smooth" });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }

        manualScrollTimer = setTimeout(() => {
          isManualScrolling = false;
        }, 800);
      };

      if (linkHome) {
        linkHome.addEventListener("click", (e) => {
          e.preventDefault();
          smoothScrollTo(null, linkHome);
          history.replaceState(null, "", window.location.pathname);
        });
      }
      if (linkCategories) {
        linkCategories.addEventListener("click", (e) => {
          e.preventDefault();
          smoothScrollTo(document.getElementById("categories"), linkCategories);
          history.replaceState(null, "", window.location.pathname + "#categories");
        });
      }
      if (linkProducts) {
        linkProducts.addEventListener("click", (e) => {
          e.preventDefault();
          smoothScrollTo(document.getElementById("products"), linkProducts);
          history.replaceState(null, "", window.location.pathname + "#products");
        });
      }

      // ScrollSpy: Theo dõi vị trí cuộn màn hình để đổi mục selected tương ứng
      const getElementTop = (elem) => {
        if (!elem) return Infinity;
        const rect = elem.getBoundingClientRect();
        return rect.top + window.scrollY;
      };

      let scrollTicking = false;
      const onScrollSpy = () => {
        if (isManualScrolling) return;

        const scrollPos = window.scrollY;
        // Điểm kích hoạt có tính bù chiều cao sticky header (~130px + buffer)
        const triggerPos = scrollPos + 160;

        // Nếu người dùng đang ở đầu trang (dưới 180px) -> "Trang chủ"
        if (scrollPos < 180) {
          setActiveNav(linkHome);
          return;
        }

        // Nếu cuộn chạm đáy trang -> "Tất cả sản phẩm"
        if (window.innerHeight + scrollPos >= document.documentElement.scrollHeight - 60) {
          setActiveNav(linkProducts);
          return;
        }

        const categoriesElem = document.getElementById("categories");
        const productsElem = document.getElementById("products");

        const categoriesTop = getElementTop(categoriesElem);
        const productsTop = getElementTop(productsElem);

        if (triggerPos >= productsTop) {
          setActiveNav(linkProducts);
        } else if (triggerPos >= categoriesTop) {
          setActiveNav(linkCategories);
        } else {
          setActiveNav(linkHome);
        }
      };

      window.addEventListener("scroll", () => {
        if (!scrollTicking) {
          window.requestAnimationFrame(() => {
            onScrollSpy();
            scrollTicking = false;
          });
          scrollTicking = true;
        }
      }, { passive: true });

      // Chạy kiểm tra sau khi tải trang hoặc khi có hash
      setTimeout(() => {
        if (window.location.hash.includes("products")) {
          setActiveNav(linkProducts);
        } else if (window.location.hash.includes("categories")) {
          setActiveNav(linkCategories);
        } else {
          onScrollSpy();
        }
      }, 300);
    }

    // 5. Đồng bộ số lượng giỏ hàng trên tất cả các trang
    window.refreshCartCount = async function () {
      const currentToken = localStorage.getItem("token");
      const countElem = document.getElementById("cart-count");
      const countLabelElem = document.getElementById("cart-count-label");

      const applyCartCount = (count) => {
        if (countElem) {
          countElem.textContent = count;
          countElem.style.display = count > 0 ? "inline-flex" : "none";
        }
        if (countLabelElem) countLabelElem.textContent = `${count} sản phẩm`;
        return count;
      };

      if (currentToken && typeof api !== "undefined" && api.get) {
        try {
          const cart = await api.get("/cart");
          const count = (cart?.cart_items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
          return applyCartCount(count);
        } catch (_) {}
      }

      // Fallback sang giỏ hàng local demo nếu chưa đăng nhập hoặc offline
      try {
        const demoCart = JSON.parse(localStorage.getItem("shopease_demo_cart_v1") || "[]");
        const count = demoCart.reduce((sum, item) => sum + Number(item.quantity || item.qty || 1), 0);
        return applyCartCount(count);
      } catch (_) {}

      return applyCartCount(0);
    };

    window.refreshCartCount();
    if (typeof Wishlist !== "undefined" && typeof Wishlist.updateBadges === "function") {
      Wishlist.updateBadges();
    }

    // Gắn sự kiện click mở trang giỏ hàng
    const shopCartBtn = document.getElementById("shop-cart-btn");
    if (shopCartBtn) {
      shopCartBtn.style.cursor = "pointer";
      shopCartBtn.addEventListener("click", () => {
        window.location.href = `${root}pages/cart.html`;
      });
    }

    // 6. Xử lý Tra cứu đơn mua hiển thị dạng dropdown Thông báo đơn hàng (Order Notification Dropdown)
    function getNotificationItemImg(path, rootPath) {
      if (!path) return `${rootPath}assets/images/logo_shop.svg`;
      if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
      const apiBase = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL.replace(/\/api\/?$/, "") : "";
      return `${apiBase}${path.startsWith("/") ? "" : "/"}${path}`;
    }

    function getOrderStatusNotifyInfo(statusStr, orderCode) {
      const s = String(statusStr || "").toLowerCase();
      if (s.includes("chờ") || s.includes("pending")) {
        return {
          type: "pending",
          badge: "Chờ xác nhận",
          title: `Đơn hàng #${orderCode} đã đặt`,
          message: "Đơn hàng đã được tạo thành công và đang chờ người bán xác nhận.",
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
        };
      }
      if (s.includes("đã xác nhận") || s.includes("confirmed")) {
        return {
          type: "confirmed",
          badge: "Đã xác nhận",
          title: `Đơn hàng #${orderCode} đã xác nhận`,
          message: "Người bán đã duyệt đơn và đang đóng gói sản phẩm gửi đi.",
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`
        };
      }
      if (s.includes("giao") || s.includes("shipping")) {
        return {
          type: "shipping",
          badge: "Đang giao",
          title: `Đơn hàng #${orderCode} đang giao`,
          message: "Đơn hàng đang trên đường vận chuyển và sẽ sớm được giao tận nơi đến bạn.",
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`
        };
      }
      if (s.includes("hoàn thành") || s.includes("completed") || s.includes("delivered") || s.includes("thành công")) {
        return {
          type: "completed",
          badge: "Giao thành công",
          title: `Giao thành công đơn #${orderCode}`,
          message: "Đơn hàng đã được giao thành công. Cảm ơn bạn đã tin tưởng mua sắm tại ShopEase!",
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
        };
      }
      if (s.includes("hủy") || s.includes("cancel")) {
        return {
          type: "cancelled",
          badge: "Đã hủy",
          title: `Đơn hàng #${orderCode} đã hủy`,
          message: "Đơn hàng đã được hủy thành công và hoàn trả số lượng vào kho hàng.",
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
        };
      }
      return {
        type: "confirmed",
        badge: statusStr || "Cập nhật",
        title: `Đơn hàng #${orderCode}`,
        message: "Thông tin cập nhật mới nhất cho đơn hàng của bạn.",
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
      };
    }

    function renderOrdersNotificationDropdown(orders, contentElem, rootPath) {
      if (!orders || orders.length === 0) {
        contentElem.innerHTML = `
          <div class="notify-empty-state">
            <div class="notify-empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </div>
            <p class="notify-empty-title">Chưa có thông báo đơn hàng</p>
            <p class="notify-empty-desc">Các cập nhật trạng thái đơn hàng của bạn sẽ được hiển thị tại đây.</p>
            <a href="${rootPath}pages/customer-home.html#products" class="notify-empty-btn">Khám phá sản phẩm</a>
          </div>
        `;
        return;
      }

      contentElem.innerHTML = orders.map(order => {
        const notifyInfo = getOrderStatusNotifyInfo(order.status, order.order_code);
        const timeStr = typeof formatDateTime === "function" ? formatDateTime(order.created_at) : (order.created_at ? new Date(order.created_at).toLocaleString("vi-VN") : "");
        const priceStr = typeof formatMoney === "function" ? formatMoney(order.total_amount) : `${Number(order.total_amount || 0).toLocaleString("vi-VN")} ₫`;
        
        let productPreviewHtml = "";
        if (order.items && order.items.length > 0) {
          const firstItem = order.items[0];
          const itemImg = getNotificationItemImg(firstItem.image_url, rootPath);
          const remainingCount = order.items.length - 1;
          const countText = remainingCount > 0 ? `<span class="notify-product-count">+${remainingCount} sản phẩm khác</span>` : "";
          const safeName = typeof escapeHtml === "function" ? escapeHtml(firstItem.product_name) : (firstItem.product_name || "");
          productPreviewHtml = `
            <div class="notify-product-preview">
              <img src="${itemImg}" alt="${safeName}" class="notify-product-img" onerror="this.src='${rootPath}assets/images/logo_shop.svg';">
              <span class="notify-product-name">${safeName}</span>
              ${countText}
            </div>
          `;
        }

        return `
          <a href="${rootPath}pages/my_orders.html" class="order-notify-card" data-order-id="${order.id}">
            <div class="notify-icon-box ${notifyInfo.type}">
              ${notifyInfo.icon}
            </div>
            <div class="notify-body">
              <div class="notify-title-row">
                <span class="notify-title">${notifyInfo.title}</span>
                <span class="notify-status-badge ${notifyInfo.type}">${notifyInfo.badge}</span>
              </div>
              <p class="notify-message">${notifyInfo.message}</p>
              ${productPreviewHtml}
              <div class="notify-meta-row">
                <span class="notify-time">${timeStr}</span>
                <span class="notify-amount">${priceStr}</span>
              </div>
            </div>
          </a>
        `;
      }).join("");
    }

    const shopOrdersBtn = document.getElementById("shop-orders-btn");
    const shopOrdersPanel = document.getElementById("shop-orders-panel");
    const shopOrdersContent = document.getElementById("shop-orders-content");

    if (shopOrdersBtn && shopOrdersPanel) {
      shopOrdersBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const isHidden = shopOrdersPanel.hasAttribute("hidden") || shopOrdersPanel.hidden;
        
        if (!isHidden) {
          shopOrdersPanel.hidden = true;
          shopOrdersBtn.setAttribute("aria-expanded", "false");
          shopOrdersBtn.classList.remove("active");
          return;
        }

        // Đóng menu tài khoản nếu đang mở
        const userDropdown = document.getElementById("user-dropdown-menu");
        const userWrapper = document.querySelector(".user-tool-wrapper");
        if (userWrapper) userWrapper.classList.remove("active");
        if (userDropdown) userDropdown.style.display = "";

        // Mở panel
        shopOrdersPanel.hidden = false;
        shopOrdersBtn.setAttribute("aria-expanded", "true");
        shopOrdersBtn.classList.add("active");

        const currentToken = localStorage.getItem("token");
        if (!currentToken) {
          if (shopOrdersContent) {
            shopOrdersContent.innerHTML = `
              <div class="notify-empty-state">
                <div class="notify-empty-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <p class="notify-empty-title">Đăng nhập tài khoản</p>
                <p class="notify-empty-desc">Vui lòng đăng nhập để xem thông báo cập nhật đơn mua của bạn.</p>
                <a href="${root}pages/login.html?redirect=my_orders.html" class="notify-empty-btn">Đăng nhập ngay</a>
              </div>
            `;
          }
          return;
        }

        if (shopOrdersContent) {
          shopOrdersContent.innerHTML = `
            <div style="padding: 28px 20px; text-align: center; color: #64748b; font-size: 13px;">
              <div style="width: 24px; height: 24px; margin: 0 auto 10px; border: 2.5px solid #e2e8f0; border-top-color: #00288e; border-radius: 50%; animation: spin 0.7s linear infinite;"></div>
              Đang tải thông báo đơn hàng...
            </div>
          `;
        }

        try {
          if (typeof api !== "undefined" && api.get) {
            const res = await api.get("/orders/my", { page: 1, page_size: 5 });
            const orders = (res && res.items) ? res.items : (Array.isArray(res) ? res : []);
            renderOrdersNotificationDropdown(orders, shopOrdersContent, root);
          }
        } catch (err) {
          console.error("Lỗi tải thông báo đơn hàng:", err);
          if (shopOrdersContent) {
            shopOrdersContent.innerHTML = `
              <div class="notify-empty-state">
                <p class="notify-empty-title" style="color: #ef4444;">Không thể tải đơn hàng</p>
                <p class="notify-empty-desc">${err.message || "Vui lòng thử lại sau"}</p>
              </div>
            `;
          }
        }
      });

      // Đóng panel khi bấm nút close
      shopOrdersPanel.querySelector("[data-close-orders]")?.addEventListener("click", () => {
        shopOrdersPanel.hidden = true;
        shopOrdersBtn.setAttribute("aria-expanded", "false");
        shopOrdersBtn.classList.remove("active");
      });

      // Đóng panel khi click ra ngoài
      document.addEventListener("click", (e) => {
        if (!shopOrdersPanel.contains(e.target) && !shopOrdersBtn.contains(e.target)) {
          shopOrdersPanel.hidden = true;
          shopOrdersBtn.setAttribute("aria-expanded", "false");
          shopOrdersBtn.classList.remove("active");
        }
      });
    }

    document.getElementById("app-footer").innerHTML = `<div class="shop-footer"><div class="footer-columns"><div><a class="shop-brand footer-brand" href="#"><img src="${root}assets/images/logo_shop.svg" alt="ShopEase"><span>ShopEase</span></a><p>Nền tảng mua sắm trực tuyến tiện lợi, giao hàng nhanh và thanh toán khi nhận hàng.</p><p>☎ Hotline: 1900 6868 (8:00 – 21:00)<br>✉ support@shopease.vn<br><img class="address-icon" src="${root}assets/images/địa chỉ.svg" alt=""> Tòa nhà Innovation, Cầu Giấy, Hà Nội</p></div><div><b>Chính sách khách hàng</b><a href="#">Chính sách giao hàng COD</a><a href="#">Đổi trả, đổi hàng 7 ngày</a><a href="#">Quy định bảo mật thông tin</a><a href="#">Chính sách bảo mật</a></div><div><b>Hỗ trợ mua sắm</b><a href="#">Hướng dẫn đặt hàng & thanh toán</a><a href="#">Chính sách đổi trả</a><a href="#">Chính sách đồng kiểm khi nhận hàng</a><a href="#">Trung tâm trợ giúp FAQ</a></div><div><b>Phương thức thanh toán & chứng nhận</b><span class="payment-badges"><img src="${root}assets/images/COD.svg" alt=""> Thanh toán khi nhận hàng</span><span class="payment-badges"><img src="${root}assets/images/chuyển khoản.svg" alt=""> Chuyển khoản</span></div></div><div class="footer-legal">© 2026 ShopEase Việt Nam. Bản quyền thuộc về Công ty TNHH Thương mại ShopEase.<span>Điều khoản sử dụng　　Chính sách bảo mật　　Liên hệ pháp nhân</span></div></div>`;
    return;
  }
  if (headerElem) {
    const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
    let user = typeof Auth !== "undefined" ? Auth.getUser() : null;
    if (!user) {
      try {
        user = JSON.parse(localStorage.getItem("user") || "null");
      } catch (_) {}
    }

    const role = user && user.role ? String(user.role).toUpperCase() : null;

    // Danh sách menu điều hướng thay đổi theo vai trò
    const navItems = [
      { href: "pages/customer-home.html", label: "Trang chủ" },
      { href: "pages/items.html", label: "Sản phẩm" },
    ];

    if (role === "CUSTOMER") {
      // Khách hàng đã đăng nhập: hiển thị Hồ sơ, Giỏ hàng và Đơn mua
      navItems.push(
        { href: "pages/profile.html", label: "👤 Hồ sơ" },
        { href: "pages/cart.html", label: "🛒 Giỏ hàng" },
        { href: "pages/my-orders.html", label: "📦 Đơn của tôi" }
      );
    } else if (role === "ADMIN" || role === "STAFF") {
      // Quản trị viên / Nhân viên: hiển thị lối tắt vào Trang quản trị
      navItems.push({
        href: "pages/admin-dashboard.html",
        label: "⚡ Trang quản trị",
        highlight: true,
      });
    }

    // Tạo HTML các link điều hướng
    const linksHtml = navItems.map((item) => {
      const isActive = currentPath.endsWith("/" + item.href) ||
        (item.href === "index.html" && currentPath.endsWith("/"));
      const highlightClass = item.highlight ? "font-bold text-primary" : "";
      return `<a href="${root}${item.href}" class="${isActive ? "active" : ""} ${highlightClass}">${item.label}</a>`;
    }).join("");

    // Khối người dùng bên phải header
    let userBlockHtml = "";
    if (token && user) {
      let roleBadge = "";
      if (role === "ADMIN") {
        roleBadge = `<span class="badge badge-primary" style="margin-left: 6px; font-size: 11px;">Quản trị viên</span>`;
      } else if (role === "STAFF") {
        roleBadge = `<span class="badge badge-info" style="margin-left: 6px; font-size: 11px;">Nhân viên</span>`;
      }

      // Viết hoa chữ cái đầu của mỗi từ trong tên người dùng
      const rawName = user.full_name || user.email || "";
      const displayName = typeof capitalizeWords === "function" && user.full_name
        ? capitalizeWords(user.full_name)
        : rawName;

      userBlockHtml = `
        <div style="display: flex; align-items: center; gap: 12px; margin-left: 16px;">
          <a href="${root}pages/profile.html" style="display: flex; align-items: center; text-decoration: none; color: inherit; cursor: pointer;" title="Xem hồ sơ cá nhân">
            <span style="font-size: 13.5px; font-weight: 600; color: var(--color-text);">
              👋 ${escapeHtml(displayName)}
            </span>
            ${roleBadge}
          </a>
          <button id="btn-logout" class="btn btn-sm btn-outline" style="padding: 5px 12px; font-size: 12.5px; border-radius: 6px; cursor: pointer;">
            Đăng xuất
          </button>
        </div>
      `;
    } else {
      const isLoginActive = currentPath.endsWith("/login.html");
      const isRegisterActive = currentPath.endsWith("/register.html");
      userBlockHtml = `
        <div style="display: flex; align-items: center; gap: 8px; margin-left: 12px;">
          <a href="${root}pages/login.html" class="${isLoginActive ? "active" : ""}" style="font-size: 13.5px; font-weight: 600; padding: 6px 12px;">Đăng nhập</a>
          <a href="${root}pages/register.html" class="btn btn-sm btn-primary ${isRegisterActive ? "active" : ""}" style="font-size: 13.5px; padding: 7px 16px; border-radius: 6px;">Đăng ký</a>
        </div>
      `;
    }

    headerElem.innerHTML = `
      <div class="container header-inner">
        <a href="${root}pages/customer-home.html" class="brand" style="display: flex; align-items: center; gap: 10px;">
          <img src="${root}assets/images/logo.svg" alt="ShopEase Logo" width="30" height="30">
          <span style="font-family: var(--se-font-heading, sans-serif); font-size: 20px; font-weight: 800; color: var(--color-primary);">${CONFIG.APP_NAME}</span>
        </a>
        <div style="display: flex; align-items: center; gap: 16px;">
          <nav class="nav">${linksHtml}</nav>
          ${userBlockHtml}
        </div>
      </div>`;

    // Gắn sự kiện cho nút Đăng xuất (hiện pop-up xác nhận modal)
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof Auth !== "undefined" && typeof Auth.confirmLogout === "function") {
          Auth.confirmLogout(root);
        } else if (typeof showConfirmModal === "function") {
          showConfirmModal({
            title: "Xác nhận đăng xuất",
            message: "Bạn có chắc chắn muốn đăng xuất không?",
            confirmText: "Đăng xuất",
            cancelText: "Hủy bỏ",
            type: "danger",
            onConfirm: () => {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              window.location.href = `${root}pages/login.html`;
            }
          });
        } else if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = `${root}pages/login.html`;
        }
      });
    }
  }

  if (footerElem) {
    footerElem.innerHTML = `
      <div class="container">© ${new Date().getFullYear()} ShopEase Việt Nam · Base code thực tập doanh nghiệp HN-KS25-CNTT1</div>`;
  }
}

// ==========================================================
// 6. GỢI Ý TÌM KIẾM (DEBOUNCE) & SẢN PHẨM ĐÃ XEM GẦN ĐÂY (LOCALSTORAGE)
// ==========================================================
function setupSearchSuggestions(root, isCustomerHome) {
  const input = document.getElementById("shop-search");
  const dropdown = document.getElementById("search-suggest-dropdown");
  const searchBtn = document.getElementById("search-submit");
  if (!input || !dropdown) return;

  const KEY_RECENT = "shopease_recently_viewed";
  let debounceTimer = null;
  let currentRequestId = 0;

  const escapeHTML = (str) =>
    String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const formatPrice = (val) => `${Number(val || 0).toLocaleString("vi-VN")}₫`;

  const resolveImg = (path) => {
    if (!path) return `${root}assets/images/logo_shop.svg`;
    if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
    const origin = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL)
      ? CONFIG.API_BASE_URL.replace(/\/api\/?$/, "")
      : "http://127.0.0.1:8000";
    return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const highlightMatch = (text, query) => {
    if (!query || !text) return escapeHTML(text);
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${safe})`, "gi");
    return escapeHTML(text).replace(regex, "<mark>$1</mark>");
  };

  const getRecentViewed = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY_RECENT) || "[]");
    } catch (_) {
      return [];
    }
  };

  const doSubmitSearch = (keyword) => {
    dropdown.hidden = true;
    const q = (keyword !== undefined ? keyword : input.value).trim();
    if (isCustomerHome && typeof window.applyCustomerSearch === "function") {
      window.applyCustomerSearch(q);
    } else {
      if (q) {
        window.location.href = `${root}pages/customer-home.html?search=${encodeURIComponent(q)}#products`;
      } else {
        window.location.href = `${root}pages/customer-home.html#products`;
      }
    }
  };

  const showRecentOrPopular = () => {
    const recents = getRecentViewed();
    if (recents.length > 0) {
      dropdown.innerHTML = `
        <div class="suggest-header">
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Sản phẩm đã xem gần đây
          </span>
          <button type="button" class="suggest-clear-btn" id="btn-clear-suggest-recent">Xóa lịch sử</button>
        </div>
        <div class="suggest-list">
          ${recents.slice(0, 5).map(item => {
            const hasPromo = item.promotional_price && Number(item.promotional_price) < Number(item.price);
            return `
              <a href="${root}pages/product-detail.html?id=${item.id}" class="suggest-item">
                <img src="${escapeHTML(resolveImg(item.image_url))}" class="suggest-thumb" alt="${escapeHTML(item.name)}" onerror="this.src='${root}assets/images/logo_shop.svg'">
                <div class="suggest-info">
                  <div class="suggest-title">${escapeHTML(item.name)}</div>
                  <div class="suggest-meta">
                    <span class="suggest-price">${formatPrice(item.promotional_price || item.price)}</span>
                    ${hasPromo ? `<span class="suggest-old-price">${formatPrice(item.price)}</span>` : ""}
                    ${item.category_name ? `<span class="suggest-cat">${escapeHTML(item.category_name)}</span>` : ""}
                  </div>
                </div>
              </a>
            `;
          }).join("")}
        </div>
      `;

      dropdown.querySelector("#btn-clear-suggest-recent")?.addEventListener("click", (e) => {
        e.stopPropagation();
        localStorage.removeItem(KEY_RECENT);
        showRecentOrPopular();
        if (typeof showToast === "function") showToast("Đã xóa lịch sử sản phẩm đã xem", "info");
      });
    } else {
      const popularTags = ["iPhone 15", "Samsung Galaxy", "Bàn phím cơ", "Tai nghe không dây", "iPad Pro", "Laptop"];
      dropdown.innerHTML = `
        <div class="suggest-header">
          <span>🔥 Tìm kiếm phổ biến</span>
        </div>
        <div class="suggest-tags-wrap">
          ${popularTags.map(tag => `<button type="button" class="suggest-tag-chip" data-search-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>`).join("")}
        </div>
      `;

      dropdown.querySelectorAll("[data-search-tag]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const tag = btn.dataset.searchTag;
          input.value = tag;
          doSubmitSearch(tag);
        });
      });
    }
    dropdown.hidden = false;
  };

  const showLoading = () => {
    dropdown.innerHTML = `
      <div class="suggest-loading">
        <span>Đang tìm kiếm gợi ý sản phẩm…</span>
      </div>
    `;
    dropdown.hidden = false;
  };

  const fetchSuggestions = async (query) => {
    const reqId = ++currentRequestId;
    try {
      let results = [];
      let total = 0;
      if (typeof api !== "undefined" && api.get) {
        const data = await api.get("/products", { search: query, page_size: 6 });
        if (reqId !== currentRequestId) return;
        results = data.items || [];
        total = Number(data.total || results.length);
      } else {
        const baseUrl = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL) ? CONFIG.API_BASE_URL : "http://127.0.0.1:8000/api";
        const url = `${baseUrl}/products?search=${encodeURIComponent(query)}&page_size=6`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (reqId !== currentRequestId) return;
        results = data.items || [];
        total = Number(data.total || results.length);
      }

      if (results.length === 0) {
        dropdown.innerHTML = `
          <div class="suggest-empty">
            Không tìm thấy sản phẩm phù hợp với "<strong>${escapeHTML(query)}</strong>"
            <small>Thử tìm kiếm với tên sản phẩm, danh mục hoặc thương hiệu khác.</small>
          </div>
        `;
        dropdown.hidden = false;
        return;
      }

      dropdown.innerHTML = `
        <div class="suggest-header">
          <span>Gợi ý sản phẩm (${total} kết quả)</span>
        </div>
        <div class="suggest-list">
          ${results.map(prod => {
            const hasPromo = prod.promotional_price && Number(prod.promotional_price) < Number(prod.price);
            const imgPath = (prod.product_images && prod.product_images.length > 0)
              ? prod.product_images[0].image_url
              : "";
            return `
              <a href="${root}pages/product-detail.html?id=${prod.id}" class="suggest-item">
                <img src="${escapeHTML(resolveImg(imgPath))}" class="suggest-thumb" alt="${escapeHTML(prod.name)}" onerror="this.src='${root}assets/images/logo_shop.svg'">
                <div class="suggest-info">
                  <div class="suggest-title">${highlightMatch(prod.name, query)}</div>
                  <div class="suggest-meta">
                    <span class="suggest-price">${formatPrice(prod.promotional_price || prod.price)}</span>
                    ${hasPromo ? `<span class="suggest-old-price">${formatPrice(prod.price)}</span>` : ""}
                    ${prod.category ? `<span class="suggest-cat">${escapeHTML(prod.category.name)}</span>` : ""}
                  </div>
                </div>
              </a>
            `;
          }).join("")}
        </div>
        <div class="suggest-footer">
          <button type="button" class="suggest-view-all" id="btn-suggest-view-all">
            Xem tất cả kết quả cho "${escapeHTML(query)}" (${total}) →
          </button>
        </div>
      `;

      dropdown.querySelector("#btn-suggest-view-all")?.addEventListener("click", () => {
        doSubmitSearch(query);
      });

      dropdown.hidden = false;
    } catch (err) {
      if (reqId !== currentRequestId) return;
      dropdown.innerHTML = `
        <div class="suggest-empty">
          Lỗi tìm kiếm: ${escapeHTML(err.message || "Không thể kết nối máy chủ")}
        </div>
      `;
      dropdown.hidden = false;
    }
  };

  // 1. Gõ phím có DEBOUNCE (280ms)
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) {
      showRecentOrPopular();
      return;
    }
    showLoading();
    debounceTimer = setTimeout(() => {
      fetchSuggestions(q);
    }, 280);
  });

  // 2. Focus vào ô tìm kiếm: hiển thị gợi ý hoặc sản phẩm đã xem gần đây
  input.addEventListener("focus", () => {
    const q = input.value.trim();
    if (!q) {
      showRecentOrPopular();
    } else {
      fetchSuggestions(q);
    }
  });

  // 3. Phím Enter hoặc nút Tìm kiếm
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSubmitSearch();
    } else if (e.key === "Escape") {
      dropdown.hidden = true;
    }
  });

  searchBtn?.addEventListener("click", () => {
    doSubmitSearch();
  });

  // 4. Đóng dropdown khi nhấp ra ngoài ô tìm kiếm
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".header-search")) {
      dropdown.hidden = true;
    }
  });
}

// Tự động kiểm tra và hiển thị toast đang chờ (sau khi chuyển trang đăng nhập/đăng ký)
function checkPendingToast() {
  const pending = sessionStorage.getItem("pending_toast");
  if (pending) {
    try {
      const data = JSON.parse(pending);
      if (typeof showToast === "function") {
        showToast(data.message, data.type || "success");
      }
    } catch (_) {
      if (typeof showToast === "function") {
        showToast(pending, "success");
      }
    }
    sessionStorage.removeItem("pending_toast");
  }
}

// ==========================================================
// 10. BỘ NÂNG CẤP DROPDOWN SELECT CAO CẤP DÙNG CHUNG CHO ADMIN
// Biến mọi thẻ <select> thành giao diện Dropdown tùy chỉnh hiện đại (AGY Custom Select)
// ==========================================================

// Monkey-patch value setter của HTMLSelectElement để tự động đồng bộ khi code JS gán select.value = "..."
if (!window._agySelectPatched && typeof HTMLSelectElement !== "undefined") {
  window._agySelectPatched = true;
  const originalDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (originalDesc && originalDesc.set) {
    Object.defineProperty(HTMLSelectElement.prototype, "value", {
      get() {
        return originalDesc.get.call(this);
      },
      set(val) {
        originalDesc.set.call(this, val);
        if (typeof this._customSelectSync === "function") {
          this._customSelectSync();
        }
      },
      configurable: true,
      enumerable: true
    });
  }
}

function initAdminCustomSelects(container = document) {
  // Chỉ áp dụng cho các trang quản trị
  const isAdmin = document.body.classList.contains("admin-page") ||
                  document.getElementById("admin-sidebar") ||
                  window.location.pathname.includes("/admin-");
  if (!isAdmin) return;

  const selector = ".admin-select-box select, .orders-filter-row select, .admin-filter-inputs select, select.admin-form-input, .realtime-interval-select, select.filter-date-input, select.admin-select";
  const selects = (container || document).querySelectorAll(selector);

  selects.forEach((select) => {
    if (select._customSelectEnhanced) {
      if (typeof select._customSelectSync === "function") {
        select._customSelectSync();
      }
      return;
    }
    select._customSelectEnhanced = true;

    // Ẩn select gốc một cách an toàn và giữ nguyên trong DOM
    select.classList.add("agy-native-hidden");

    // Tạo wrapper tùy chỉnh
    const wrapper = document.createElement("div");
    wrapper.className = "agy-custom-select";
    if (select.classList.contains("realtime-interval-select")) {
      wrapper.classList.add("is-realtime");
    }
    if (select.classList.contains("admin-form-input") || select.style.width === "100%") {
      wrapper.classList.add("is-fullwidth");
    }
    if (select.id) {
      wrapper.setAttribute("data-for-id", select.id);
    }

    // Nút kích hoạt Dropdown (Trigger)
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "agy-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const textSpan = document.createElement("span");
    textSpan.className = "agy-select-text";

    const chevronSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chevronSvg.setAttribute("class", "agy-select-chevron");
    chevronSvg.setAttribute("width", "14");
    chevronSvg.setAttribute("height", "14");
    chevronSvg.setAttribute("viewBox", "0 0 24 24");
    chevronSvg.setAttribute("fill", "none");
    chevronSvg.setAttribute("stroke", "currentColor");
    chevronSvg.setAttribute("stroke-width", "2.2");
    chevronSvg.setAttribute("stroke-linecap", "round");
    chevronSvg.setAttribute("stroke-linejoin", "round");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("points", "6 9 12 15 18 9");
    chevronSvg.appendChild(poly);

    trigger.appendChild(textSpan);
    trigger.appendChild(chevronSvg);

    // Menu danh sách lựa chọn (Dropdown)
    const dropdown = document.createElement("div");
    dropdown.className = "agy-select-dropdown";
    dropdown.setAttribute("role", "listbox");

    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);

    // Hàm render các options
    function buildOptions() {
      dropdown.innerHTML = "";
      const options = Array.from(select.options);

      options.forEach((opt) => {
        const item = document.createElement("div");
        item.className = "agy-select-option";
        item.setAttribute("role", "option");
        item.setAttribute("data-value", opt.value);
        if (opt.value === select.value) {
          item.classList.add("is-selected");
        }

        const labelSpan = document.createElement("span");
        labelSpan.className = "agy-option-label";
        labelSpan.textContent = opt.textContent;

        const checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        checkSvg.setAttribute("class", "agy-option-check");
        checkSvg.setAttribute("width", "14");
        checkSvg.setAttribute("height", "14");
        checkSvg.setAttribute("viewBox", "0 0 24 24");
        checkSvg.setAttribute("fill", "none");
        checkSvg.setAttribute("stroke", "currentColor");
        checkSvg.setAttribute("stroke-width", "2.5");
        checkSvg.setAttribute("stroke-linecap", "round");
        checkSvg.setAttribute("stroke-linejoin", "round");
        const checkPoly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        checkPoly.setAttribute("points", "20 6 9 17 4 12");
        checkSvg.appendChild(checkPoly);

        item.appendChild(labelSpan);
        item.appendChild(checkSvg);

        item.addEventListener("click", (e) => {
          e.stopPropagation();
          if (select.value !== opt.value) {
            select.value = opt.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            select.dispatchEvent(new Event("input", { bubbles: true }));
          }
          syncFromSelect();
          closeMenu();
          trigger.focus();
        });

        dropdown.appendChild(item);
      });

      syncFromSelect();
    }

    // Hàm đồng bộ text hiển thị từ select gốc
    function syncFromSelect() {
      const selectedOpt = select.selectedOptions && select.selectedOptions[0]
        ? select.selectedOptions[0]
        : select.options[select.selectedIndex];
      textSpan.textContent = selectedOpt ? selectedOpt.textContent : "";

      const allItems = dropdown.querySelectorAll(".agy-select-option");
      allItems.forEach((it) => {
        if (it.getAttribute("data-value") === select.value) {
          it.classList.add("is-selected");
        } else {
          it.classList.remove("is-selected");
        }
      });
    }

    function openMenu() {
      // Đóng tất cả dropdown khác trước
      document.querySelectorAll(".agy-custom-select.is-open").forEach((el) => {
        if (el !== wrapper) {
          el.classList.remove("is-open");
          const tr = el.querySelector(".agy-select-trigger");
          if (tr) tr.setAttribute("aria-expanded", "false");
        }
      });

      // Đóng popover chọn ngày nếu đang mở (trên các trang quản trị)
      const datePopover = document.getElementById("order-date-popover") || document.getElementById("dash-date-popover");
      if (datePopover && datePopover.classList.contains("show")) {
        datePopover.classList.remove("show");
        const dateTrigger = document.getElementById("btn-order-date-trigger") || document.getElementById("btn-custom-date-trigger");
        if (dateTrigger) dateTrigger.setAttribute("aria-expanded", "false");
      }

      wrapper.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");

      // Căn chỉnh không tràn mép phải màn hình
      const rect = dropdown.getBoundingClientRect();
      const winWidth = window.innerWidth || document.documentElement.clientWidth;
      if (rect.right > winWidth - 10) {
        dropdown.style.left = "auto";
        dropdown.style.right = "0";
      } else if (!wrapper.classList.contains("is-realtime")) {
        dropdown.style.left = "0";
        dropdown.style.right = "auto";
      }

      // Cuộn mục đang chọn vào tầm nhìn
      const selectedItem = dropdown.querySelector(".agy-select-option.is-selected");
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest" });
      }
    }

    function closeMenu() {
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (select.disabled) return;
      if (wrapper.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Hỗ trợ phím tắt
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeMenu();
      } else if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        if (!wrapper.classList.contains("is-open")) {
          e.preventDefault();
          openMenu();
        }
      }
    });

    // Lưu các hàm liên kết vào select gốc
    select._customSelectSync = syncFromSelect;
    select._customSelectRebuild = buildOptions;

    // Chèn wrapper vào ngay sau thẻ select gốc
    select.insertAdjacentElement("afterend", wrapper);

    // Dựng danh sách options ban đầu
    buildOptions();

    // Lắng nghe sự kiện change từ select gốc
    select.addEventListener("change", syncFromSelect);

    // MutationObserver để theo dõi thay đổi options (ví dụ nạp qua API từ backend)
    const observer = new MutationObserver(() => {
      buildOptions();
    });
    observer.observe(select, { childList: true, subtree: true });
  });
}

// Đóng mọi dropdown khi nhấp ra ngoài
document.addEventListener("click", (e) => {
  if (!e.target.closest(".agy-custom-select")) {
    document.querySelectorAll(".agy-custom-select.is-open").forEach((el) => {
      el.classList.remove("is-open");
      const tr = el.querySelector(".agy-select-trigger");
      if (tr) tr.setAttribute("aria-expanded", "false");
    });
  }
});

// Đóng khi nhấn phím Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".agy-custom-select.is-open").forEach((el) => {
      el.classList.remove("is-open");
      const tr = el.querySelector(".agy-select-trigger");
      if (tr) tr.setAttribute("aria-expanded", "false");
    });
  }
});

// Tự động quét và nâng cấp khi có DOM mới (ví dụ modal mở hoặc dynamic inject)
if (typeof MutationObserver !== "undefined") {
  const bodyObserver = new MutationObserver((mutations) => {
    let hasNewSelects = false;
    for (const m of mutations) {
      if (m.type === "childList" && m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node.tagName === "SELECT" || (node.querySelector && node.querySelector("select"))) {
              hasNewSelects = true;
              break;
            }
          }
        }
      }
      if (hasNewSelects) break;
    }
    if (hasNewSelects) {
      initAdminCustomSelects();
    }
  });
  if (document.body) {
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }
}

// Tự động render layout và kích hoạt toast chờ
window.renderAdminLayout = renderAdminLayout;
window.renderLayout = renderLayout;
window.initAdminCustomSelects = initAdminCustomSelects;
window.syncCustomSelects = function () {
  document.querySelectorAll("select").forEach((sel) => {
    if (typeof sel._customSelectRebuild === "function") sel._customSelectRebuild();
    else if (typeof sel._customSelectSync === "function") sel._customSelectSync();
  });
};

renderLayout();
checkPendingToast();

// Khởi chạy nâng cấp custom dropdown
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initAdminCustomSelects();
  });
} else {
  initAdminCustomSelects();
}
setTimeout(() => {
  initAdminCustomSelects();
}, 250);
