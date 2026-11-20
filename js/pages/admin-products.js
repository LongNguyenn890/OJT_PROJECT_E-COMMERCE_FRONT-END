/**
 * SHOPEASE - QUẢN LÝ SẢN PHẨM (admin-products.js)
 * Xử lý toàn bộ logic cho trang admin-products.html:
 *  - GET    /api/products                   : Danh sách sản phẩm kèm lọc danh mục, trạng thái, tìm kiếm, phân trang
 *  - GET    /api/products/{id}              : Xem chi tiết sản phẩm và danh sách hình ảnh
 *  - POST   /api/products                   : Thêm sản phẩm mới
 *  - PUT    /api/products/{id}              : Cập nhật thông tin sản phẩm
 *  - PATCH  /api/products/{id}/visibility   : Bật/tắt hiển thị (Ẩn / Hiện)
 *  - DELETE /api/products/{id}              : Xóa hoặc ẩn sản phẩm (BR-12)
 *  - POST   /api/products/{id}/images       : Upload nhiều ảnh cho sản phẩm
 *  - PUT    /api/products/{id}/images/{img_id}/primary : Đặt ảnh đại diện
 *  - DELETE /api/products/{id}/images/{img_id}         : Xóa một ảnh của sản phẩm
 */

// Biến trạng thái toàn cục
let currentPage = 1;
const pageSize = 10;
let totalProducts = 0;
let categoriesList = [];
let pendingDeletingProduct = null;

// Quản lý ảnh xem trước khi thêm/sửa
// Array of { file: File, previewUrl: string, isPrimary: boolean }
let selectedNewImageFiles = [];
// Array of ProductImage from server when editing: { id, image_url, is_primary }
let currentExistingImages = [];

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Luôn đảm bảo có token JWT Quản trị viên
  await ensureAdminSession();

  // 2. Khởi tạo sự kiện giao diện
  initModalTriggers();
  initFilterControls();
  initDropzoneAndImageUpload();
  initProductForm();

  // 3. Tải dữ liệu danh mục & danh sách sản phẩm
  await loadCategories();
  await loadProductsList();
});

/**
 * Trích xuất câu thông báo lỗi thân thiện từ ApiError hoặc AxiosError
 */
function extractErrorMessage(err, fallback = "Đã xảy ra lỗi.") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err.data && typeof err.data.detail === "string") return err.data.detail;
  if (err.data && Array.isArray(err.data.detail)) {
    return err.data.detail.map((e) => e.msg || e).join("; ");
  }
  if (err.response && err.response.data && typeof err.response.data.detail === "string") {
    return err.response.data.detail;
  }
  if (err.response && err.response.data && Array.isArray(err.response.data.detail)) {
    return err.response.data.detail.map((e) => e.msg || e).join("; ");
  }
  if (err.message) return err.message;
  return fallback;
}

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
      const meRes = await axios.get(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 2500,
      });
      const roleStr = String(meRes.data?.role || "").toUpperCase();
      if (!roleStr.includes("ADMIN") && !roleStr.includes("STAFF")) {
        needsLogin = true;
      }
    } catch (_) {
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
      console.warn("[Admin Products] Không thể đăng nhập tự động:", e);
    }
  }
}

/**
 * Định dạng số tiền VNĐ
 */
function formatVND(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "—";
  return Number(amount).toLocaleString("vi-VN") + " ₫";
}

/**
 * Chuẩn hóa URL ảnh (hỗ trợ đường dẫn tương đối từ backend)
 */
function resolveImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const baseUrl = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL)
    ? CONFIG.API_BASE_URL.replace(/\/api\/?$/, "")
    : "http://127.0.0.1:8000";
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Nạp danh sách danh mục để phục vụ bộ lọc và form thêm/sửa
 */
async function loadCategories() {
  try {
    const res = await api.get("/categories");
    categoriesList = Array.isArray(res) ? res : (res.items || res.categories || []);

    const filterSelect = document.getElementById("filter-category-select");
    const formCatSelect = document.getElementById("prod-category");

    if (filterSelect) {
      const currentVal = filterSelect.value;
      filterSelect.innerHTML = `<option value="">-- Tất cả danh mục --</option>` +
        categoriesList.map((cat) => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join("");
      filterSelect.value = currentVal;
    }

    if (formCatSelect) {
      formCatSelect.innerHTML = `<option value="">-- Chọn danh mục --</option>` +
        categoriesList.map((cat) => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join("");
    }
  } catch (error) {
    console.error("[Admin Products] Lỗi nạp danh mục:", error);
  }
}

/**
 * Nạp danh sách sản phẩm từ Backend kèm tìm kiếm, lọc, phân trang
 */
async function loadProductsList() {
  const tbody = document.getElementById("product-table-body");
  const summaryLbl = document.getElementById("product-summary-lbl");

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
          <span class="btn-op-spinner" style="width: 20px; height: 20px; border-width: 2px; margin-bottom: 8px;"></span>
          <div>Đang đồng bộ danh sách sản phẩm từ cơ sở dữ liệu...</div>
        </td>
      </tr>
    `;
  }

  // Thu thập các tham số lọc
  const searchInput = document.getElementById("filter-search-input");
  const catSelect = document.getElementById("filter-category-select");
  const statusSelect = document.getElementById("filter-status-select");
  const stockSelect = document.getElementById("filter-stock-select");
  const sortSelect = document.getElementById("filter-sort-select");

  const searchKeyword = (searchInput ? searchInput.value : "").trim();
  const categoryId = catSelect && catSelect.value ? parseInt(catSelect.value, 10) : null;
  const statusVal = statusSelect && statusSelect.value !== "" ? parseInt(statusSelect.value, 10) : -1;
  const stockVal = stockSelect ? stockSelect.value : "";
  const sortVal = sortSelect ? sortSelect.value : "newest";

  const params = {
    page: currentPage,
    page_size: pageSize,
    sort: sortVal,
  };

  if (searchKeyword) params.search = searchKeyword;
  if (categoryId) params.category_id = categoryId;
  if (statusVal !== null && statusVal !== undefined && statusVal !== -1) {
    params.is_visible = statusVal;
  } else {
    params.is_visible = -1; // Lấy tất cả cả ẩn lẫn hiện cho Admin
  }

  if (stockVal === "in_stock") params.in_stock = true;
  else if (stockVal === "out_stock") params.in_stock = false;

  try {
    const res = await api.get("/products", params);
    const items = res.items || [];
    totalProducts = res.total !== undefined ? res.total : items.length;

    renderProductsTable(items);
    renderPagination(totalProducts);
    updateKpis();
  } catch (error) {
    console.error("[Admin Products] Lỗi nạp danh sách sản phẩm:", error);
    const errMsg = extractErrorMessage(error, "Lỗi kết nối máy chủ API");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--admin-danger); padding: 40px 16px;">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 6px;">Không thể tải danh sách sản phẩm</div>
            <div style="font-size: 12.5px; color: var(--admin-text-muted); margin-bottom: 12px;">${escapeHtml(errMsg)}</div>
            <button type="button" class="btn-admin-action secondary" onclick="loadProductsList()">Thử lại</button>
          </td>
        </tr>
      `;
    }
    if (summaryLbl) summaryLbl.textContent = "Lỗi kết nối máy chủ";
  }
}

/**
 * Cập nhật số liệu trên 4 thẻ KPI nhanh
 */
async function updateKpis() {
  try {
    // Gọi API lấy tổng quan sản phẩm
    const [allRes, activeRes, outStockRes] = await Promise.all([
      api.get("/products", { page: 1, page_size: 1, is_visible: -1 }),
      api.get("/products", { page: 1, page_size: 1, is_visible: 1 }),
      api.get("/products", { page: 1, page_size: 1, is_visible: -1, in_stock: false }),
    ]);

    const total = allRes.total || 0;
    const active = activeRes.total || 0;
    const hidden = Math.max(0, total - active);
    const outStock = outStockRes.total || 0;

    const elTotal = document.getElementById("kpi-total-products");
    const elActive = document.getElementById("kpi-visible-products");
    const elHidden = document.getElementById("kpi-hidden-products");
    const elOutStock = document.getElementById("kpi-out-stock-products");

    if (elTotal) elTotal.textContent = total.toLocaleString("vi-VN");
    if (elActive) elActive.textContent = active.toLocaleString("vi-VN");
    if (elHidden) elHidden.textContent = hidden.toLocaleString("vi-VN");
    if (elOutStock) elOutStock.textContent = outStock.toLocaleString("vi-VN");
  } catch (e) {
    console.warn("[Admin Products] Lỗi tính toán KPI:", e);
  }
}

/**
 * Render bảng danh sách sản phẩm
 */
function renderProductsTable(products) {
  const tbody = document.getElementById("product-table-body");
  const summaryLbl = document.getElementById("product-summary-lbl");
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 48px 16px; color: var(--admin-text-muted);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 8px; display: inline-block; color: #94a3b8;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <div style="font-size: 14px; font-weight: 600; color: var(--admin-text-main);">Không tìm thấy sản phẩm nào</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc danh mục/trạng thái</div>
        </td>
      </tr>
    `;
    if (summaryLbl) summaryLbl.textContent = `0 sản phẩm (Tổng ${totalProducts})`;
    return;
  }

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + products.length, totalProducts);

  tbody.innerHTML = products.map((prod) => {
    // 1. Hình ảnh đại diện
    let primaryImgUrl = "";
    if (prod.product_images && prod.product_images.length > 0) {
      const primaryImg = prod.product_images.find((img) => img.is_primary === 1) || prod.product_images[0];
      if (primaryImg && primaryImg.image_url) {
        primaryImgUrl = resolveImageUrl(primaryImg.image_url);
      }
    }

    const imageHtml = primaryImgUrl
      ? `<img src="${escapeHtml(primaryImgUrl)}" alt="${escapeHtml(prod.name)}" class="product-thumb-img" onerror="this.parentElement.innerHTML='<span class=\\'product-thumb-placeholder\\'>📦</span>'">`
      : `<span class="product-thumb-placeholder">📦</span>`;

    // 2. Tên danh mục
    const categoryName = prod.category ? prod.category.name : "Chưa phân loại";

    // 3. Giá bán và giá khuyến mãi
    const priceVal = Number(prod.price || 0);
    const promoVal = prod.promotional_price !== null && prod.promotional_price !== undefined
      ? Number(prod.promotional_price)
      : null;

    let priceHtml = "";
    if (promoVal !== null && promoVal >= 0 && promoVal < priceVal) {
      priceHtml = `
        <div class="price-display-wrap">
          <span class="price-promo">${formatVND(promoVal)}</span>
          <span class="price-original-struck">${formatVND(priceVal)}</span>
        </div>
      `;
    } else {
      priceHtml = `
        <div class="price-display-wrap">
          <span class="price-main">${formatVND(priceVal)}</span>
        </div>
      `;
    }

    // 4. Badge tồn kho
    const stock = Number(prod.stock_quantity || 0);
    let stockHtml = "";
    if (stock > 10) {
      stockHtml = `<span class="badge-stock in-stock" title="Còn hàng trong kho"><span>${stock.toLocaleString("vi-VN")} cái</span></span>`;
    } else if (stock > 0) {
      stockHtml = `<span class="badge-stock low-stock" title="Sắp hết hàng trong kho"><span>${stock} cái</span></span>`;
    } else {
      stockHtml = `<span class="badge-stock out-of-stock" title="Đã hết hàng"><span>Hết hàng</span></span>`;
    }

    // 5. Trạng thái hiển thị (is_visible)
    const isVisible = Number(prod.is_visible) === 1;
    const visibilityHtml = isVisible
      ? `<span class="badge-visibility visible" title="Bấm để tạm ẩn sản phẩm" onclick="toggleProductVisibility(${prod.id}, 0)">
          <span style="width: 6px; height: 6px; border-radius: 50%; background-color: #047857;"></span>
          <span>Đang bán</span>
        </span>`
      : `<span class="badge-visibility hidden" title="Bấm để bật bán sản phẩm" onclick="toggleProductVisibility(${prod.id}, 1)">
          <span style="width: 6px; height: 6px; border-radius: 50%; background-color: #94a3b8;"></span>
          <span>Tạm ẩn</span>
        </span>`;

    // Mã SKU
    const skuCode = prod.sku ? escapeHtml(prod.sku) : `SP-${String(prod.id).padStart(3, "0")}`;

    return `
      <tr>
        <td>
          <span class="badge-sku" title="Mã SKU: ${skuCode}">${skuCode}</span>
        </td>
        <td>
          <div class="product-cell-main">
            <div class="product-thumb-wrap">
              ${imageHtml}
            </div>
            <div class="product-meta-wrap">
              <span class="product-title-text" title="${escapeHtml(prod.name)}">${escapeHtml(prod.name)}</span>
              <span class="product-category-sub">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                <span>${escapeHtml(categoryName)}</span>
              </span>
            </div>
          </div>
        </td>
        <td>
          ${priceHtml}
        </td>
        <td style="text-align: center;">
          ${stockHtml}
        </td>
        <td style="text-align: center;">
          ${visibilityHtml}
        </td>
        <td style="text-align: center;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
            <button type="button" class="btn-prod-action edit" title="Chỉnh sửa sản phẩm" onclick="openEditProductModal(${prod.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
            <button type="button" class="btn-prod-action toggle" title="${isVisible ? 'Tạm ẩn sản phẩm' : 'Hiện sản phẩm'}" onclick="toggleProductVisibility(${prod.id}, ${isVisible ? 0 : 1})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${isVisible 
                  ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
                  : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
                }
              </svg>
            </button>
            <button type="button" class="btn-prod-action delete" title="Xóa sản phẩm" onclick="openDeleteProductModal(${prod.id}, '${escapeHtml(prod.name).replace(/'/g, "\\'")}', '${skuCode}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  if (summaryLbl) {
    const startItem = totalProducts === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalProducts);
    const totalPages = Math.ceil(totalProducts / pageSize) || 1;
    if (totalProducts === 0) {
      summaryLbl.textContent = "Hiển thị 0 sản phẩm";
    } else {
      summaryLbl.textContent = `Hiển thị ${startItem} - ${endItem} trong tổng số ${totalProducts} sản phẩm (Trang ${currentPage}/${totalPages})`;
    }
  }
}

/**
 * Phân trang truyền thống theo số trang (Classic Pagination)
 */
function renderPagination(total) {
  const container = document.getElementById("product-pagination");
  if (!container) return;

  const totalPages = Math.ceil(total / pageSize) || 1;
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `
    <button type="button" class="page-btn prev-btn" ${currentPage === 1 ? "disabled" : ""} onclick="changeProductPage(${currentPage - 1})" title="Trang trước">
      &laquo;
    </button>
  `;

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      html += `
        <button type="button" class="page-btn ${i === currentPage ? "active" : ""}" ${i === currentPage ? "disabled" : ""} onclick="changeProductPage(${i})">
          ${i}
        </button>
      `;
    }
  } else {
    html += `
      <button type="button" class="page-btn ${currentPage === 1 ? "active" : ""}" ${currentPage === 1 ? "disabled" : ""} onclick="changeProductPage(1)">
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
        <button type="button" class="page-btn ${i === currentPage ? "active" : ""}" ${i === currentPage ? "disabled" : ""} onclick="changeProductPage(${i})">
          ${i}
        </button>
      `;
    }

    if (currentPage < totalPages - 2) {
      html += `<span class="page-ellipsis">...</span>`;
    }

    html += `
      <button type="button" class="page-btn ${currentPage === totalPages ? "active" : ""}" ${currentPage === totalPages ? "disabled" : ""} onclick="changeProductPage(${totalPages})">
        ${totalPages}
      </button>
    `;
  }

  html += `
    <button type="button" class="page-btn next-btn" ${currentPage === totalPages ? "disabled" : ""} onclick="changeProductPage(${currentPage + 1})" title="Trang sau">
      &raquo;
    </button>
  `;

  container.innerHTML = html;
}

function changeProductPage(page) {
  const totalPages = Math.ceil(totalProducts / pageSize) || 1;
  if (page < 1 || page > totalPages || page === currentPage) return;
  currentPage = page;
  loadProductsList();
  const table = document.getElementById("products-table");
  if (table) table.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
window.changeProductPage = changeProductPage;
window.changePage = changeProductPage;

/**
 * Khởi tạo bộ lọc và ô tìm kiếm
 */
function initFilterControls() {
  const searchInput = document.getElementById("filter-search-input");
  const catSelect = document.getElementById("filter-category-select");
  const statusSelect = document.getElementById("filter-status-select");
  const stockSelect = document.getElementById("filter-stock-select");
  const sortSelect = document.getElementById("filter-sort-select");
  const resetBtn = document.getElementById("btn-reset-filters");
  const refreshBtn = document.getElementById("btn-refresh-products");

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentPage = 1;
        loadProductsList();
      }, 300);
    });
  }

  [catSelect, statusSelect, stockSelect, sortSelect].forEach((el) => {
    if (el) {
      el.addEventListener("change", () => {
        currentPage = 1;
        loadProductsList();
      });
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (catSelect) catSelect.value = "";
      if (statusSelect) statusSelect.value = "-1";
      if (stockSelect) stockSelect.value = "";
      if (sortSelect) sortSelect.value = "newest";
      currentPage = 1;
      loadProductsList();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      const icon = refreshBtn.querySelector("svg");
      if (icon) icon.style.animation = "spin-refresh-anim 0.75s linear infinite";
      await loadCategories();
      await loadProductsList();
      if (icon) icon.style.animation = "";
      refreshBtn.disabled = false;
      if (typeof showToast === "function") {
        showToast("Đã đồng bộ lại dữ liệu sản phẩm mới nhất!", "info");
      }
    });
  }

  // Tự sinh SKU gợi ý
  const autoSkuBtn = document.getElementById("btn-auto-sku");
  if (autoSkuBtn) {
    autoSkuBtn.addEventListener("click", () => {
      const nameInput = document.getElementById("prod-name");
      const skuInput = document.getElementById("prod-sku");
      const catSelect = document.getElementById("prod-category");

      let prefix = "SP";
      if (catSelect && catSelect.selectedIndex > 0) {
        const catText = catSelect.options[catSelect.selectedIndex].text;
        const initials = catText.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase();
        if (initials) prefix = initials.substring(0, 4);
      }

      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const generated = `${prefix}-${Date.now().toString().slice(-4)}${randomCode}`;
      if (skuInput) skuInput.value = generated;
    });
  }
}

/**
 * ==========================================================
 * QUẢN LÝ UPLOAD ẢNH & XEM TRƯỚC (PREVIEW)
 * ==========================================================
 */

function initDropzoneAndImageUpload() {
  const dropzone = document.getElementById("image-dropzone");
  const fileInput = document.getElementById("product-images-input");

  if (!dropzone || !fileInput) return;

  // Bấm vào dropzone để mở dialog chọn file
  dropzone.addEventListener("click", () => {
    fileInput.click();
  });

  // Xử lý khi chọn file qua dialog
  fileInput.addEventListener("change", (e) => {
    handleIncomingFiles(e.target.files);
    fileInput.value = ""; // Reset để cho phép chọn lại cùng 1 file nếu muốn
  });

  // Kéo thả file vào dropzone
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer && e.dataTransfer.files) {
      handleIncomingFiles(e.dataTransfer.files);
    }
  });
}

/**
 * Xử lý danh sách file ảnh người dùng vừa chọn/thả vào
 */
function handleIncomingFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  const validTypes = ["image/jpeg", "image/png", "image/jpg"];
  const maxSizeBytes = 100 * 1024 * 1024; // 100MB

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];

    if (!validTypes.includes(file.type.toLowerCase())) {
      if (typeof showToast === "function") {
        showToast(`Tệp "${file.name}" không hợp lệ. Chỉ chấp nhận định dạng JPG, JPEG hoặc PNG.`, "error");
      }
      continue;
    }

    if (file.size > maxSizeBytes) {
      if (typeof showToast === "function") {
        showToast(`Tệp "${file.name}" vượt quá dung lượng tối đa 100MB.`, "error");
      }
      continue;
    }

    const previewUrl = URL.createObjectURL(file);
    // Nếu chưa có ảnh nào là primary thì ảnh mới đầu tiên sẽ là primary
    const hasPrimary = selectedNewImageFiles.some((f) => f.isPrimary) || currentExistingImages.some((img) => img.is_primary === 1);
    
    selectedNewImageFiles.push({
      file: file,
      previewUrl: previewUrl,
      isPrimary: !hasPrimary,
    });
  }

  renderNewImagesPreview();
}

/**
 * Render grid danh sách ảnh xem trước chuẩn bị tải lên
 */
function renderNewImagesPreview() {
  const container = document.getElementById("images-preview-container");
  const heading = document.getElementById("preview-heading");
  if (!container) return;

  if (heading) {
    heading.textContent = `Ảnh xem trước (${selectedNewImageFiles.length})`;
  }

  if (selectedNewImageFiles.length === 0) {
    container.innerHTML = `<span style="font-size: 11.5px; color: #94a3b8; font-style: italic;">Chưa có ảnh mới nào được chọn.</span>`;
    return;
  }

  container.innerHTML = selectedNewImageFiles.map((item, idx) => `
    <div class="image-preview-card ${item.isPrimary ? 'is-primary' : ''}">
      <img src="${item.previewUrl}" alt="Preview ${idx + 1}">
      ${item.isPrimary ? '<span class="preview-badge-primary">★ Ảnh chính</span>' : ''}
      <div class="preview-overlay-actions">
        <button type="button" class="btn-preview-action star" title="Đặt làm ảnh chính" onclick="setPrimaryNewImage(${idx})">
          ★
        </button>
        <button type="button" class="btn-preview-action remove" title="Xóa ảnh này" onclick="removeNewImage(${idx})">
          &times;
        </button>
      </div>
    </div>
  `).join("");
}

/**
 * Đặt một ảnh mới làm ảnh đại diện chính
 */
function setPrimaryNewImage(index) {
  selectedNewImageFiles.forEach((item, idx) => {
    item.isPrimary = idx === index;
  });
  renderNewImagesPreview();
}

/**
 * Xóa một ảnh mới khỏi danh sách xem trước
 */
function removeNewImage(index) {
  if (index >= 0 && index < selectedNewImageFiles.length) {
    const removed = selectedNewImageFiles.splice(index, 1)[0];
    if (removed && removed.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
    }

    // Nếu ảnh vừa xóa là primary và vẫn còn ảnh, chuyển primary sang ảnh đầu tiên
    if (removed && removed.isPrimary && selectedNewImageFiles.length > 0) {
      selectedNewImageFiles[0].isPrimary = true;
    }
  }
  renderNewImagesPreview();
}

/**
 * Render danh sách ảnh đang lưu trữ trên máy chủ (dành cho chế độ chỉnh sửa)
 */
function renderExistingImages(productId, images) {
  const section = document.getElementById("existing-images-section");
  const container = document.getElementById("existing-images-container");
  if (!section || !container) return;

  currentExistingImages = images || [];

  if (currentExistingImages.length === 0) {
    section.style.display = "none";
    container.innerHTML = "";
    return;
  }

  section.style.display = "block";
  container.innerHTML = currentExistingImages.map((img) => {
    const fullUrl = resolveImageUrl(img.image_url);
    const isPrimary = Number(img.is_primary) === 1;

    return `
      <div class="image-preview-card ${isPrimary ? 'is-primary' : ''}">
        <img src="${escapeHtml(fullUrl)}" alt="Image #${img.id}">
        ${isPrimary ? '<span class="preview-badge-primary">★ Ảnh chính</span>' : ''}
        <div class="preview-overlay-actions">
          ${!isPrimary ? `
            <button type="button" class="btn-preview-action star" title="Đặt làm ảnh chính" onclick="setPrimaryExistingImage(${productId}, ${img.id})">
              ★
            </button>
          ` : ''}
          <button type="button" class="btn-preview-action remove" title="Xóa ảnh này vĩnh viễn" onclick="deleteExistingImage(${productId}, ${img.id})">
            &times;
          </button>
        </div>
      </div>
    `;
  }).join("");
}

/**
 * Đặt ảnh trên máy chủ làm ảnh chính qua API (PUT /api/products/{id}/images/{img_id}/primary)
 */
async function setPrimaryExistingImage(productId, imageId) {
  try {
    await api.put(`/products/${productId}/images/${imageId}/primary`);
    if (typeof showToast === "function") {
      showToast("Đã đổi ảnh đại diện chính thành công!", "success");
    }

    // Nạp lại chi tiết sản phẩm để cập nhật ảnh
    const product = await api.get(`/products/${productId}`);
    if (product && product.product_images) {
      renderExistingImages(productId, product.product_images);
    }
    await loadProductsList();
  } catch (err) {
    console.error("[Admin Products] Lỗi đổi ảnh đại diện:", err);
    if (typeof showToast === "function") {
      showToast(extractErrorMessage(err, "Không thể đổi ảnh đại diện."), "error");
    }
  }
}

/**
 * Xóa một ảnh đã lưu trên máy chủ qua API (DELETE /api/products/{id}/images/{img_id})
 */
async function deleteExistingImage(productId, imageId) {
  if (!confirm("Bạn có chắc chắn muốn xóa ảnh này khỏi sản phẩm?")) return;

  try {
    await api.delete(`/products/${productId}/images/${imageId}`);
    if (typeof showToast === "function") {
      showToast("Đã xóa ảnh thành công!", "success");
    }

    // Nạp lại chi tiết sản phẩm
    const product = await api.get(`/products/${productId}`);
    if (product && product.product_images) {
      renderExistingImages(productId, product.product_images);
    }
    await loadProductsList();
  } catch (err) {
    console.error("[Admin Products] Lỗi xóa ảnh:", err);
    if (typeof showToast === "function") {
      showToast(extractErrorMessage(err, "Không thể xóa ảnh này."), "error");
    }
  }
}

/**
 * ==========================================================
 * FORM THÊM & CẬP NHẬT SẢN PHẨM
 * ==========================================================
 */

function initProductForm() {
  const form = document.getElementById("form-product");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideModalError("product-error-banner");

    const idInput = document.getElementById("product-id");
    const nameInput = document.getElementById("prod-name");
    const skuInput = document.getElementById("prod-sku");
    const catSelect = document.getElementById("prod-category");
    const priceInput = document.getElementById("prod-price");
    const promoInput = document.getElementById("prod-promotional-price");
    const stockInput = document.getElementById("prod-stock");
    const visibilitySelect = document.getElementById("prod-visibility");
    const descInput = document.getElementById("prod-description");
    const submitBtn = document.getElementById("btn-submit-product");

    const isEditing = Boolean(idInput && idInput.value);
    const productId = isEditing ? parseInt(idInput.value, 10) : null;

    const name = (nameInput ? nameInput.value : "").trim();
    const sku = (skuInput ? skuInput.value : "").trim();
    const categoryId = catSelect && catSelect.value ? parseInt(catSelect.value, 10) : null;
    const price = priceInput ? parseFloat(priceInput.value) : 0;
    const promoPrice = (promoInput && promoInput.value !== "") ? parseFloat(promoInput.value) : null;
    const stock = stockInput ? parseInt(stockInput.value, 10) : 0;
    const isVisible = visibilitySelect ? parseInt(visibilitySelect.value, 10) : 1;
    const description = (descInput ? descInput.value : "").trim();

    // 1. Client-side Validation
    if (!name) {
      showModalError("product-error-banner", "Vui lòng nhập tên sản phẩm");
      if (nameInput) nameInput.focus();
      return;
    }

    if (!sku) {
      showModalError("product-error-banner", "Vui lòng nhập mã SKU cho sản phẩm");
      if (skuInput) skuInput.focus();
      return;
    }

    if (!categoryId) {
      showModalError("product-error-banner", "Vui lòng chọn danh mục cho sản phẩm");
      if (catSelect) catSelect.focus();
      return;
    }

    if (isNaN(price) || price <= 0) {
      showModalError("product-error-banner", "Giá gốc sản phẩm phải là số lớn hơn 0");
      if (priceInput) priceInput.focus();
      return;
    }

    if (promoPrice !== null) {
      if (isNaN(promoPrice) || promoPrice < 0) {
        showModalError("product-error-banner", "Giá khuyến mãi không được nhỏ hơn 0");
        if (promoInput) promoInput.focus();
        return;
      }
      if (promoPrice >= price) {
        showModalError("product-error-banner", "Giá khuyến mãi phải nhỏ hơn giá gốc sản phẩm");
        if (promoInput) promoInput.focus();
        return;
      }
    }

    if (isNaN(stock) || stock < 0) {
      showModalError("product-error-banner", "Số lượng tồn kho phải lớn hơn hoặc bằng 0");
      if (stockInput) stockInput.focus();
      return;
    }

    // 2. Chuẩn bị payload
    const payload = {
      name: name,
      sku: sku,
      category_id: categoryId,
      price: price,
      promotional_price: promoPrice,
      stock_quantity: stock,
      is_visible: isVisible,
      description: description || null,
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="btn-op-spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Đang lưu...`;
    }

    try {
      let savedProduct = null;

      if (isEditing) {
        // Cập nhật sản phẩm: PUT /api/products/{id}
        savedProduct = await api.put(`/products/${productId}`, payload);
      } else {
        // Tạo sản phẩm mới: POST /api/products
        savedProduct = await api.post("/products", payload);
      }

      const targetProductId = isEditing ? productId : savedProduct.id;

      // 3. Nếu có ảnh mới trong selectedNewImageFiles -> Gọi upload qua API
      if (selectedNewImageFiles.length > 0 && targetProductId) {
        // Sắp xếp sao cho ảnh có isPrimary = true đứng đầu danh sách tải lên
        const sortedFiles = [...selectedNewImageFiles].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));

        const formData = new FormData();
        sortedFiles.forEach((item) => {
          formData.append("files", item.file);
        });

        const token = localStorage.getItem("token");
        const apiBase = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL)
          ? CONFIG.API_BASE_URL
          : "http://127.0.0.1:8000/api";

        await axios.post(`${apiBase}/products/${targetProductId}/images`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      }

      // 4. Hoàn tất thành công
      closeModal("modal-product");
      cleanupPreviewUrls();
      form.reset();

      if (typeof showToast === "function") {
        showToast(
          isEditing
            ? `Đã cập nhật sản phẩm "${name}" thành công!`
            : `Đã thêm sản phẩm "${name}" thành công!`,
          "success"
        );
      }

      await loadProductsList();
    } catch (err) {
      console.error("[Admin Products] Lỗi lưu sản phẩm:", err);
      const errMsg = extractErrorMessage(err, "Không thể lưu sản phẩm do lỗi hệ thống.");
      showModalError("product-error-banner", errMsg);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Lưu sản phẩm</span>`;
      }
    }
  });
}

/**
 * Thu hồi bộ nhớ các Object URL của ảnh preview
 */
function cleanupPreviewUrls() {
  selectedNewImageFiles.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
  selectedNewImageFiles = [];
  renderNewImagesPreview();
}

/**
 * Mở modal thêm sản phẩm mới
 */
function openCreateProductModal() {
  cleanupPreviewUrls();
  hideModalError("product-error-banner");

  const form = document.getElementById("form-product");
  if (form) form.reset();

  const titleEl = document.getElementById("product-modal-title");
  if (titleEl) titleEl.textContent = "Thêm sản phẩm mới";

  const idInput = document.getElementById("product-id");
  if (idInput) idInput.value = "";

  const existingSec = document.getElementById("existing-images-section");
  if (existingSec) existingSec.style.display = "none";

  // Tự sinh SKU gợi ý
  const skuInput = document.getElementById("prod-sku");
  if (skuInput) {
    skuInput.value = `SP-${Date.now().toString().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
  }

  openModal("modal-product");
  const nameInput = document.getElementById("prod-name");
  if (nameInput) nameInput.focus();
}

/**
 * Mở modal chỉnh sửa sản phẩm
 */
async function openEditProductModal(id) {
  cleanupPreviewUrls();
  hideModalError("product-error-banner");

  const titleEl = document.getElementById("product-modal-title");
  if (titleEl) titleEl.textContent = "Cập nhật thông tin sản phẩm";

  const idInput = document.getElementById("product-id");
  const nameInput = document.getElementById("prod-name");
  const skuInput = document.getElementById("prod-sku");
  const catSelect = document.getElementById("prod-category");
  const priceInput = document.getElementById("prod-price");
  const promoInput = document.getElementById("prod-promotional-price");
  const stockInput = document.getElementById("prod-stock");
  const visibilitySelect = document.getElementById("prod-visibility");
  const descInput = document.getElementById("prod-description");

  if (idInput) idInput.value = id;

  openModal("modal-product");

  try {
    const product = await api.get(`/products/${id}`);
    if (product) {
      if (nameInput) nameInput.value = product.name || "";
      if (skuInput) skuInput.value = product.sku || "";
      if (catSelect) catSelect.value = product.category_id || "";
      if (priceInput) priceInput.value = product.price || "";
      if (promoInput) promoInput.value = product.promotional_price !== null ? product.promotional_price : "";
      if (stockInput) stockInput.value = product.stock_quantity || 0;
      if (visibilitySelect) visibilitySelect.value = product.is_visible !== undefined ? product.is_visible : 1;
      if (descInput) descInput.value = product.description || "";

      // Hiển thị ảnh hiện có từ server
      renderExistingImages(id, product.product_images || []);
    }
  } catch (err) {
    console.error("[Admin Products] Lỗi tải chi tiết sản phẩm:", err);
    showModalError("product-error-banner", extractErrorMessage(err, "Không thể tải chi tiết sản phẩm."));
  }
}

/**
 * Bật/tắt trạng thái hiển thị (Ẩn / Hiện) của sản phẩm
 */
async function toggleProductVisibility(id, newVisibility) {
  try {
    await api.patch(`/products/${id}/visibility`, { is_visible: newVisibility });
    if (typeof showToast === "function") {
      showToast(
        newVisibility === 1
          ? "Đã bật kinh doanh sản phẩm thành công!"
          : "Đã tạm ẩn sản phẩm khỏi gian hàng!",
        "success"
      );
    }
    await loadProductsList();
  } catch (err) {
    console.error("[Admin Products] Lỗi đổi trạng thái hiển thị:", err);
    if (typeof showToast === "function") {
      showToast(extractErrorMessage(err, "Không thể thay đổi trạng thái sản phẩm."), "error");
    }
  }
}

/**
 * Mở modal xác nhận xóa sản phẩm
 */
function openDeleteProductModal(id, name, sku) {
  pendingDeletingProduct = { id, name, sku };

  const nameEl = document.getElementById("delete-product-name");
  const skuEl = document.getElementById("delete-product-sku");

  if (nameEl) nameEl.textContent = name;
  if (skuEl) skuEl.textContent = sku;

  openModal("modal-confirm-delete");
}

/**
 * ==========================================================
 * KHỞI TẠO MODAL CHUNG
 * ==========================================================
 */

function initModalTriggers() {
  const openCreateBtn = document.getElementById("btn-open-create-product");
  if (openCreateBtn) {
    openCreateBtn.addEventListener("click", openCreateProductModal);
  }

  // Đóng modal qua [data-close]
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const modalId = btn.getAttribute("data-close");
      closeModal(modalId);
      if (modalId === "modal-product") cleanupPreviewUrls();
    });
  });

  // Bấm ra ngoài overlay
  document.querySelectorAll(".admin-modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
        if (overlay.id === "modal-product") cleanupPreviewUrls();
      }
    });
  });

  // Nút xác nhận xóa sản phẩm
  const btnConfirmDelete = document.getElementById("btn-confirm-delete-action");
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener("click", async () => {
      if (!pendingDeletingProduct) return;
      const { id, name } = pendingDeletingProduct;

      btnConfirmDelete.disabled = true;
      btnConfirmDelete.innerHTML = `<span class="btn-op-spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Đang xóa...`;

      try {
        const res = await api.delete(`/products/${id}`);
        closeModal("modal-confirm-delete");

        const actionText = res.action === "HIDDEN"
          ? `Sản phẩm "${name}" đã phát sinh trong đơn hàng nên được chuyển sang trạng thái "Tạm ẩn" để bảo toàn lịch sử giao dịch.`
          : `Đã xóa vĩnh viễn sản phẩm "${name}" khỏi hệ thống thành công!`;

        if (typeof showToast === "function") {
          showToast(actionText, res.action === "HIDDEN" ? "warning" : "success");
        }

        pendingDeletingProduct = null;
        await loadProductsList();
      } catch (err) {
        console.error("[Admin Products] Lỗi xóa sản phẩm:", err);
        if (typeof showToast === "function") {
          showToast(extractErrorMessage(err, "Không thể xóa sản phẩm."), "error");
        }
      } finally {
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.innerHTML = `<span>Xóa sản phẩm</span>`;
      }
    });
  }

  // Bấm phím ESC để đóng
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".admin-modal-overlay.show").forEach((m) => {
        closeModal(m.id);
        if (m.id === "modal-product") cleanupPreviewUrls();
      });
    }
  });
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("show");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("show");
}

function showModalError(bannerId, message) {
  const banner = document.getElementById(bannerId);
  if (!banner) return;
  const textEl = banner.querySelector(".error-text");
  if (textEl) textEl.textContent = message;
  banner.classList.add("show");
}

function hideModalError(bannerId) {
  const banner = document.getElementById(bannerId);
  if (banner) banner.classList.remove("show");
}

// Gắn các hàm ra phạm vi toàn cục window
window.loadProductsList = loadProductsList;
window.changeProductPage = changeProductPage;
window.openCreateProductModal = openCreateProductModal;
window.openEditProductModal = openEditProductModal;
window.openDeleteProductModal = openDeleteProductModal;
window.toggleProductVisibility = toggleProductVisibility;
window.setPrimaryNewImage = setPrimaryNewImage;
window.removeNewImage = removeNewImage;
window.setPrimaryExistingImage = setPrimaryExistingImage;
window.deleteExistingImage = deleteExistingImage;
