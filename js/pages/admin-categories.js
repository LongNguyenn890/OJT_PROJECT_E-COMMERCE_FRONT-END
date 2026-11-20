/**
 * SHOPEASE - QUẢN LÝ DANH MỤC SẢN PHẨM (admin-categories.js)
 * Kết nối toàn diện API Backend FastAPI (/api/categories):
 *  - GET    /api/categories        : Lấy danh sách toàn bộ danh mục kèm số sản phẩm
 *  - GET    /api/categories/{id}   : Lấy chi tiết thông tin và kiểm tra số lượng sản phẩm
 *  - POST   /api/categories        : Tạo mới danh mục (kiểm tra tên duy nhất)
 *  - PUT    /api/categories/{id}   : Cập nhật thông tin danh mục
 *  - DELETE /api/categories/{id}   : Xóa danh mục (chặn nếu còn sản phẩm)
 */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Luôn đảm bảo phiên làm việc Quản trị viên hợp lệ với JWT Token
  try {
    await ensureAdminSession();
  } catch (err) {
    console.warn("[Admin Categories] Lỗi phiên quản trị:", err);
  }

  // 2. Khởi tạo các sự kiện giao diện (Modal, Bộ lọc, Form)
  initModalTriggers();
  initSearchAndFilters();
  initFormSubmissions();

  // 3. Nạp danh sách danh mục từ API
  await loadCategoriesData();
});

// Biến trạng thái toàn cục
let rawCategories = [];
let filteredCategories = [];
let currentDeletingCategory = null;
let displayedCatLimit = 10;
const pageSize = 10;

/**
 * Trích xuất câu thông báo lỗi chính xác từ ApiError hoặc AxiosError
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
      console.warn("[Categories Auth] Không thể đăng nhập phiên Quản trị:", e);
    }
  }
}

/**
 * Nạp danh sách danh mục từ Backend (GET /api/categories)
 */
async function loadCategoriesData(keyword = "") {
  const tbody = document.getElementById("cat-table-body");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
          <span class="btn-op-spinner" style="width: 20px; height: 20px; border-width: 2px; margin-bottom: 8px;"></span>
          <div>Đang đồng bộ danh mục từ cơ sở dữ liệu...</div>
        </td>
      </tr>
    `;
  }

  try {
    const params = keyword ? { keyword } : {};
    const res = await api.get("/categories", params);
    rawCategories = Array.isArray(res) ? res : (res.items || res.categories || []);
    
    // Cập nhật các thẻ KPI
    updateCategoryKpis(rawCategories);

    // Áp dụng bộ lọc và render bảng
    applyFiltersAndSort();
  } catch (error) {
    console.error("[Categories] Lỗi nạp danh mục từ API:", error);
    const errorMsg = extractErrorMessage(error, "Lỗi kết nối máy chủ API");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--admin-danger); padding: 40px 16px;">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 6px;">Không thể tải danh sách danh mục</div>
            <div style="font-size: 12.5px; color: var(--admin-text-muted); margin-bottom: 12px;">${escapeHtml(errorMsg)}</div>
            <button type="button" class="btn-admin-action secondary" onclick="loadCategoriesData()">Thử lại</button>
          </td>
        </tr>
      `;
    }
    const summaryLbl = document.getElementById("cat-summary-lbl");
    if (summaryLbl) summaryLbl.textContent = "Lỗi kết nối máy chủ";
  }
}

/**
 * Cập nhật số liệu trên 4 thẻ KPI thống kê
 */
function updateCategoryKpis(categories) {
  const totalCatEl = document.getElementById("kpi-total-categories");
  const activeCatEl = document.getElementById("kpi-active-categories");
  const emptyCatEl = document.getElementById("kpi-empty-categories");
  const totalProdEl = document.getElementById("kpi-total-products");

  const totalCategories = categories.length;
  let totalProducts = 0;
  let activeCount = 0;
  let emptyCount = 0;

  categories.forEach((cat) => {
    const count = Number(cat.product_count || 0);
    totalProducts += count;
    if (count > 0) {
      activeCount++;
    } else {
      emptyCount++;
    }
  });

  if (totalCatEl) totalCatEl.textContent = totalCategories;
  if (activeCatEl) activeCatEl.textContent = activeCount;
  if (emptyCatEl) emptyCatEl.textContent = emptyCount;
  if (totalProdEl) totalProdEl.textContent = totalProducts.toLocaleString("vi-VN");
}

/**
 * Lọc và sắp xếp danh sách danh mục theo tùy chọn của người dùng
 */
function applyFiltersAndSort() {
  const searchInput = document.getElementById("cat-search-input");
  const countFilter = document.getElementById("cat-filter-count");
  const sortSelect = document.getElementById("cat-sort-select");

  const keyword = (searchInput ? searchInput.value : "").trim().toLowerCase();
  const countMode = countFilter ? countFilter.value : "all";
  const sortMode = sortSelect ? sortSelect.value : "id_asc";

  let list = [...rawCategories];

  // 1. Lọc theo từ khóa tìm kiếm (tên, mô tả hoặc mã DM)
  if (keyword) {
    list = list.filter((cat) => {
      const name = String(cat.name || "").toLowerCase();
      const desc = String(cat.description || "").toLowerCase();
      const code = `dm-${String(cat.id).padStart(3, "0")}`.toLowerCase();
      return name.includes(keyword) || desc.includes(keyword) || code.includes(keyword);
    });
  }

  // 2. Lọc theo số lượng sản phẩm (Có sản phẩm / Trống)
  if (countMode === "has_products") {
    list = list.filter((cat) => Number(cat.product_count || 0) > 0);
  } else if (countMode === "empty") {
    list = list.filter((cat) => Number(cat.product_count || 0) === 0);
  }

  // 3. Sắp xếp danh sách
  if (sortMode === "name_asc") {
    list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "vi"));
  } else if (sortMode === "products_desc") {
    list.sort((a, b) => Number(b.product_count || 0) - Number(a.product_count || 0));
  } else if (sortMode === "products_asc") {
    list.sort((a, b) => Number(a.product_count || 0) - Number(b.product_count || 0));
  } else {
    // id_asc
    list.sort((a, b) => Number(a.id) - Number(b.id));
  }

  filteredCategories = list;
  currentPage = 1;
  renderCategoriesTable();
}

/**
 * Render bảng danh mục kèm số sản phẩm và các nút thao tác
 */
function renderCategoriesTable() {
  const tbody = document.getElementById("cat-table-body");
  const summaryLbl = document.getElementById("cat-summary-lbl");
  if (!tbody) return;

  if (filteredCategories.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px 16px; color: var(--admin-text-muted);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 8px; display: inline-block; color: #94a3b8;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <div style="font-size: 14px; font-weight: 500; color: var(--admin-text-main);">Không tìm thấy danh mục nào phù hợp</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc</div>
        </td>
      </tr>
    `;
    if (summaryLbl) summaryLbl.textContent = `0 danh mục (Tổng ${rawCategories.length})`;
    renderPagination(0);
    return;
  }

  const total = filteredCategories.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (currentPage > totalPages) currentPage = 1;
  const startIdx = (currentPage - 1) * pageSize;
  const pagedItems = filteredCategories.slice(startIdx, startIdx + pageSize);

  tbody.innerHTML = pagedItems.map((cat) => {
    const code = `DM-${String(cat.id).padStart(3, "0")}`;
    const productCount = Number(cat.product_count || 0);
    const descText = cat.description ? escapeHtml(cat.description) : `<span class="cat-desc-empty">Chưa có mô tả</span>`;
    
    // Tone màu tuần hoàn theo id để giao diện hài hòa
    const toneIdx = ((cat.id - 1) % 12) + 1;
    const toneClass = `tone-${toneIdx}`;

    // Lấy ký tự viết tắt đại diện
    const initials = getCategoryInitials(cat.name);

    // Badge số lượng sản phẩm
    const badgeProductCountHtml = productCount > 0
      ? `
        <span class="badge-prod-count has-items" title="Danh mục đang có ${productCount} sản phẩm liên kết">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${productCount} sản phẩm</span>
        </span>
      `
      : `
        <span class="badge-prod-count empty-items" title="Danh mục trống, chưa có sản phẩm nào">
          <span>0 sản phẩm</span>
        </span>
      `;

    const createdAtStr = cat.created_at
      ? new Date(cat.created_at).toLocaleDateString("vi-VN")
      : "—";

    return `
      <tr>
        <td>
          <span style="font-family: 'Liberation Mono', monospace; font-weight: 700; color: #64748b; font-size: 12.5px;">${code}</span>
        </td>
        <td>
          <div class="cat-cell-main">
            <div class="cat-avatar-circle ${toneClass}">${initials}</div>
            <span class="cat-name-text">${escapeHtml(cat.name)}</span>
          </div>
        </td>
        <td>
          <div class="cat-desc-cell" title="${escapeHtml(cat.description || '')}">${descText}</div>
        </td>
        <td style="text-align: center;">
          ${badgeProductCountHtml}
        </td>
        <td>
          <span style="color: #64748b; font-size: 12.5px;">${createdAtStr}</span>
        </td>
        <td style="text-align: center;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
            <button type="button" class="btn-cat-action edit" title="Chỉnh sửa danh mục" onclick="openEditCategoryModal(${cat.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
            <button type="button" class="btn-cat-action delete" title="Xóa danh mục" onclick="openDeleteCategoryModal(${cat.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  if (summaryLbl) {
    const startItem = total === 0 ? 0 : startIdx + 1;
    const endItem = Math.min(startIdx + pageSize, total);
    if (total === 0) {
      summaryLbl.textContent = "Hiển thị 0 danh mục";
    } else {
      summaryLbl.textContent = `Hiển thị ${startItem} - ${endItem} trong tổng số ${total} danh mục (Trang ${currentPage}/${totalPages})`;
    }
  }

  renderPagination(total);
}

/**
 * Tạo 2 ký tự viết tắt đại diện cho tên danh mục
 */
function getCategoryInitials(name) {
  if (!name) return "DM";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * Phân trang truyền thống theo số trang (Classic Pagination)
 */
function renderPagination(total) {
  const container = document.getElementById("cat-pagination");
  if (!container) return;

  const totalPages = Math.ceil(total / pageSize) || 1;
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

function changePage(p) {
  const totalPages = Math.ceil(filteredCategories.length / pageSize) || 1;
  if (p < 1 || p > totalPages || p === currentPage) return;
  currentPage = p;
  renderCategoriesTable();
  window.scrollTo({ top: 120, behavior: "smooth" });
}

/**
 * Khởi tạo sự kiện tìm kiếm và lọc danh mục
 */
function initSearchAndFilters() {
  const searchInput = document.getElementById("cat-search-input");
  const countFilter = document.getElementById("cat-filter-count");
  const sortSelect = document.getElementById("cat-sort-select");
  const resetBtn = document.getElementById("btn-reset-filters");
  const refreshBtn = document.getElementById("btn-refresh-categories");

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        applyFiltersAndSort();
      }, 250);
    });
  }

  if (countFilter) {
    countFilter.addEventListener("change", () => {
      applyFiltersAndSort();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      applyFiltersAndSort();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (countFilter) countFilter.value = "all";
      if (sortSelect) sortSelect.value = "id_asc";
      applyFiltersAndSort();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      const icon = refreshBtn.querySelector("svg");
      if (icon) icon.style.animation = "spin-refresh-anim 0.75s linear infinite";
      await loadCategoriesData();
      if (icon) icon.style.animation = "";
      refreshBtn.disabled = false;
      if (typeof showToast === "function") {
        showToast("Đã đồng bộ lại danh sách danh mục mới nhất!", "info");
      }
    });
  }
}

/**
 * Khởi tạo đóng / mở Modal
 */
function initModalTriggers() {
  // Nút mở modal Thêm mới
  const openCreateBtn = document.getElementById("btn-open-create-category");
  if (openCreateBtn) {
    openCreateBtn.addEventListener("click", () => {
      openModal("modal-create-category");
      hideModalError("create-cat-error-banner");
      const nameInput = document.getElementById("create-cat-name");
      if (nameInput) {
        nameInput.value = "";
        nameInput.focus();
      }
      const descInput = document.getElementById("create-cat-desc");
      if (descInput) descInput.value = "";
    });
  }

  // Nút đóng modal chung [data-close]
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const modalId = btn.getAttribute("data-close");
      closeModal(modalId);
    });
  });

  // Đóng modal khi bấm ra ngoài vùng box
  document.querySelectorAll(".admin-modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Đóng khi bấm ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".admin-modal-overlay.show").forEach((m) => {
        closeModal(m.id);
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

/**
 * Khởi tạo xử lý Form Thêm mới và Chỉnh sửa qua API
 */
function initFormSubmissions() {
  // 1. Submit Tạo danh mục mới (POST /api/categories)
  const formCreate = document.getElementById("form-create-category");
  if (formCreate) {
    formCreate.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideModalError("create-cat-error-banner");

      const nameInput = document.getElementById("create-cat-name");
      const descInput = document.getElementById("create-cat-desc");
      const submitBtn = document.getElementById("btn-submit-create-category");

      const name = (nameInput ? nameInput.value : "").trim();
      const description = (descInput ? descInput.value : "").trim();

      if (!name) {
        showModalError("create-cat-error-banner", "Vui lòng nhập tên danh mục sản phẩm");
        if (nameInput) nameInput.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="btn-op-spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Đang thêm...`;
      }

      try {
        await api.post("/categories", { name, description: description || null });
        closeModal("modal-create-category");
        formCreate.reset();

        if (typeof showToast === "function") {
          showToast(`Đã thêm danh mục "${name}" thành công!`, "success");
        }

        await loadCategoriesData();
      } catch (err) {
        console.error("[Categories] Lỗi tạo danh mục qua API:", err);
        const errMsg = extractErrorMessage(err, "Không thể thêm danh mục do lỗi hệ thống.");
        showModalError("create-cat-error-banner", errMsg);
        if (nameInput) nameInput.focus();
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Thêm danh mục</span>`;
        }
      }
    });
  }

  // 2. Submit Cập nhật danh mục (PUT /api/categories/{id})
  const formEdit = document.getElementById("form-edit-category");
  if (formEdit) {
    formEdit.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideModalError("edit-cat-error-banner");

      const idInput = document.getElementById("edit-cat-id");
      const nameInput = document.getElementById("edit-cat-name");
      const descInput = document.getElementById("edit-cat-desc");
      const submitBtn = document.getElementById("btn-submit-edit-category");

      const categoryId = idInput ? parseInt(idInput.value, 10) : null;
      const name = (nameInput ? nameInput.value : "").trim();
      const description = (descInput ? descInput.value : "").trim();

      if (!categoryId) return;
      if (!name) {
        showModalError("edit-cat-error-banner", "Tên danh mục không được để trống");
        if (nameInput) nameInput.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="btn-op-spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Đang lưu...`;
      }

      try {
        await api.put(`/categories/${categoryId}`, { name, description: description || null });
        closeModal("modal-edit-category");

        if (typeof showToast === "function") {
          showToast(`Đã cập nhật danh mục "${name}" thành công!`, "success");
        }

        await loadCategoriesData();
      } catch (err) {
        console.error("[Categories] Lỗi cập nhật danh mục qua API:", err);
        const errMsg = extractErrorMessage(err, "Không thể cập nhật danh mục do lỗi hệ thống.");
        showModalError("edit-cat-error-banner", errMsg);
        if (nameInput) nameInput.focus();
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Lưu thay đổi</span>`;
        }
      }
    });
  }

  // 3. Submit Xác nhận Xóa danh mục (DELETE /api/categories/{id})
  const btnConfirmDelete = document.getElementById("btn-confirm-delete-category");
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener("click", async () => {
      if (!currentDeletingCategory) return;
      hideModalError("delete-cat-error-banner");

      const { id, name, product_count } = currentDeletingCategory;

      // Kiểm tra ràng buộc phía client trước
      if (product_count > 0) {
        const errorMsg = `Không thể xóa danh mục '${name}' vì vẫn còn ${product_count} sản phẩm thuộc danh mục này. Vui lòng chuyển hoặc xóa sản phẩm trước.`;
        showModalError("delete-cat-error-banner", errorMsg);
        if (typeof showToast === "function") {
          showToast(errorMsg, "error");
        }
        return;
      }

      btnConfirmDelete.disabled = true;
      btnConfirmDelete.innerHTML = `<span class="btn-op-spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Đang xóa...`;

      try {
        await api.delete(`/categories/${id}`);
        closeModal("modal-confirm-delete-category");

        if (typeof showToast === "function") {
          showToast(`Đã xóa danh mục "${name}" thành công!`, "success");
        }

        currentDeletingCategory = null;
        await loadCategoriesData();
      } catch (err) {
        console.error("[Categories] Lỗi xóa danh mục qua API:", err);
        const errMsg = extractErrorMessage(err, "Không thể xóa danh mục này.");
        showModalError("delete-cat-error-banner", errMsg);
        if (typeof showToast === "function") {
          showToast(errMsg, "error");
        }
      } finally {
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.innerHTML = `<span>Xóa danh mục</span>`;
      }
    });
  }
}

/**
 * Mở modal chỉnh sửa danh mục và đồng bộ dữ liệu mới nhất từ API (GET /api/categories/{id})
 */
async function openEditCategoryModal(id) {
  let category = rawCategories.find((c) => Number(c.id) === Number(id));

  hideModalError("edit-cat-error-banner");

  const idInput = document.getElementById("edit-cat-id");
  const nameInput = document.getElementById("edit-cat-name");
  const descInput = document.getElementById("edit-cat-desc");
  const prodCountEl = document.getElementById("edit-cat-product-count");

  // Điền dữ liệu từ danh sách đã nạp
  if (category) {
    if (idInput) idInput.value = category.id;
    if (nameInput) nameInput.value = category.name || "";
    if (descInput) descInput.value = category.description || "";
    if (prodCountEl) prodCountEl.textContent = `${category.product_count || 0} sản phẩm`;
  }

  openModal("modal-edit-category");
  if (nameInput) nameInput.focus();

  // Gọi API GET /categories/{id} để nạp dữ liệu chuẩn xác nhất từ server
  try {
    const detail = await api.get(`/categories/${id}`);
    if (detail) {
      if (idInput) idInput.value = detail.id;
      if (nameInput) nameInput.value = detail.name || "";
      if (descInput) descInput.value = detail.description || "";
      if (prodCountEl) prodCountEl.textContent = `${detail.product_count || 0} sản phẩm`;
    }
  } catch (err) {
    console.warn("[Categories] Không thể nạp chi tiết từ API:", err);
  }
}

/**
 * Mở modal xác nhận xóa danh mục kèm kiểm tra ràng buộc sản phẩm qua API
 */
async function openDeleteCategoryModal(id) {
  let category = rawCategories.find((c) => Number(c.id) === Number(id));
  if (!category) return;

  currentDeletingCategory = category;
  hideModalError("delete-cat-error-banner");

  const catNameEl = document.getElementById("delete-modal-cat-name");
  const catIdLbl = document.getElementById("delete-modal-cat-id-lbl");
  const prodCountLbl = document.getElementById("delete-modal-product-count");
  const warningBox = document.getElementById("delete-box-has-products");
  const safeBox = document.getElementById("delete-box-no-products");
  const btnConfirm = document.getElementById("btn-confirm-delete-category");

  function updateDeleteModalUI(cat) {
    const productCount = Number(cat.product_count || 0);

    if (catNameEl) catNameEl.textContent = cat.name;
    if (catIdLbl) catIdLbl.textContent = `DM-${String(cat.id).padStart(3, "0")} (#${cat.id})`;
    if (prodCountLbl) prodCountLbl.textContent = productCount;

    if (productCount > 0) {
      if (warningBox) warningBox.style.display = "flex";
      if (safeBox) safeBox.style.display = "none";

      if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.title = `Không thể xóa vì còn ${productCount} sản phẩm`;
        btnConfirm.innerHTML = `<span>Không thể xóa</span>`;
        btnConfirm.style.opacity = "0.6";
        btnConfirm.style.cursor = "not-allowed";
      }
    } else {
      if (warningBox) warningBox.style.display = "none";
      if (safeBox) safeBox.style.display = "flex";

      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.title = "Xác nhận xóa danh mục này";
        btnConfirm.innerHTML = `<span>Xóa danh mục</span>`;
        btnConfirm.style.opacity = "1";
        btnConfirm.style.cursor = "pointer";
      }
    }
  }

  updateDeleteModalUI(category);
  openModal("modal-confirm-delete-category");

  // Kiểm tra số lượng sản phẩm mới nhất từ server qua GET /categories/{id}
  try {
    const freshCat = await api.get(`/categories/${id}`);
    if (freshCat) {
      currentDeletingCategory = freshCat;
      updateDeleteModalUI(freshCat);
    }
  } catch (err) {
    console.warn("[Categories] Không thể nạp lại thông tin danh mục từ API:", err);
  }
}

// Gắn các hàm gọi từ thuộc tính onclick của HTML ra phạm vi toàn cục window
window.loadCategoriesData = loadCategoriesData;
window.changePage = changePage;
window.openEditCategoryModal = openEditCategoryModal;
window.openDeleteCategoryModal = openDeleteCategoryModal;
