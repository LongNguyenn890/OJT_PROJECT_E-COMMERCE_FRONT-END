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

    // 2. Đã đăng nhập nhưng không có vai trò ADMIN hoặc STAFF: Chặn và đá về trang chủ
    const role = (user.role || "").toUpperCase();
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
            <div class="user-tool-meta">
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
            <input id="shop-search" type="search" placeholder="Tìm kiếm sản phẩm, thương hiệu... (Ctrl + K)">
            <button type="button" id="search-submit" title="Tìm kiếm">⌕ Tìm</button>
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

            <!-- 2. Tra cứu Đơn mua -->
            <button class="orders-tool" id="shop-orders-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="shop-orders-panel" title="Đơn mua gần đây">
              <div class="orders-icon-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.75h8.5L20 8.2v11.05A1.75 1.75 0 0 1 18.25 21h-11A1.75 1.75 0 0 1 5.5 19.25v-13A2.5 2.5 0 0 1 8 3.75Z"/><path d="M15 4v4.5h4.5M8.5 12h7M8.5 15.5h7"/></svg>
              </div>
              <div class="header-tool-meta">
                <small>Tra cứu</small>
                <b>Đơn mua</b>
              </div>
            </button>

            <!-- 3. Tài khoản người dùng (Kèm menu dropdown) -->
            ${userSectionHtml}

            <!-- 4. Giỏ hàng (Nổi bật góc ngoài cùng bên phải) -->
            <button class="cart-tool" id="shop-cart-btn" aria-label="Giỏ hàng" title="Giỏ hàng của bạn">
              <div class="cart-icon-wrapper">
                <img src="${root}assets/images/giỏ hàng.svg" alt="">
                <i id="cart-count">0</i>
              </div>
              <div class="header-tool-meta">
                <small>Giỏ hàng</small>
                <b id="cart-count-label">0 món</b>
              </div>
            </button>
          </div>
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
      </div>
      <div class="shop-nav-bar">
        <nav class="shop-nav" aria-label="Menu điều hướng chính">
          ${navLinksHtml}
        </nav>
      </div>`;

    // 1. Quản lý tương tác Dropdown menu tài khoản (Click toggle + đóng khi click ngoài hoặc chọn mục)
    const shopUserProfile = document.getElementById("shop-user-profile");
    const userToolWrapper = document.querySelector(".user-tool-wrapper");
    const userDropdownMenu = document.getElementById("user-dropdown-menu");
    if (shopUserProfile && userToolWrapper) {
      const toggleUserMenu = (e) => {
        e.stopPropagation();
        const isOpen = userToolWrapper.classList.toggle("active");
        shopUserProfile.setAttribute("aria-expanded", isOpen ? "true" : "false");
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
      userDropdownMenu.addEventListener("click", () => {
        userToolWrapper.classList.remove("active");
        if (shopUserProfile) shopUserProfile.setAttribute("aria-expanded", "false");
      });
    }

    document.addEventListener("click", (e) => {
      if (userToolWrapper && !userToolWrapper.contains(e.target)) {
        userToolWrapper.classList.remove("active");
        if (shopUserProfile) shopUserProfile.setAttribute("aria-expanded", "false");
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

    // 3. Xử lý tìm kiếm liên trang (nếu gõ tìm kiếm từ trang profile hoặc admin -> chuyển về trang chủ kết quả tìm kiếm)
    const shopSearchInput = document.getElementById("shop-search");
    const searchSubmitBtn = document.getElementById("search-submit");
    if (!isCustomerHome) {
      const handleCrossPageSearch = () => {
        const query = shopSearchInput ? shopSearchInput.value.trim() : "";
        if (query) {
          window.location.href = `${root}pages/customer-home.html?search=${encodeURIComponent(query)}#products`;
        } else {
          window.location.href = `${root}pages/customer-home.html#products`;
        }
      };

      if (searchSubmitBtn) searchSubmitBtn.addEventListener("click", handleCrossPageSearch);
      if (shopSearchInput) {
        shopSearchInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleCrossPageSearch();
          }
        });
      }
    }

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
      if (!currentToken) {
        if (countElem) countElem.textContent = "0";
        if (countLabelElem) countLabelElem.textContent = "0 món";
        return 0;
      }
      try {
        if (typeof api !== "undefined" && api.get) {
          const cart = await api.get("/cart");
          const count = (cart?.cart_items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
          if (countElem) countElem.textContent = count;
          if (countLabelElem) countLabelElem.textContent = `${count} món`;
          return count;
        }
      } catch (_) {}
      return 0;
    };

    if (token) {
      window.refreshCartCount();
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
          return;
        }

        // Đóng menu tài khoản nếu đang mở
        const userDropdown = document.getElementById("user-dropdown-menu");
        if (userDropdown) userDropdown.style.display = "none";

        // Mở panel
        shopOrdersPanel.hidden = false;
        shopOrdersBtn.setAttribute("aria-expanded", "true");

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
      });

      // Đóng panel khi click ra ngoài
      document.addEventListener("click", (e) => {
        if (!shopOrdersPanel.contains(e.target) && !shopOrdersBtn.contains(e.target)) {
          shopOrdersPanel.hidden = true;
          shopOrdersBtn.setAttribute("aria-expanded", "false");
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
