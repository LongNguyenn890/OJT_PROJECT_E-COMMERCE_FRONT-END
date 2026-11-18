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

  const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
  let user = typeof Auth !== "undefined" ? Auth.getUser() : null;
  if (!user) {
    try {
      user = JSON.parse(localStorage.getItem("user") || "null");
    } catch (_) {}
  }

  if (isAdminPage) {
    // 1. Chưa đăng nhập: Chuyển hướng về trang login kèm redirect URL
    if (!token || !user) {
      sessionStorage.setItem("auth_message", "Vui lòng đăng nhập với tài khoản Quản trị viên để tiếp tục.");
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `${root}pages/login.html?redirect=${encodeURIComponent(currentUrl)}`;
      return false;
    }

    // 2. Đã đăng nhập nhưng không có vai trò ADMIN hoặc STAFF: Chặn và đá về trang chủ
    const role = (user.role || "").toUpperCase();
    if (role !== "ADMIN" && role !== "STAFF") {
      alert("Truy cập bị từ chối! Tài khoản của bạn không có quyền quản trị hệ thống.");
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
// 2. RENDER HEADER & FOOTER THEO VAI TRÒ (GUEST / CUSTOMER / ADMIN)
// ==========================================================
function renderLayout() {
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

    let userSectionHtml = "";
    if (token && user) {
      const rawName = user.full_name || user.email || "";
      const displayName = typeof capitalizeWords === "function" && user.full_name
        ? capitalizeWords(user.full_name)
        : rawName;
      userSectionHtml = `
        <span class="user-tool" style="cursor: pointer;" id="shop-user-profile" title="Tài khoản">
          <img src="${root}assets/images/avt người dùng.svg" alt="Avatar">
          <small>${escapeHtml(displayName)}<br><b id="shop-logout-btn" style="color: #ef4444; font-size: 12px; font-weight: 600; cursor: pointer;">Đăng xuất</b></small>
        </span>
      `;
    } else {
      userSectionHtml = `
        <a href="${root}pages/login.html" class="user-tool" style="text-decoration: none; color: inherit;">
          <img src="${root}assets/images/avt người dùng.svg" alt="Avatar">
          <small>Đăng nhập<br><b>Tài khoản</b></small>
        </a>
      `;
    }

    document.getElementById("app-header").innerHTML = `
      <div class="shop-header-inner">
        <a href="${root}pages/customer-home.html" class="shop-brand">
          <img src="${root}assets/images/logo_shop.svg" alt="ShopEase">
          <span>ShopEase<small>Mua sắm dễ dàng mỗi ngày</small></span>
        </a>
        <div class="header-search">
          <input id="shop-search" type="search" placeholder="Tìm kiếm sản phẩm, thương hiệu... (Ctrl + K)">
          <button type="button" id="search-submit">⌕ Tìm</button>
        </div>
        <div class="header-tools">
          <span>
            <img src="${root}assets/images/tổng đài.svg" alt="">
            <small>Tổng đài CSKH<br><b>1900 6868</b></small>
          </span>
          ${userSectionHtml}
          <button class="cart-tool" aria-label="Giỏ hàng">
            <img src="${root}assets/images/giỏ hàng.svg" alt="">
            <i id="cart-count">0</i>
          </button>
        </div>
      </div>`;

    // Gắn sự kiện đăng xuất nếu đã đăng nhập
    const shopLogoutBtn = document.getElementById("shop-logout-btn");
    if (shopLogoutBtn) {
      shopLogoutBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (typeof Auth !== "undefined" && Auth.confirmLogout) {
          Auth.confirmLogout(root);
        } else if (typeof Auth !== "undefined" && Auth.logout) {
          Auth.logout(root);
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = `${root}pages/login.html`;
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
      { href: "index.html", label: "Trang chủ" },
      { href: "pages/items.html", label: "Sản phẩm" },
    ];

    if (role === "CUSTOMER") {
      // Khách hàng đã đăng nhập: hiển thị Giỏ hàng và Đơn mua
      navItems.push(
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
          <div style="display: flex; align-items: center;">
            <span style="font-size: 13.5px; font-weight: 600; color: var(--color-text);">
              👋 ${escapeHtml(displayName)}
            </span>
            ${roleBadge}
          </div>
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
        <a href="${root}index.html" class="brand" style="display: flex; align-items: center; gap: 10px;">
          <img src="${root}assets/images/logo.svg" alt="ShopEase Logo" width="30" height="30">
          <span style="font-family: var(--se-font-heading, sans-serif); font-size: 20px; font-weight: 800; color: var(--color-primary);">${CONFIG.APP_NAME}</span>
        </a>
        <div style="display: flex; align-items: center; gap: 16px;">
          <nav class="nav">${linksHtml}</nav>
          ${userBlockHtml}
        </div>
      </div>`;

    // Gắn sự kiện cho nút Đăng xuất
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (typeof Auth !== "undefined" && Auth.confirmLogout) {
          Auth.confirmLogout(root);
        } else if (typeof Auth !== "undefined" && Auth.logout) {
          Auth.logout(root);
        } else {
          sessionStorage.setItem("pending_toast", JSON.stringify({
            message: "Bạn đã đăng xuất thành công.",
            type: "success"
          }));
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

// Tự động render layout và kích hoạt toast chờ
renderLayout();
checkPendingToast();
