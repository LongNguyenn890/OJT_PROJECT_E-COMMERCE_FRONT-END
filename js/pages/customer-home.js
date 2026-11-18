// Customer catalog backed by the public product/category APIs and the signed-in cart API.
const PAGE_SIZE = 12;
const MAX_PRICE_LIMIT = 30000000;
const categoryIcons = ["công nghệ.svg", "thời trang.svg", "đồ gia dụng.svg", "balo và túi.svg", "quà tặng.svg", "dã ngoại.svg"];
const fallbackCategoryIcons = "ngành hàng.svg";

const state = {
  categories: [],
  products: [],
  categoryIds: [],
  minPrice: 0,
  maxPrice: MAX_PRICE_LIMIT,
  categorySearchQuery: "",
  page: 0,
  total: 0,
  requestId: 0,
  loadingMore: false,
  view: "grid"
};

const asset = name => `../assets/images/${encodeURIComponent(name)}`;
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formatPrice = value => `${Number(value || 0).toLocaleString("vi-VN")}₫`;

function imageUrl(path) {
  if (!path) return asset("logo_shop.svg");
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  const origin = CONFIG.API_BASE_URL.replace(/\/api\/?$/, "");
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

function normalizedCategoryName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
}

function formatCategoryDisplayName(category) {
  const raw = typeof category === "object" ? category?.name : category;
  const name = String(raw || "").trim();
  const norm = normalizedCategoryName(name);
  if (!name || norm === "adadadadad" || norm === "adadadadadad" || norm.includes("adadad") || norm.includes("adad") || norm === "test" || norm === "abc") {
    return "Điện thoại & Tablet";
  }
  return name;
}

function getCategoryIcon(category, index = 0) {
  const norm = normalizedCategoryName(category?.name);
  if (norm.includes("dien thoai") || norm.includes("tablet") || norm.includes("smartphone") || norm.includes("phone") || norm.includes("adadad")) {
    return asset("dien-thoai.svg");
  }
  if (norm.includes("laptop") || norm.includes("may tinh") || norm.includes("pc")) {
    return asset("laptop.svg");
  }
  if (norm.includes("tai nghe") || norm.includes("am thanh") || norm.includes("loa") || norm.includes("audio")) {
    return asset("tai-nghe.svg");
  }
  if (norm.includes("dong ho") || norm.includes("smartwatch") || norm.includes("watch")) {
    return asset("dong-ho.svg");
  }
  if (norm.includes("phu kien")) {
    return asset("phu-kien.svg");
  }
  if (norm.includes("thong minh") || norm.includes("smarthome") || norm.includes("smart home")) {
    return asset("smarthome.svg");
  }
  if (norm.includes("gia dung") || norm.includes("doi song") || norm.includes("nha bep")) {
    return asset("đồ gia dụng.svg");
  }
  if (norm.includes("thoi trang") || norm.includes("quan ao") || norm.includes("giay")) {
    return asset("thời trang.svg");
  }
  if (norm.includes("my pham") || norm.includes("cham soc") || norm.includes("sac dep") || norm.includes("beauty")) {
    return asset("my-pham.svg");
  }
  if (norm.includes("man hinh") || norm.includes("linh kien")) {
    return asset("linh-kien.svg");
  }
  if (norm.includes("the thao") || norm.includes("da ngoai") || norm.includes("outdoor")) {
    return asset("dã ngoại.svg");
  }
  if (norm.includes("sach") || norm.includes("van phong") || norm.includes("book")) {
    return asset("sach.svg");
  }
  if (norm.includes("balo") || norm.includes("tui")) {
    return asset("balo và túi.svg");
  }
  if (norm.includes("qua tang") || norm.includes("gift")) {
    return asset("quà tặng.svg");
  }
  return asset(categoryIcons[index % categoryIcons.length] || fallbackCategoryIcons);
}

function featuredCategories() {
  const groups = [
    ["dien thoai", "tablet", "cong nghe", "dien tu", "technology", "adadad"],
    ["laptop", "may tinh"],
    ["thoi trang", "fashion"],
    ["do gia dung", "gia dung", "home"],
    ["tai nghe", "am thanh"],
    ["da ngoai", "outdoor", "the thao"],
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

// 1. Render phần "Danh Mục Ngành Hàng" giao diện ban đầu (Icon + Tên danh mục, KHÔNG số người mua / nhãn thừa)
function renderTopFeaturedCategories() {
  const featured = featuredCategories();
  const categoryList = document.getElementById("category-list");
  if (!categoryList) return;

  categoryList.innerHTML = featured.length
    ? featured.map((category, index) => {
        const displayName = formatCategoryDisplayName(category);
        return `
          <button class="category-card" data-category-id="${category.id}" title="${escapeHTML(displayName)}">
            <span class="category-icon tone-${index % 6}">
              <img src="${getCategoryIcon(category, index)}" alt="${escapeHTML(displayName)}">
            </span>
            <strong>${escapeHTML(displayName)}</strong>
          </button>
        `;
      }).join("")
    : `<p class="catalog-empty">Chưa có danh mục sản phẩm.</p>`;
}

// 2. Render danh sách checkbox danh mục trong Sidebar (có tìm kiếm & chọn nhiều)
function renderSidebarCategories() {
  const container = document.getElementById("category-checkbox-list");
  if (!container) return;

  const query = normalizedCategoryName(state.categorySearchQuery);
  const filtered = state.categories.filter(cat => {
    if (!query) return true;
    const norm = normalizedCategoryName(formatCategoryDisplayName(cat));
    return norm.includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="cat-empty-notice">Không tìm thấy ngành hàng phù hợp</div>`;
  } else {
    container.innerHTML = filtered.map(cat => {
      const isChecked = state.categoryIds.includes(cat.id);
      const displayName = formatCategoryDisplayName(cat);
      return `
        <label class="cat-checkbox-item" data-cat-id="${cat.id}">
          <input type="checkbox" class="cat-checkbox-input" value="${cat.id}" ${isChecked ? "checked" : ""}>
          <img class="cat-icon-sm" src="${getCategoryIcon(cat)}" alt="">
          <span class="cat-name" title="${escapeHTML(displayName)}">${escapeHTML(displayName)}</span>
          <span class="cat-count">(${cat.product_count || 0})</span>
        </label>
      `;
    }).join("");
  }

  // Cập nhật số lượng danh mục đã chọn trên badge
  const badge = document.getElementById("category-selected-count");
  if (badge) {
    const count = state.categoryIds.length;
    badge.textContent = count;
    badge.hidden = count === 0;
  }
}

function renderCategories() {
  renderTopFeaturedCategories();
  renderSidebarCategories();
}

function productImage(product) {
  const images = [...(product.product_images || [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  return imageUrl(images[0]?.image_url);
}

function productShortDesc(product) {
  if (product.description && product.description.trim()) {
    const text = product.description.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  const catName = formatCategoryDisplayName(product.category);
  if (catName) {
    return `${catName} · Bảo hành chính hãng · Giao nhanh COD`;
  }
  return "Sản phẩm chính hãng chất lượng cao · Giao hàng toàn quốc";
}

function renderProducts() {
  const grid = document.getElementById("product-grid");
  if (!grid) return;
  grid.classList.toggle("is-list", state.view === "list");
  if (!state.products.length) {
    grid.innerHTML = `<div class="no-products">Không tìm thấy sản phẩm phù hợp với bộ lọc hiện tại.</div>`;
  } else {
    grid.innerHTML = state.products.map(product => {
      const shortDesc = productShortDesc(product);
      const hasPromo = product.promotional_price && Number(product.promotional_price) < Number(product.price);
      const catName = formatCategoryDisplayName(product.category);
      const categoryTag = catName ? `<span class="product-tag">${escapeHTML(catName)}</span>` : "";
      return `
        <article class="product-card">
          <div class="product-photo">
            ${categoryTag}
            <img src="${escapeHTML(productImage(product))}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.src='${asset("logo_shop.svg")}'">
          </div>
          <div class="product-info">
            <h3 title="${escapeHTML(product.name)}">${escapeHTML(product.name)}</h3>
            <p class="product-desc" title="${escapeHTML(shortDesc)}">${escapeHTML(shortDesc)}</p>
            <strong class="product-price">
              ${formatPrice(product.promotional_price || product.price)}
              ${hasPromo ? `<del class="product-old-price">${formatPrice(product.price)}</del>` : ""}
            </strong>
            <div class="product-actions">
              <button class="light-button" data-action="details" data-id="${product.id}"><img src="${asset("chi tiết.svg")}" alt=""> Xem chi tiết</button>
              <button class="blue-button" data-action="cart" data-id="${product.id}"><img src="${asset("thêm giỏ hàng.svg")}" alt=""> <span class="action-label">Thêm giỏ</span></button>
            </div>
          </div>
        </article>`;
    }).join("");
  }

  const pageSummary = document.getElementById("page-summary");
  if (pageSummary) {
    pageSummary.textContent = state.total
      ? `Đang hiển thị ${state.products.length} / ${state.total} sản phẩm`
      : "0 sản phẩm";
  }

  const pagination = document.getElementById("pagination");
  if (pagination) {
    const hasMore = state.products.length < state.total;
    pagination.innerHTML = hasMore
      ? `<button class="load-more-button" type="button" data-load-more ${state.loadingMore ? "disabled" : ""}>${state.loadingMore ? "Đang tải…" : "Xem thêm sản phẩm"}</button>`
      : "";
  }
}

async function loadCategories() {
  try {
    const rawCategories = await api.get("/categories");
    state.categories = (rawCategories || []).map(cat => ({
      ...cat,
      name: formatCategoryDisplayName(cat)
    }));
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
  const sortSelect = document.getElementById("sort-select");
  const params = {
    page: requestedPage,
    page_size: PAGE_SIZE,
    sort: sortSelect ? (
      sortSelect.value === "price-asc" ? "price_asc" :
      sortSelect.value === "price-desc" ? "price_desc" :
      sortSelect.value === "best_selling" ? "best_selling" : "newest"
    ) : "newest",
  };

  const keyword = document.getElementById("shop-search")?.value.trim() || "";
  if (keyword) params.search = keyword;

  // Lọc nhiều danh mục
  if (state.categoryIds && state.categoryIds.length === 1) {
    params.category_id = state.categoryIds[0];
  } else if (state.categoryIds && state.categoryIds.length > 1) {
    params.category_ids = state.categoryIds.join(",");
  }

  // Lọc giá theo thanh kéo
  if (state.minPrice > 0) params.min_price = state.minPrice;
  if (state.maxPrice < MAX_PRICE_LIMIT) params.max_price = state.maxPrice;

  state.loadingMore = append;
  if (!append) {
    state.products = [];
    state.total = 0;
    state.page = 0;
    const grid = document.getElementById("product-grid");
    if (grid) grid.innerHTML = `<div class="catalog-loading">Đang tải sản phẩm…</div>`;
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

// Cập nhật thanh hiển thị các tiêu chí đang lọc (Active filter chips)
function updateActiveFilterBar() {
  const bar = document.getElementById("active-filter-bar");
  const chipsWrap = document.getElementById("active-filter-chips");
  if (!bar || !chipsWrap) return;

  const chips = [];

  // 1. Danh mục đã chọn
  state.categoryIds.forEach(id => {
    const cat = state.categories.find(c => c.id === id);
    if (cat) {
      chips.push(`
        <span class="active-chip">
          🏷️ ${escapeHTML(formatCategoryDisplayName(cat))}
          <button type="button" class="active-chip-remove" data-remove-cat="${id}" title="Bỏ lọc danh mục này">×</button>
        </span>
      `);
    }
  });

  // 2. Khoảng giá thanh kéo
  if (state.minPrice > 0 || state.maxPrice < MAX_PRICE_LIMIT) {
    chips.push(`
      <span class="active-chip">
        💰 ${formatPrice(state.minPrice)} – ${formatPrice(state.maxPrice)}
        <button type="button" class="active-chip-remove" data-remove-price="true" title="Bỏ lọc khoảng giá">×</button>
      </span>
    `);
  }

  // 3. Từ khóa tìm kiếm
  const searchInput = document.getElementById("shop-search");
  const query = searchInput ? searchInput.value.trim() : "";
  if (query) {
    chips.push(`
      <span class="active-chip">
        🔍 "${escapeHTML(query)}"
        <button type="button" class="active-chip-remove" data-remove-search="true" title="Xóa tìm kiếm">×</button>
      </span>
    `);
  }

  if (chips.length > 0) {
    chipsWrap.innerHTML = chips.join("");
    bar.hidden = false;
  } else {
    chipsWrap.innerHTML = "";
    bar.hidden = true;
  }
}

// Khởi tạo thanh kéo khoảng giá (Dual Range Slider)
function initPriceSlider() {
  const rangeMin = document.getElementById("price-range-min");
  const rangeMax = document.getElementById("price-range-max");
  const fill = document.getElementById("range-slider-fill");
  const minVal = document.getElementById("price-min-val");
  const maxVal = document.getElementById("price-max-val");

  if (!rangeMin || !rangeMax) return;

  const STEP = 500000;

  function updateSliderUI(fromMinInput = true) {
    let min = Number(rangeMin.value);
    let max = Number(rangeMax.value);

    if (max - min < STEP) {
      if (fromMinInput) {
        rangeMin.value = max - STEP;
        min = max - STEP;
      } else {
        rangeMax.value = min + STEP;
        max = min + STEP;
      }
    }

    const minRatio = min / MAX_PRICE_LIMIT;
    const maxRatio = max / MAX_PRICE_LIMIT;

    if (fill) {
      // Kết nối thanh xanh chính xác giữa tâm của 2 núm kéo (không bị trồi ra ngoài)
      fill.style.left = `calc(9px + (100% - 18px) * ${minRatio})`;
      fill.style.width = `calc((100% - 18px) * ${maxRatio - minRatio})`;
    }

    if (minVal) minVal.textContent = formatPrice(min);
    if (maxVal) maxVal.textContent = formatPrice(max);

    // Cập nhật trạng thái active của các nút chọn nhanh
    document.querySelectorAll(".preset-chip").forEach(chip => {
      const chipMin = Number(chip.dataset.min);
      const chipMax = Number(chip.dataset.max);
      chip.classList.toggle("active", min === chipMin && max === chipMax);
    });
  }

  rangeMin.addEventListener("input", () => {
    rangeMin.style.zIndex = "4";
    rangeMax.style.zIndex = "3";
    updateSliderUI(true);
  });
  rangeMax.addEventListener("input", () => {
    rangeMax.style.zIndex = "4";
    rangeMin.style.zIndex = "3";
    updateSliderUI(false);
  });

  // Sự kiện khi bấm các chip khoảng giá định sẵn
  document.querySelectorAll(".preset-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const pMin = Number(chip.dataset.min);
      const pMax = Number(chip.dataset.max);
      rangeMin.value = pMin;
      rangeMax.value = pMax;
      updateSliderUI();
    });
  });

  updateSliderUI();
}

// Áp dụng bộ lọc từ sidebar khi bấm nút "Lọc sản phẩm"
function applyFiltersFromSidebar() {
  const checkedBoxes = Array.from(document.querySelectorAll(".cat-checkbox-input:checked"));
  state.categoryIds = checkedBoxes.map(cb => Number(cb.value));

  const rangeMin = document.getElementById("price-range-min");
  const rangeMax = document.getElementById("price-range-max");
  state.minPrice = rangeMin ? Number(rangeMin.value) : 0;
  state.maxPrice = rangeMax ? Number(rangeMax.value) : MAX_PRICE_LIMIT;

  const badge = document.getElementById("category-selected-count");
  if (badge) {
    badge.textContent = state.categoryIds.length;
    badge.hidden = state.categoryIds.length === 0;
  }

  updateActiveFilterBar();
  state.page = 1;
  loadProducts();
}

// Đặt lại toàn bộ bộ lọc
function resetAllFilters() {
  state.categoryIds = [];
  state.minPrice = 0;
  state.maxPrice = MAX_PRICE_LIMIT;
  state.categorySearchQuery = "";

  const catSearchInput = document.getElementById("category-search-input");
  if (catSearchInput) catSearchInput.value = "";
  const clearCatSearchBtn = document.getElementById("clear-cat-search");
  if (clearCatSearchBtn) clearCatSearchBtn.hidden = true;

  const rangeMin = document.getElementById("price-range-min");
  const rangeMax = document.getElementById("price-range-max");
  if (rangeMin) rangeMin.value = 0;
  if (rangeMax) rangeMax.value = MAX_PRICE_LIMIT;

  renderSidebarCategories();
  initPriceSlider();
  updateActiveFilterBar();
  state.page = 1;
  loadProducts();
}

async function refreshCartCount() {
  const countElem = document.getElementById("cart-count");
  const countLabelElem = document.getElementById("cart-count-label");
  if (!localStorage.getItem("token")) {
    if (countElem) countElem.textContent = "0";
    if (countLabelElem) countLabelElem.textContent = "0 món";
    return;
  }
  try {
    const cart = await api.get("/cart");
    const quantity = (cart.cart_items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
    if (countElem) countElem.textContent = quantity;
    if (countLabelElem) countLabelElem.textContent = `${quantity} món`;
  } catch (error) {
    if (error.status !== 401) showToast(`Không tải được giỏ hàng: ${error.message}`, "error");
  }
}

async function addToCart(productId, button) {
  if (!localStorage.getItem("token")) {
    window.location.href = "../pages/login.html";
    return;
  }
  const originalHtml = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span>Đang thêm…</span>`;
  try {
    await api.post("/cart/items", { product_id: productId, quantity: 1 });
    showToast("Đã thêm sản phẩm vào giỏ hàng!", "success");
    await refreshCartCount();
  } catch (error) {
    showToast(`Thêm vào giỏ thất bại: ${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = originalHtml;
  }
}

async function showProductDetails(productId) {
  try {
    const product = await api.get(`/products/${productId}`);
    const modal = document.createElement("div");
    modal.className = "product-detail-modal";
    const primaryImg = productImage(product);
    modal.innerHTML = `
      <div class="product-modal-backdrop"></div>
      <div class="product-modal-card">
        <button class="modal-close-btn" type="button" aria-label="Đóng">×</button>
        <div class="modal-body">
          <div class="modal-gallery">
            <img class="modal-main-img" src="${escapeHTML(primaryImg)}" alt="${escapeHTML(product.name)}">
          </div>
          <div class="modal-info">
            <span class="product-tag">${escapeHTML(product.category?.name || "Sản phẩm")}</span>
            <h2>${escapeHTML(product.name)}</h2>
            <div class="modal-price-wrap">
              <strong class="product-price">${formatPrice(product.promotional_price || product.price)}</strong>
              ${product.promotional_price && Number(product.promotional_price) < Number(product.price) ? `<del class="product-old-price">${formatPrice(product.price)}</del>` : ""}
            </div>
            <p class="modal-desc">${escapeHTML(product.description || "Chưa có mô tả chi tiết.")}</p>
            <div class="modal-meta-grid">
              <div><small>Mã SKU:</small> <b>${escapeHTML(product.sku || "N/A")}</b></div>
              <div><small>Tình trạng:</small> <b>${product.stock_quantity > 0 ? `Còn hàng (${product.stock_quantity})` : "Hết hàng"}</b></div>
            </div>
            <div class="modal-actions">
              <button class="blue-button modal-cart-btn" type="button" data-id="${product.id}" ${product.stock_quantity <= 0 ? "disabled" : ""}>
                <img src="${asset("thêm giỏ hàng.svg")}" alt=""> Thêm vào giỏ hàng
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector(".modal-close-btn").addEventListener("click", closeModal);
    modal.querySelector(".product-modal-backdrop").addEventListener("click", closeModal);
    modal.querySelector(".modal-cart-btn")?.addEventListener("click", (e) => {
      addToCart(product.id, e.currentTarget);
      closeModal();
    });
  } catch (error) {
    showToast(`Không tải được chi tiết: ${error.message}`, "error");
  }
}



// Click vào card ở mục "Danh Mục Ngành Hàng" nổi bật phía trên: lọc nhanh theo danh mục đó trong sidebar
document.getElementById("category-list")?.addEventListener("click", event => {
  const button = event.target.closest("[data-category-id]");
  if (!button) return;
  const catId = Number(button.dataset.categoryId);
  state.categoryIds = [catId];
  renderSidebarCategories();
  updateActiveFilterBar();
  state.page = 1;
  loadProducts();
  document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
});

// Accordion đóng mở danh mục trong sidebar
document.getElementById("category-accordion-toggle")?.addEventListener("click", () => {
  const btn = document.getElementById("category-accordion-toggle");
  const isExpanded = btn.getAttribute("aria-expanded") === "true";
  btn.setAttribute("aria-expanded", String(!isExpanded));
});

// Thanh tìm kiếm danh mục trong sidebar
const catSearchInput = document.getElementById("category-search-input");
const clearCatSearchBtn = document.getElementById("clear-cat-search");
if (catSearchInput) {
  catSearchInput.addEventListener("input", () => {
    state.categorySearchQuery = catSearchInput.value.trim();
    if (clearCatSearchBtn) clearCatSearchBtn.hidden = !state.categorySearchQuery;
    renderSidebarCategories();
  });
}
if (clearCatSearchBtn) {
  clearCatSearchBtn.addEventListener("click", () => {
    catSearchInput.value = "";
    state.categorySearchQuery = "";
    clearCatSearchBtn.hidden = true;
    renderSidebarCategories();
    catSearchInput.focus();
  });
}

// Bắt sự kiện thay đổi checkbox trong sidebar (cập nhật badge số lượng)
document.getElementById("category-checkbox-list")?.addEventListener("change", (e) => {
  if (e.target.classList.contains("cat-checkbox-input")) {
    const checkedBoxes = Array.from(document.querySelectorAll(".cat-checkbox-input:checked"));
    const count = checkedBoxes.length;
    const badge = document.getElementById("category-selected-count");
    if (badge) {
      badge.textContent = count;
      badge.hidden = count === 0;
    }
  }
});

// Nút "Lọc sản phẩm" trong sidebar
document.getElementById("filter-apply-btn")?.addEventListener("click", () => {
  applyFiltersFromSidebar();
  document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
});

// Nút Đặt lại bộ lọc
document.getElementById("filter-clear-btn")?.addEventListener("click", resetAllFilters);
document.getElementById("filter-reset-top")?.addEventListener("click", resetAllFilters);

// Xử lý click trên thanh active filter chips
document.getElementById("active-filter-bar")?.addEventListener("click", (e) => {
  if (e.target.closest("#clear-all-chips")) {
    resetAllFilters();
    return;
  }
  const removeCatBtn = e.target.closest("[data-remove-cat]");
  if (removeCatBtn) {
    const id = Number(removeCatBtn.dataset.removeCat);
    state.categoryIds = state.categoryIds.filter(cid => cid !== id);
    renderSidebarCategories();
    updateActiveFilterBar();
    state.page = 1;
    loadProducts();
    return;
  }
  const removePriceBtn = e.target.closest("[data-remove-price]");
  if (removePriceBtn) {
    state.minPrice = 0;
    state.maxPrice = MAX_PRICE_LIMIT;
    const rangeMin = document.getElementById("price-range-min");
    const rangeMax = document.getElementById("price-range-max");
    if (rangeMin) rangeMin.value = 0;
    if (rangeMax) rangeMax.value = MAX_PRICE_LIMIT;
    initPriceSlider();
    updateActiveFilterBar();
    state.page = 1;
    loadProducts();
    return;
  }
  const removeSearchBtn = e.target.closest("[data-remove-search]");
  if (removeSearchBtn) {
    const searchInput = document.getElementById("shop-search");
    if (searchInput) searchInput.value = "";
    document.body.classList.remove("search-results-only");
    updateActiveFilterBar();
    state.page = 1;
    loadProducts();
    return;
  }
});

// Sắp xếp sản phẩm
document.getElementById("sort-select")?.addEventListener("change", () => {
  state.page = 1;
  loadProducts();
});

// Toggle view dạng lưới / dạng danh sách
document.querySelectorAll(".view-toggle[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll(".view-toggle[data-view]").forEach(toggle => {
      const active = toggle.dataset.view === state.view;
      toggle.classList.toggle("active", active);
      toggle.setAttribute("aria-pressed", String(active));
    });
    document.getElementById("product-grid")?.classList.toggle("is-list", state.view === "list");
  });
});

function updateSearchMode() {
  document.body.classList.toggle("search-results-only", Boolean(document.getElementById("shop-search")?.value.trim()));
}

document.getElementById("shop-search")?.addEventListener("input", () => {
  updateSearchMode();
  updateActiveFilterBar();
  window.clearTimeout(window.customerSearchTimer);
  window.customerSearchTimer = window.setTimeout(() => {
    state.page = 1;
    loadProducts();
  }, 300);
});

document.getElementById("search-submit")?.addEventListener("click", () => {
  updateSearchMode();
  updateActiveFilterBar();
  state.page = 1;
  loadProducts();
  document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
});

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.getElementById("shop-search")?.focus();
  }
});

document.getElementById("pagination")?.addEventListener("click", event => {
  const button = event.target.closest("[data-load-more]");
  if (!button || state.loadingMore) return;
  loadProducts({ append: true });
});

document.getElementById("product-grid")?.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "details") showProductDetails(Number(button.dataset.id));
  if (button.dataset.action === "cart") addToCart(Number(button.dataset.id), button);
});

async function initCustomerHome() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialSearch = urlParams.get("search");
  if (initialSearch) {
    const searchInput = document.getElementById("shop-search");
    if (searchInput) {
      searchInput.value = initialSearch;
      updateSearchMode();
    }
  }

  initPriceSlider();
  await Promise.all([loadCategories(), refreshCartCount()]);
  await loadProducts();
  updateActiveFilterBar();
}

initCustomerHome();
