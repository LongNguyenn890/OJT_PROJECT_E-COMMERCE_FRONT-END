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
      window.location.href = `${root}index.html`;
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
        logoutBtn.disabled = true;
        logoutBtn.style.opacity = "0.6";
        logoutBtn.style.cursor = "not-allowed";
        logoutBtn.textContent = "Đang đăng xuất...";

        if (typeof Auth !== "undefined" && Auth.logout) {
          Auth.logout(root);
        } else {
          if (typeof showToast === "function") {
            showToast("Đăng xuất thành công! Đang chuyển hướng sau 2 giây...", "info");
          }
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setTimeout(() => {
            window.location.href = `${root}pages/login.html`;
          }, 2000);
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
