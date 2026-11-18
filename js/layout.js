// Layout chung: tự chèn header (menu) và footer vào mọi trang,
// để không phải copy lại HTML menu ở từng file.
//
// Mỗi trang cần có:  <body data-root="./">   (trang ở thư mục gốc)
//              hoặc  <body data-root="../">  (trang trong thư mục pages/)
// và hai thẻ rỗng:   <header id="app-header"></header> ... <footer id="app-footer"></footer>

// Thêm trang mới vào menu: thêm 1 dòng vào mảng này (đường dẫn tính từ thư mục frontend/)
const MENU = [
  { href: "index.html", label: "Trang chủ" },
  { href: "pages/items.html", label: "Items (CRUD mẫu)" },
];

function renderLayout() {
  const root = document.body.dataset.root || "./";
  const currentPath = window.location.pathname;

  if (document.body.classList.contains("shop-page")) {
    document.getElementById("app-header").innerHTML = `
      <div class="shop-header-inner"><a href="${root}index.html" class="shop-brand"><img src="${root}assets/images/logo_shop.svg" alt="ShopEase"><span>ShopEase<small>Mua sắm dễ dàng mỗi ngày</small></span></a>
      <div class="header-search"><input id="shop-search" type="search" placeholder="Tìm kiếm sản phẩm, thương hiệu... (Ctrl + K)"><button type="button" id="search-submit">⌕ Tìm</button></div>
      <div class="header-tools"><span><img src="${root}assets/images/tổng đài.svg" alt=""><small>Tổng đài CSKH<br><b>1900 6868</b></small></span><span class="user-tool"><img src="${root}assets/images/avt người dùng.svg" alt="Ảnh Nguyễn Văn An"><small>Nguyễn Văn An<br><b>Tài khoản</b></small></span><button class="cart-tool" aria-label="Giỏ hàng"><img src="${root}assets/images/giỏ hàng.svg" alt=""><i id="cart-count">0</i></button></div></div>`;
    document.getElementById("app-footer").innerHTML = `<div class="shop-footer"><div class="footer-columns"><div><a class="shop-brand footer-brand" href="#"><img src="${root}assets/images/logo_shop.svg" alt="ShopEase"><span>ShopEase</span></a><p>Nền tảng mua sắm trực tuyến tiện lợi, giao hàng nhanh và thanh toán khi nhận hàng.</p><p>☎ Hotline: 1900 6868 (8:00 – 21:00)<br>✉ support@shopease.vn<br><img class="address-icon" src="${root}assets/images/địa chỉ.svg" alt=""> Tòa nhà Innovation, Cầu Giấy, Hà Nội</p></div><div><b>Chính sách khách hàng</b><a href="#">Chính sách giao hàng COD</a><a href="#">Đổi trả, đổi hàng 7 ngày</a><a href="#">Quy định bảo mật thông tin</a><a href="#">Chính sách bảo mật</a></div><div><b>Hỗ trợ mua sắm</b><a href="#">Hướng dẫn đặt hàng & thanh toán</a><a href="#">Chính sách đổi trả</a><a href="#">Chính sách đồng kiểm khi nhận hàng</a><a href="#">Trung tâm trợ giúp FAQ</a></div><div><b>Phương thức thanh toán & chứng nhận</b><span class="payment-badges"><img src="${root}assets/images/COD.svg" alt=""> Thanh toán khi nhận hàng</span><span class="payment-badges"><img src="${root}assets/images/chuyển khoản.svg" alt=""> Chuyển khoản</span></div></div><div class="footer-legal">© 2026 ShopEase Việt Nam. Bản quyền thuộc về Công ty TNHH Thương mại ShopEase.<span>Điều khoản sử dụng　　Chính sách bảo mật　　Liên hệ pháp nhân</span></div></div>`;
    return;
  }

  const links = MENU.map((item) => {
    const isActive = currentPath.endsWith("/" + item.href) ||
      (item.href === "index.html" && currentPath.endsWith("/"));
    return `<a href="${root}${item.href}" class="${isActive ? "active" : ""}">${item.label}</a>`;
  }).join("");

  document.getElementById("app-header").innerHTML = `
    <div class="container header-inner">
      <a href="${root}index.html" class="brand">
        <img src="${root}assets/images/logo_shop.svg" alt="logo" width="28" height="28">
        <span>${CONFIG.APP_NAME}</span>
      </a>
      <nav class="nav">${links}</nav>
    </div>`;

  document.getElementById("app-footer").innerHTML = `
    <div class="container">© ${new Date().getFullYear()} HN-KS25-CNTT2 · Base code thực tập doanh nghiệp</div>`;
}

renderLayout();
