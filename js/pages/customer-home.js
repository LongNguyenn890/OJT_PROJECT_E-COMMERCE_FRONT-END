// Customer catalog backed by the public product/category APIs and the signed-in cart API.
const PAGE_SIZE = 8;
const categoryIcons = ["công nghệ.svg", "thời trang.svg", "đồ gia dụng.svg", "balo và túi.svg", "quà tặng.svg", "dã ngoại.svg"];
const fallbackCategoryIcons = "ngành hàng.svg";
const state = { categories: [], products: [], categoryId: null, price: "all", page: 0, total: 0, requestId: 0, loadingMore: false, view: "grid" };
const asset = name => `../assets/images/${encodeURIComponent(name)}`;
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formatPrice = value => `${Number(value || 0).toLocaleString("vi-VN")}₫`;

function imageUrl(path) {
  if (!path) return asset("logo_shop.svg");
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  const origin = CONFIG.API_BASE_URL.replace(/\/api\/?$/, "");
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

function categoryIcon(index) {
  return asset(categoryIcons[index] || fallbackCategoryIcons);
}

function normalizedCategoryName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
}

function featuredCategories() {
  const groups = [
    ["cong nghe", "dien tu", "technology"],
    ["thoi trang", "fashion"],
    ["do gia dung", "gia dung", "home"],
    ["balo", "tui", "bag"],
    ["qua tang", "gift"],
    ["da ngoai", "outdoor"],
  ];
  const picked = [];
  for (const terms of groups) {
    const match = state.categories.find(category => !picked.includes(category) && terms.some(term => normalizedCategoryName(category.name).includes(term)));
    if (match) picked.push(match);
  }
  for (const category of state.categories) {
    if (picked.length >= 6) break;
    if (!picked.includes(category)) picked.push(category);
  }
  return picked.slice(0, 6);
}

function renderCategories() {
  const categories = state.categories;
  const featured = featuredCategories();
  const categoryList = document.getElementById("category-list");
  const categoryFilters = document.getElementById("category-filters");
  categoryList.innerHTML = featured.length
    ? featured.map((category, index) => `<button class="category-card" data-category-id="${category.id}"><span class="category-icon tone-${index % 6}"><img src="${categoryIcon(index)}" alt=""></span><strong>${escapeHTML(category.name)}</strong></button>`).join("")
    : `<p class="catalog-empty">Chưa có danh mục sản phẩm.</p>`;
  const visibleCount = window.matchMedia("(max-width: 640px)").matches ? 2 : 5;
  const visibleCategories = categories.slice(0, visibleCount);
  const hiddenCategories = categories.slice(visibleCount);
  const activeHiddenCategory = hiddenCategories.find(category => category.id === state.categoryId);
  const dropdown = hiddenCategories.length
    ? `<div class="category-dropdown"><button type="button" class="chip category-dropdown-trigger ${activeHiddenCategory ? "active" : ""}" data-toggle-category-dropdown aria-expanded="false">${activeHiddenCategory ? escapeHTML(activeHiddenCategory.name) : "Xem thêm"} <span aria-hidden="true">▾</span></button><div class="category-dropdown-menu" role="menu">${hiddenCategories.map(category => `<button type="button" role="menuitem" class="category-dropdown-item ${state.categoryId === category.id ? "active" : ""}" data-category-id="${category.id}">${escapeHTML(category.name)}</button>`).join("")}</div></div>`
    : "";
  categoryFilters.innerHTML = `<button class="chip ${state.categoryId === null ? "active" : ""}" data-category-id="all">Tất cả</button>${visibleCategories.map(category => `<button class="chip ${state.categoryId === category.id ? "active" : ""}" data-category-id="${category.id}">${escapeHTML(category.name)}</button>`).join("")}${dropdown}`;
}

function selectedPriceBounds() {
  if (state.price === "under1") return { max_price: 499999 };
  if (state.price === "500to1") return { min_price: 500000, max_price: 999999 };
  if (state.price === "1to2") return { min_price: 1000000, max_price: 2000000 };
  if (state.price === "over2") return { min_price: 2000001 };
  return {};
}

function productImage(product) {
  const images = [...(product.product_images || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  return imageUrl(images[0]?.image_url);
}

function renderProducts() {
  const grid = document.getElementById("product-grid");
  grid.classList.toggle("is-list", state.view === "list");
  if (!state.products.length) {
    grid.innerHTML = `<div class="no-products">Không tìm thấy sản phẩm phù hợp.</div>`;
  } else {
    grid.innerHTML = state.products.map(product => `
      <article class="product-card">
        <div class="product-photo"><img src="${escapeHTML(productImage(product))}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.src='${asset("logo_shop.svg")}'"></div>
        <div class="product-info"><h3>${escapeHTML(product.name)}</h3><strong class="product-price">${formatPrice(product.promotional_price || product.price)}</strong>
          <div class="product-actions"><button class="light-button" data-action="details" data-id="${product.id}"><img src="${asset("chi tiết.svg")}" alt=""> Xem chi tiết</button>
          <button class="blue-button" data-action="cart" data-id="${product.id}"><img src="${asset("thêm giỏ hàng.svg")}" alt=""> <span class="action-label">Thêm giỏ</span></button></div>
        </div>
      </article>`).join("");
  }
  document.getElementById("page-summary").textContent = state.total
    ? `Đang hiển thị ${state.products.length} / ${state.total} sản phẩm`
    : "0 sản phẩm";
  const pagination = document.getElementById("pagination");
  const hasMore = state.products.length < state.total;
  pagination.innerHTML = hasMore
    ? `<button class="load-more-button" type="button" data-load-more ${state.loadingMore ? "disabled" : ""}>${state.loadingMore ? "Đang tải…" : "Xem thêm sản phẩm"}</button>`
    : "";
}

async function loadCategories() {
  try {
    state.categories = await api.get("/categories");
    renderCategories();
  } catch (error) {
    state.categories = [];
    renderCategories();
    showToast(`Không tải được danh mục: ${error.message}`, "error");
  }
}

async function loadProducts({ append = false } = {}) {
  const requestId = ++state.requestId;
  const requestedPage = append ? state.page + 1 : 1;
  const params = {
    page: requestedPage,
    page_size: PAGE_SIZE,
    sort: document.getElementById("sort-select").value === "price-asc" ? "price_asc" :
      document.getElementById("sort-select").value === "price-desc" ? "price_desc" : "newest",
    ...selectedPriceBounds(),
  };
  const keyword = document.getElementById("shop-search").value.trim();
  if (keyword) params.search = keyword;
  if (state.categoryId !== null) params.category_id = state.categoryId;

  state.loadingMore = append;
  if (!append) {
    state.products = [];
    state.total = 0;
    state.page = 0;
    document.getElementById("product-grid").innerHTML = `<div class="catalog-loading">Đang tải sản phẩm…</div>`;
  } else {
    renderProducts();
  }
  try {
    const result = await api.get("/products", params);
    if (requestId !== state.requestId) return;
    const items = result.items || [];
    state.products = append ? [...state.products, ...items] : items;
    state.page = requestedPage;
    state.total = Number(result.total || 0);
    state.loadingMore = false;
    renderProducts();
  } catch (error) {
    if (requestId !== state.requestId) return;
    state.loadingMore = false;
    if (!append) {
      state.products = [];
      state.total = 0;
      state.page = 0;
    }
    renderProducts();
    showToast(`Không tải được sản phẩm: ${error.message}`, "error");
  }
}

async function refreshCartCount() {
  if (!localStorage.getItem("token")) {
    document.getElementById("cart-count").textContent = "0";
    return;
  }
  try {
    const cart = await api.get("/cart");
    const quantity = (cart.cart_items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
    document.getElementById("cart-count").textContent = quantity;
  } catch (error) {
    if (error.status !== 401) showToast(`Không tải được giỏ hàng: ${error.message}`, "error");
  }
}

async function showProductDetails(productId) {
  try {
    const product = await api.get(`/products/${productId}`);
    const description = product.description || "Chưa có mô tả cho sản phẩm này.";
    alert(`${product.name}\nGiá: ${formatPrice(product.promotional_price || product.price)}\nDanh mục: ${product.category?.name || "Chưa phân loại"}\nTồn kho: ${product.stock_quantity}\n\n${description}`);
  } catch (error) {
    showToast(`Không tải được chi tiết sản phẩm: ${error.message}`, "error");
  }
}

async function addToCart(productId, button) {
  if (!localStorage.getItem("token")) {
    showToast("Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.", "warning");
    window.location.href = "login.html?redirect=customer-home.html";
    return;
  }
  button.disabled = true;
  try {
    await api.post("/cart/items", { product_id: productId, quantity: 1 });
    const label = button.querySelector(".action-label");
    if (label) {
      label.textContent = "Đã thêm";
      window.setTimeout(() => { if (label.isConnected) label.textContent = "Thêm giỏ"; }, 900);
    }
    await refreshCartCount();
    showToast("Đã thêm sản phẩm vào giỏ hàng.", "success");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

function renderRecentOrders(orders) {
  const content = document.getElementById("shop-orders-content");
  if (!orders.length) {
    content.innerHTML = `<p class="orders-empty">Bạn chưa có đơn mua nào.</p>`;
    return;
  }
  content.innerHTML = orders.map(order => `<article class="orders-entry">
    <div><strong>${escapeHTML(order.order_code)}</strong><span class="order-status">${escapeHTML(order.status)}</span></div>
    <div><span>${new Date(order.created_at).toLocaleDateString("vi-VN")}</span><b>${formatPrice(order.total_amount)}</b></div>
  </article>`).join("");
}

async function openRecentOrders() {
  const button = document.getElementById("shop-orders-btn");
  const panel = document.getElementById("shop-orders-panel");
  const content = document.getElementById("shop-orders-content");
  if (!localStorage.getItem("token")) {
    window.location.href = "login.html?redirect=customer-home.html";
    return;
  }
  panel.hidden = false;
  button.setAttribute("aria-expanded", "true");
  content.textContent = "Đang tải đơn mua…";
  try {
    const result = await api.get("/orders/my", { page: 1, page_size: 5 });
    renderRecentOrders(result.items || []);
  } catch (error) {
    content.innerHTML = `<p class="orders-empty">${escapeHTML(error.message)}</p>`;
  }
}

function changeFilters() {
  state.page = 1;
  renderCategories();
  loadProducts();
}

document.getElementById("category-list").addEventListener("click", event => {
  const button = event.target.closest("[data-category-id]");
  if (!button) return;
  state.categoryId = Number(button.dataset.categoryId);
  changeFilters();
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
});
document.getElementById("category-filters").addEventListener("click", event => {
  if (event.target.closest("[data-toggle-category-dropdown]")) {
    const dropdown = event.target.closest(".category-dropdown");
    const isOpen = dropdown.classList.toggle("open");
    dropdown.querySelector("[data-toggle-category-dropdown]").setAttribute("aria-expanded", String(isOpen));
    return;
  }
  const button = event.target.closest("[data-category-id]");
  if (!button) return;
  state.categoryId = button.dataset.categoryId === "all" ? null : Number(button.dataset.categoryId);
  document.querySelector(".category-dropdown")?.classList.remove("open");
  changeFilters();
});
document.addEventListener("click", event => {
  const dropdown = document.querySelector(".category-dropdown");
  if (dropdown && !dropdown.contains(event.target)) {
    dropdown.classList.remove("open");
    dropdown.querySelector("[data-toggle-category-dropdown]")?.setAttribute("aria-expanded", "false");
  }
});
window.addEventListener("resize", () => {
  window.clearTimeout(window.customerCategoryResizeTimer);
  window.customerCategoryResizeTimer = window.setTimeout(renderCategories, 120);
});
document.getElementById("price-filters").addEventListener("click", event => {
  const button = event.target.closest("[data-price]");
  if (!button) return;
  state.price = button.dataset.price;
  document.querySelectorAll("#price-filters .chip").forEach(chip => chip.classList.toggle("active", chip === button));
  changeFilters();
});
document.getElementById("sort-select").addEventListener("change", changeFilters);
document.querySelectorAll(".view-toggle[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll(".view-toggle[data-view]").forEach(toggle => {
      const active = toggle.dataset.view === state.view;
      toggle.classList.toggle("active", active);
      toggle.setAttribute("aria-pressed", String(active));
    });
    document.getElementById("product-grid").classList.toggle("is-list", state.view === "list");
  });
});
function updateSearchMode() {
  document.body.classList.toggle("search-results-only", Boolean(document.getElementById("shop-search").value.trim()));
}
document.getElementById("shop-search").addEventListener("input", () => {
  updateSearchMode();
  window.clearTimeout(window.customerSearchTimer);
  window.customerSearchTimer = window.setTimeout(changeFilters, 300);
});
document.getElementById("search-submit").addEventListener("click", () => {
  updateSearchMode();
  changeFilters();
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
});
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.getElementById("shop-search").focus();
  }
});
document.getElementById("pagination").addEventListener("click", event => {
  const button = event.target.closest("[data-load-more]");
  if (!button || state.loadingMore) return;
  loadProducts({ append: true });
});
document.getElementById("product-grid").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "details") showProductDetails(Number(button.dataset.id));
  if (button.dataset.action === "cart") addToCart(Number(button.dataset.id), button);
});
document.getElementById("shop-orders-btn")?.addEventListener("click", () => {
  const panel = document.getElementById("shop-orders-panel");
  if (panel.hidden) openRecentOrders();
  else {
    panel.hidden = true;
    document.getElementById("shop-orders-btn").setAttribute("aria-expanded", "false");
  }
});
document.getElementById("shop-orders-panel")?.addEventListener("click", event => {
  if (!event.target.closest("[data-close-orders]")) return;
  document.getElementById("shop-orders-panel").hidden = true;
  document.getElementById("shop-orders-btn").setAttribute("aria-expanded", "false");
});
document.addEventListener("click", event => {
  const panel = document.getElementById("shop-orders-panel");
  if (!panel || panel.hidden || panel.contains(event.target) || event.target.closest("#shop-orders-btn")) return;
  panel.hidden = true;
  document.getElementById("shop-orders-btn")?.setAttribute("aria-expanded", "false");
});

async function initCustomerHome() {
  await Promise.all([loadCategories(), refreshCartCount()]);
  await loadProducts();
}
initCustomerHome();
