/**
 * ShopEase - Quản lý Nhân sự & Phân quyền (Admin Staff Management)
 * Xử lý toàn bộ logic cho trang admin-staff.html:
 *  - GET    /api/staff                     : Danh sách nhân viên & quản trị viên
 *  - POST   /api/staff                     : Tạo mới tài khoản nhân viên
 *  - GET    /api/staff/{id}                : Xem chi tiết thông tin hồ sơ nhân viên
 *  - PUT    /api/staff/{id}                : Chỉnh sửa thông tin, phân quyền, đổi mật khẩu
 *  - PATCH  /api/staff/{id}/status         : Khóa hoặc mở khóa tài khoản
 *  - DELETE /api/staff/{id}                : Xóa tài khoản nhân viên
 */

// Bộ lọc & phân trang
let currentPage = 1;
const pageSize = 10;
let totalItems = 0;
let currentSearchKeyword = "";
let currentRoleFilter = "";
let currentStatusFilter = "";

// Biến tạm modal xác nhận
let pendingStatusAction = null; // { id, name, newStatus }
let pendingDeleteAction = null; // { id, name, email }

document.addEventListener("DOMContentLoaded", async () => {
  // 0. Kiểm tra phân quyền ADMIN ngay khi khởi động
  const localUser = JSON.parse(localStorage.getItem("user") || "null");
  const localRole = (localUser && localUser.role ? String(localUser.role) : "").toUpperCase();
  if (localUser && localRole && localRole !== "ADMIN") {
    sessionStorage.setItem("pending_toast", JSON.stringify({
      message: "Truy cập bị từ chối! Bạn không có quyền truy cập trang Quản lý nhân viên. Chỉ Quản trị viên (ADMIN) mới có quyền truy cập.",
      type: "error"
    }));
    window.location.replace("admin-dashboard.html");
    return;
  }

  try {
    initModals();
    initFilters();
    initForms();
  } catch (err) {
    console.warn("[Admin Staff] Lỗi khởi tạo sự kiện UI:", err);
  }

  try {
    await ensureAdminSession();
  } catch (err) {
    console.warn("[Admin Staff] Lỗi phiên quản trị:", err);
  }

  try {
    await loadStaffKpis();
  } catch (err) {
    console.warn("[Admin Staff] Lỗi tải số liệu KPIs:", err);
  }

  try {
    await loadStaffList();
  } catch (err) {
    console.error("[Admin Staff] Lỗi tải danh sách nhân sự:", err);
  }
});

/**
 * Đảm bảo luôn có token JWT hợp lệ với quyền ADMIN / STAFF
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
      if (roleStr !== "ADMIN") {
        sessionStorage.setItem("pending_toast", JSON.stringify({
          message: "Truy cập bị từ chối! Bạn không có quyền truy cập trang Quản lý nhân viên. Chỉ Quản trị viên (ADMIN) mới có quyền truy cập.",
          type: "error"
        }));
        window.location.replace("admin-dashboard.html");
        return;
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
      console.warn("[Admin Staff] Không thể đăng nhập tự động:", e);
    }
  }
}

/**
 * Tải số liệu thống kê KPIs nhân sự (loại trừ tài khoản đang đăng nhập)
 */
async function loadStaffKpis() {
  try {
    const res = await api.get("/staff", {
      role: "INTERNAL",
      exclude_self: true,
      page_size: 100
    });

    const items = res?.items || [];
    const totalStaff = res?.total !== undefined ? res.total : items.length;
    const activeStaff = items.filter((s) => normalizeStatus(s.status) === "ACTIVE").length;
    const lockedStaff = items.filter((s) => normalizeStatus(s.status) === "LOCKED").length;
    const adminCount = items.filter((s) => {
      const r = String(s.role?.name || s.role || "").toUpperCase();
      return r === "ADMIN";
    }).length;

    const elTotal = document.getElementById("kpi-total-staff");
    const elActive = document.getElementById("kpi-active-staff");
    const elLocked = document.getElementById("kpi-locked-staff");
    const elAdmin = document.getElementById("kpi-admin-count");

    if (elTotal) elTotal.textContent = totalStaff;
    if (elActive) elActive.textContent = activeStaff;
    if (elLocked) elLocked.textContent = lockedStaff;
    if (elAdmin) elAdmin.textContent = adminCount;
  } catch (e) {
    console.error("[Admin Staff] Lỗi tải KPIs:", e);
  }
}

/**
 * Tải danh sách nhân viên theo bộ lọc (không hiển thị tài khoản của chính mình)
 */
async function loadStaffList() {
  const tbody = document.getElementById("staff-table-body");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
        <span class="btn-op-spinner" style="width: 20px; height: 20px; border-width: 2px; margin-bottom: 8px;"></span>
        <div>Đang đồng bộ danh sách nhân viên...</div>
      </td>
    </tr>
  `;

  try {
    const params = {
      role: currentRoleFilter || "INTERNAL",
      exclude_self: true,
      page: currentPage,
      page_size: pageSize,
    };

    if (currentSearchKeyword.trim()) {
      params.keyword = currentSearchKeyword.trim();
    }
    if (currentStatusFilter) {
      params.status = currentStatusFilter;
    }

    const res = await api.get("/staff", params);
    const items = res?.items || [];
    totalItems = res?.total !== undefined ? res.total : items.length;

    renderStaffTable(items);
    renderPagination();

    const summaryLbl = document.getElementById("staff-summary-lbl");
    if (summaryLbl) {
      const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
      const endItem = Math.min(currentPage * pageSize, totalItems);
      const totalPages = Math.ceil(totalItems / pageSize) || 1;
      if (totalItems === 0) {
        summaryLbl.textContent = "Hiển thị 0 nhân sự";
      } else {
        summaryLbl.textContent = `Hiển thị ${startItem} - ${endItem} trong tổng số ${totalItems} nhân sự (Trang ${currentPage}/${totalPages})`;
      }
    }
  } catch (e) {
    console.error("[Admin Staff] Lỗi tải danh sách nhân viên:", e);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: #dc2626;">
          <div>Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại.</div>
          <button type="button" class="btn-admin-action secondary" onclick="loadStaffList()" style="margin-top: 10px;">Thử lại</button>
        </td>
      </tr>
    `;
  }
}

/**
 * Render bảng danh sách nhân viên
 */
function renderStaffTable(items) {
  const tbody = document.getElementById("staff-table-body");
  if (!tbody) return;

  // Loại trừ tài khoản của chính Quản trị viên đang đăng nhập
  const curUserId = getCurrentAdminId();
  const curEmail = getCurrentAdminEmail();
  const displayItems = (items || []).filter((s) => {
    if (curUserId && s.id === curUserId) return false;
    if (curEmail && s.email && s.email.toLowerCase() === curEmail.toLowerCase()) return false;
    return true;
  });

  if (!displayItems || displayItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 48px; color: var(--admin-text-muted);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; color: #94a3b8;"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          <div>Không có nhân viên nào khác trong danh sách quản lý</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = displayItems.map((staff) => {
    const id = staff.id;
    const name = staff.full_name || "Chưa đặt tên";
    const email = staff.email || "";
    const phone = staff.phone || "---";
    const roleStr = String(staff.role?.name || staff.role || "STAFF").toUpperCase();
    const statusStr = normalizeStatus(staff.status);
    const isLocked = statusStr === "LOCKED";
    const initials = getInitials(name);
    const codeDisplay = `NV-${String(id).padStart(4, "0")}`;

    // Avatar styling
    const avatarClass = roleStr === "ADMIN" ? "user-avatar-circle admin-avatar" : "user-avatar-circle";

    // Role badge
    const roleBadgeHtml = roleStr === "ADMIN"
      ? `<span class="badge-role admin"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Quản trị viên</span>`
      : `<span class="badge-role staff"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> Nhân viên vận hành</span>`;

    // Status pill
    const statusPillHtml = isLocked
      ? `<span class="badge-status-pill locked"><span style="width: 6px; height: 6px; border-radius: 50%; background-color: #dc2626;"></span> Đã khóa</span>`
      : `<span class="badge-status-pill active"><span style="width: 6px; height: 6px; border-radius: 50%; background-color: #10b981;"></span> Hoạt động</span>`;

    // Action buttons
    const viewBtn = `
      <button type="button" class="btn-user-action view" title="Xem chi tiết nhân viên" onclick="openStaffDetailModal(${id})">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    `;

    const lockActionBtn = isLocked
      ? `
        <button type="button" class="btn-user-action unlock" title="Mở khóa tài khoản" onclick="openConfirmStatusModal(${id}, '${escapeHtml(name)}', 'ACTIVE')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
        </button>
      `
      : `
        <button type="button" class="btn-user-action lock" title="Khóa tài khoản" onclick="openConfirmStatusModal(${id}, '${escapeHtml(name)}', 'LOCKED')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </button>
      `;

    const editBtn = `
      <button type="button" class="btn-user-action edit" title="Chỉnh sửa thông tin" onclick="openEditStaffModal(${id}, '${escapeHtml(name)}', '${escapeHtml(email)}', '${escapeHtml(phone)}', '${roleStr}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
    `;

    const deleteBtn = `
      <button type="button" class="btn-user-action delete" title="Xóa tài khoản" onclick="openConfirmDeleteModal(${id}, '${escapeHtml(name)}', '${escapeHtml(email)}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
    `;

    return `
      <tr>
        <td><strong style="color: var(--admin-primary-dark); font-size: 12px;">${codeDisplay}</strong></td>
        <td>
          <div class="user-avatar-cell">
            <div class="${avatarClass}">${initials}</div>
            <div>
              <div class="user-meta-name">${escapeHtml(name)}</div>
              <div class="user-meta-sub">ID: #${id}</div>
            </div>
          </div>
        </td>
        <td><span style="color: var(--admin-text-main); font-size: 13px;">${escapeHtml(email)}</span></td>
        <td><span style="font-size: 12.5px; color: var(--admin-text-main);">${escapeHtml(phone)}</span></td>
        <td>${roleBadgeHtml}</td>
        <td>${statusPillHtml}</td>
        <td style="text-align: center;">
          <div class="user-actions-row">
            ${viewBtn}
            ${editBtn}
            ${lockActionBtn}
            ${deleteBtn}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/**
 * Phân trang truyền thống theo số trang (Classic Pagination)
 */
function renderPagination(total = totalItems) {
  const container = document.getElementById("staff-pagination");
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

async function changePage(p) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  if (p < 1 || p > totalPages || p === currentPage) return;
  currentPage = p;
  await loadStaffList();
  window.scrollTo({ top: 120, behavior: "smooth" });
}
window.changePage = changePage;

/**
 * Khởi tạo Bộ lọc & Tìm kiếm
 */
function initFilters() {
  const keywordInput = document.getElementById("filter-keyword");
  let timer = null;

  if (keywordInput) {
    keywordInput.addEventListener("input", (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        currentSearchKeyword = e.target.value;
        currentPage = 1;
        loadStaffList();
      }, 300);
    });
  }

  const roleSelect = document.getElementById("filter-role");
  if (roleSelect) {
    roleSelect.addEventListener("change", (e) => {
      currentRoleFilter = e.target.value;
      currentPage = 1;
      loadStaffList();
    });
  }

  const statusSelect = document.getElementById("filter-status");
  if (statusSelect) {
    statusSelect.addEventListener("change", (e) => {
      currentStatusFilter = e.target.value;
      currentPage = 1;
      loadStaffList();
    });
  }

  const btnRefresh = document.getElementById("btn-refresh-list");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      loadStaffKpis();
      loadStaffList();
    });
  }
}

/**
 * Khởi tạo Modals và sự kiện đóng mở
 */
function initModals() {
  // Mở modal tạo nhân viên mới
  const btnOpenCreate = document.getElementById("btn-open-create-staff");
  if (btnOpenCreate) {
    btnOpenCreate.addEventListener("click", () => {
      document.getElementById("form-create-staff").reset();
      openModal("modal-create-staff");
    });
  }

  // Đóng modals qua nút data-close
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal(btn.dataset.close);
    });
  });

  // Đóng modal khi bấm ra ngoài hộp thoại
  document.querySelectorAll(".admin-modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Nút xác nhận Khóa / Mở khóa
  const btnConfirmStatus = document.getElementById("btn-confirm-status-action");
  if (btnConfirmStatus) {
    btnConfirmStatus.addEventListener("click", executeConfirmStatusAction);
  }

  // Nút xác nhận Xóa tài khoản
  const btnConfirmDelete = document.getElementById("btn-confirm-delete-action");
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener("click", executeConfirmDeleteAction);
  }
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("show");
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("show");
}

/**
 * Xử lý Forms: Tạo & Sửa nhân viên
 */
function initForms() {
  // Form tạo nhân viên
  const formCreate = document.getElementById("form-create-staff");
  if (formCreate) {
    formCreate.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-submit-create-staff");
      const fullName = document.getElementById("staff-fullname").value.trim();
      const email = document.getElementById("staff-email").value.trim();
      const phone = document.getElementById("staff-phone").value.trim();
      const password = document.getElementById("staff-password").value.trim();
      const role = document.getElementById("staff-role").value;

      if (!fullName || !email || !phone || !password) {
        showToast("Vui lòng điền đầy đủ các thông tin bắt buộc!", "error");
        return;
      }

      if (password.length < 6) {
        showToast("Mật khẩu khởi tạo phải có tối thiểu 6 ký tự!", "error");
        return;
      }

      try {
        btn.disabled = true;
        btn.innerHTML = `<span class="btn-op-spinner"></span> <span>Đang tạo...</span>`;

        await api.post("/staff", {
          full_name: fullName,
          email: email,
          phone: phone,
          password: password,
          role: role,
        });

        showToast(`Đã tạo tài khoản nhân viên "${fullName}" thành công!`, "success");
        closeModal("modal-create-staff");
        formCreate.reset();
        await loadStaffKpis();
        await loadStaffList();
      } catch (err) {
        console.error("[Admin Staff] Lỗi tạo nhân viên:", err);
        const errMsg = err?.response?.data?.detail || "Không thể tạo tài khoản nhân viên. Vui lòng kiểm tra lại email.";
        showToast(errMsg, "error");
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Tạo tài khoản</span>`;
      }
    });
  }

  // Form cập nhật nhân viên
  const formEdit = document.getElementById("form-edit-staff");
  if (formEdit) {
    formEdit.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-submit-edit-staff");
      const id = document.getElementById("edit-staff-id").value;
      const fullName = document.getElementById("edit-staff-fullname").value.trim();
      const phone = document.getElementById("edit-staff-phone").value.trim();
      const role = document.getElementById("edit-staff-role").value;
      const newPass = document.getElementById("edit-staff-newpass").value.trim();

      if (!fullName) {
        showToast("Họ và tên nhân viên không được để trống!", "error");
        return;
      }

      const payload = {
        full_name: fullName,
        phone: phone || null,
        role: role,
      };
      if (newPass) {
        if (newPass.length < 6) {
          showToast("Mật khẩu mới phải có tối thiểu 6 ký tự!", "error");
          return;
        }
        payload.password = newPass;
      }

      try {
        btn.disabled = true;
        btn.innerHTML = `<span class="btn-op-spinner"></span> <span>Đang lưu...</span>`;

        await api.put(`/staff/${id}`, payload);

        showToast(`Đã cập nhật thông tin nhân viên "${fullName}" thành công!`, "success");
        closeModal("modal-edit-staff");
        await loadStaffKpis();
        await loadStaffList();
      } catch (err) {
        console.error("[Admin Staff] Lỗi cập nhật nhân viên:", err);
        const errMsg = err?.response?.data?.detail || "Không thể cập nhật nhân viên.";
        showToast(errMsg, "error");
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Lưu thay đổi</span>`;
      }
    });
  }
}

/**
 * Mở modal xem chi tiết thông tin & hồ sơ nhân viên
 */
window.openStaffDetailModal = async function (id) {
  const content = document.getElementById("staff-detail-content");
  if (!content) return;

  content.innerHTML = `
    <div style="text-align: center; padding: 36px 16px; color: var(--admin-text-muted);">
      <span class="btn-op-spinner" style="width: 22px; height: 22px; border-width: 2.5px; margin-bottom: 10px;"></span>
      <div style="font-size: 13px;">Đang tải hồ sơ nhân viên...</div>
    </div>
  `;

  const btnEditShortcut = document.getElementById("btn-detail-edit-shortcut");
  if (btnEditShortcut) btnEditShortcut.style.display = "none";

  openModal("modal-staff-detail");

  try {
    const data = await api.get(`/staff/${id}`);
    const name = data.full_name || "Chưa đặt tên";
    const email = data.email || "---";
    const phone = data.phone || "---";
    const roleStr = String(data.role?.name || data.role || "STAFF").toUpperCase();
    const statusStr = normalizeStatus(data.status);
    const isLocked = statusStr === "LOCKED";
    const isAdmin = roleStr === "ADMIN";
    const initials = getInitials(name);
    const codeDisplay = `NV-${String(id).padStart(4, "0")}`;
    const createdAtStr = data.created_at ? formatDateTime(data.created_at) : "---";

    // Gán hành động cho nút Sửa nhanh từ modal Chi tiết
    if (btnEditShortcut) {
      btnEditShortcut.style.display = "inline-flex";
      btnEditShortcut.onclick = () => {
        closeModal("modal-staff-detail");
        openEditStaffModal(id, name, email, phone, roleStr);
      };
    }

    const avatarClass = isAdmin ? "user-avatar-circle admin-avatar" : "user-avatar-circle";

    const roleBadgeHtml = isAdmin
      ? `<span class="badge-role admin" style="font-size: 12px; padding: 4px 10px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Quản trị viên hệ thống (ADMIN)</span>`
      : `<span class="badge-role staff" style="font-size: 12px; padding: 4px 10px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> Nhân viên vận hành (STAFF)</span>`;

    const statusBadgeHtml = isLocked
      ? `<span class="badge-status-pill locked" style="font-size: 12px; padding: 4px 10px;"><span style="width: 7px; height: 7px; border-radius: 50%; background-color: #dc2626;"></span> Tài khoản Đã khóa</span>`
      : `<span class="badge-status-pill active" style="font-size: 12px; padding: 4px 10px;"><span style="width: 7px; height: 7px; border-radius: 50%; background-color: #10b981;"></span> Đang hoạt động</span>`;

    // Quyền hạn hiển thị theo vai trò
    const permissionsHtml = isAdmin
      ? `
        <div style="background: #faf5ff; border: 1px solid #f3e8ff; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 12.5px; font-weight: 700; color: #7e22ce; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>Quyền hạn Quản trị viên cấp cao (ADMIN)</span>
          </div>
          <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #581c87; line-height: 1.6;">
            <li>Toàn quyền quản trị hệ thống, thêm/sửa/khóa/xóa tài khoản nhân sự.</li>
            <li>Quản trị danh mục, sản phẩm, quản lý kho hàng và cập nhật đơn giá.</li>
            <li>Tiếp nhận, duyệt đơn, xác nhận chuyển khoản ngân hàng và điều phối vận chuyển.</li>
            <li>Xem báo cáo tài chính, biểu đồ doanh thu và phân tích hiệu suất kinh doanh.</li>
          </ul>
        </div>
      `
      : `
        <div style="background: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 12.5px; font-weight: 700; color: #0369a1; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
            <span>Quyền hạn Nhân viên vận hành (STAFF)</span>
          </div>
          <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #0c4a6e; line-height: 1.6;">
            <li>Quản lý danh mục & danh sách sản phẩm (thêm, cập nhật hình ảnh, mô tả).</li>
            <li>Xử lý và vận hành đơn hàng (duyệt đơn, chuyển giao hàng, xác nhận hoàn thành).</li>
            <li>Tra cứu hồ sơ khách hàng, hỗ trợ giải đáp khiếu nại và đơn hàng.</li>
            <li><em>Giới hạn:</em> Không có quyền xóa tài khoản hoặc can thiệp cấu hình hệ thống.</li>
          </ul>
        </div>
      `;

    // Sổ địa chỉ nếu có
    const addresses = data.addresses || [];
    let addressHtml = `<div style="color: var(--admin-text-muted); font-size: 12.5px; font-style: italic;">Chưa thiết lập sổ địa chỉ</div>`;
    if (addresses.length > 0) {
      addressHtml = addresses.map((a) => {
        const fullAddr = a.address || [a.street_detail, a.ward, a.province].filter(Boolean).join(", ");
        return `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; font-size: 12.5px;">
            <div><strong>${escapeHtml(a.receiver_name || name)}</strong> - ${escapeHtml(a.phone || phone)} ${a.is_default ? '<span style="font-size: 10px; color: #10b981; font-weight: 600; margin-left: 6px;">[Mặc định]</span>' : ''}</div>
            <div style="color: #475569; margin-top: 2px;">${escapeHtml(fullAddr || "Chưa có địa chỉ chi tiết")}</div>
          </div>
        `;
      }).join("");
    }

    content.innerHTML = `
      <!-- Header Hồ sơ Nhân viên -->
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--admin-border);">
        <div class="${avatarClass}" style="width: 54px; height: 54px; font-size: 18px;">${initials}</div>
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: var(--admin-text-main);">${escapeHtml(name)}</h3>
            <span style="font-size: 12px; font-weight: 700; color: var(--admin-primary-dark); background: #eff6ff; padding: 2px 8px; border-radius: 4px; border: 1px solid #bfdbfe;">${codeDisplay}</span>
          </div>
          <div style="font-size: 12.5px; color: var(--admin-text-muted); margin-top: 4px;">
            ${escapeHtml(email)} · ID người dùng: #${id}
          </div>
        </div>
        <div>
          ${statusBadgeHtml}
        </div>
      </div>

      <!-- Quick KPI 3 cột -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: #f8fafc; border: 1px solid var(--admin-border); border-radius: 8px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 11.5px; color: var(--admin-text-muted); font-weight: 600; text-transform: uppercase;">Vai trò tài khoản</div>
          <div style="margin-top: 6px;">${roleBadgeHtml}</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--admin-border); border-radius: 8px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 11.5px; color: var(--admin-text-muted); font-weight: 600; text-transform: uppercase;">Số điện thoại</div>
          <div style="font-size: 13.5px; font-weight: 700; color: var(--admin-text-main); margin-top: 6px;">${escapeHtml(phone)}</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--admin-border); border-radius: 8px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 11.5px; color: var(--admin-text-muted); font-weight: 600; text-transform: uppercase;">Ngày tham gia</div>
          <div style="font-size: 13px; font-weight: 600; color: var(--admin-text-main); margin-top: 6px;">${escapeHtml(createdAtStr)}</div>
        </div>
      </div>

      <!-- Chi tiết thông tin tài khoản -->
      <div style="background: #ffffff; border: 1px solid var(--admin-border); border-radius: 10px; padding: 14px 16px; margin-bottom: 18px;">
        <div style="font-size: 13px; font-weight: 700; color: var(--admin-text-main); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.3px; display: flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Thông tin cá nhân & Liên hệ</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
          <div>
            <span style="color: var(--admin-text-muted); font-size: 12px;">Họ và tên:</span>
            <div style="font-weight: 600; color: var(--admin-text-main);">${escapeHtml(name)}</div>
          </div>
          <div>
            <span style="color: var(--admin-text-muted); font-size: 12px;">Email đăng nhập:</span>
            <div style="font-weight: 600; color: var(--admin-text-main);">${escapeHtml(email)}</div>
          </div>
          <div>
            <span style="color: var(--admin-text-muted); font-size: 12px;">Số điện thoại:</span>
            <div style="font-weight: 600; color: var(--admin-text-main);">${escapeHtml(phone)}</div>
          </div>
          <div>
            <span style="color: var(--admin-text-muted); font-size: 12px;">Mã nhân viên nội bộ:</span>
            <div style="font-weight: 700; color: var(--admin-primary-dark);">${codeDisplay}</div>
          </div>
        </div>
      </div>

      <!-- Quyền hạn hệ thống -->
      <div style="margin-bottom: 18px;">
        <div style="font-size: 13px; font-weight: 700; color: var(--admin-text-main); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.3px; display: flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Phạm vi quyền hạn trong hệ thống</span>
        </div>
        ${permissionsHtml}
      </div>

      <!-- Sổ địa chỉ -->
      <div>
        <div style="font-size: 13px; font-weight: 700; color: var(--admin-text-main); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.3px; display: flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>Địa chỉ thường trú / liên hệ</span>
        </div>
        ${addressHtml}
      </div>
    `;

  } catch (err) {
    console.error("[Admin Staff] Lỗi tải chi tiết nhân viên:", err);
    content.innerHTML = `
      <div style="text-align: center; color: #dc2626; padding: 28px 16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 8px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div style="font-weight: 600;">Không thể tải chi tiết nhân sự</div>
        <div style="font-size: 12px; color: var(--admin-text-muted); margin-top: 4px;">${escapeHtml(err.message || "Vui lòng thử lại sau.")}</div>
      </div>
    `;
  }
};

/**
 * Mở modal chỉnh sửa thông tin nhân viên
 */
window.openEditStaffModal = function (id, name, email, phone, role) {
  document.getElementById("edit-staff-id").value = id;
  document.getElementById("edit-staff-fullname").value = name;
  document.getElementById("edit-staff-email").value = email;
  document.getElementById("edit-staff-phone").value = phone === "---" ? "" : phone;
  document.getElementById("edit-staff-role").value = role === "ADMIN" ? "ADMIN" : "STAFF";
  document.getElementById("edit-staff-newpass").value = "";
  openModal("modal-edit-staff");
};

/**
 * Mở modal xác nhận Khóa / Mở khóa
 */
window.openConfirmStatusModal = function (id, name, newStatus) {
  pendingStatusAction = { id, name, newStatus };
  const isLocking = newStatus === "LOCKED";
  const titleEl = document.getElementById("status-modal-title");
  const iconBox = document.getElementById("status-modal-icon-box");
  const descEl = document.getElementById("status-modal-desc");
  const confirmBtn = document.getElementById("btn-confirm-status-action");

  if (isLocking) {
    titleEl.textContent = "Xác nhận khóa tài khoản";
    iconBox.style.backgroundColor = "#fee2e2";
    iconBox.style.color = "#dc2626";
    iconBox.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    descEl.innerHTML = `Bạn có chắc chắn muốn <strong>khóa tài khoản</strong> của nhân viên <strong>${escapeHtml(name)}</strong>? Nhân viên này sẽ không thể đăng nhập vào hệ thống quản trị nữa.`;
    confirmBtn.className = "btn-admin-primary";
    confirmBtn.style.backgroundColor = "#dc2626";
    confirmBtn.style.borderColor = "#b91c1c";
    confirmBtn.querySelector("span").textContent = "Khóa tài khoản";
  } else {
    titleEl.textContent = "Xác nhận mở khóa tài khoản";
    iconBox.style.backgroundColor = "#ecfdf5";
    iconBox.style.color = "#059669";
    iconBox.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
    descEl.innerHTML = `Mở khóa và khôi phục quyền truy cập cho nhân viên <strong>${escapeHtml(name)}</strong>?`;
    confirmBtn.className = "btn-admin-primary";
    confirmBtn.style.backgroundColor = "#059669";
    confirmBtn.style.borderColor = "#047857";
    confirmBtn.querySelector("span").textContent = "Mở khóa";
  }

  openModal("modal-confirm-status");
};

/**
 * Thực thi lệnh Khóa / Mở khóa
 */
async function executeConfirmStatusAction() {
  if (!pendingStatusAction) return;
  const { id, name, newStatus } = pendingStatusAction;
  const btn = document.getElementById("btn-confirm-status-action");

  try {
    btn.disabled = true;
    btn.querySelector("span").textContent = "Đang xử lý...";

    await api.patch(`/staff/${id}/status`, { status: newStatus });

    const actionText = newStatus === "LOCKED" ? "Khóa" : "Mở khóa";
    showToast(`Đã ${actionText.toLowerCase()} tài khoản "${name}" thành công!`, "success");
    closeModal("modal-confirm-status");
    pendingStatusAction = null;

    await loadStaffKpis();
    await loadStaffList();
  } catch (err) {
    console.error("[Admin Staff] Lỗi cập nhật trạng thái:", err);
    const errMsg = err?.response?.data?.detail || "Không thể cập nhật trạng thái tài khoản.";
    showToast(errMsg, "error");
  } finally {
    btn.disabled = false;
  }
}

/**
 * Mở modal xác nhận Xóa tài khoản
 */
window.openConfirmDeleteModal = function (id, name, email) {
  pendingDeleteAction = { id, name, email };
  const infoEl = document.getElementById("delete-modal-user-info");
  if (infoEl) {
    infoEl.innerHTML = `Bạn có chắc chắn muốn xóa nhân viên <strong>${escapeHtml(name)}</strong> (<em>${escapeHtml(email)}</em>, ID #${id}) khỏi hệ thống?`;
  }
  openModal("modal-confirm-delete");
};

/**
 * Thực thi xóa tài khoản
 */
async function executeConfirmDeleteAction() {
  if (!pendingDeleteAction) return;
  const { id, name } = pendingDeleteAction;
  const btn = document.getElementById("btn-confirm-delete-action");

  try {
    btn.disabled = true;
    btn.querySelector("span").textContent = "Đang xóa...";

    const res = await api.delete(`/staff/${id}`);
    const msg = res?.message || `Đã xóa tài khoản "${name}" thành công!`;
    showToast(msg, "success");

    closeModal("modal-confirm-delete");
    pendingDeleteAction = null;

    await loadStaffKpis();
    await loadStaffList();
  } catch (err) {
    console.error("[Admin Staff] Lỗi xóa tài khoản:", err);
    const errMsg = err?.response?.data?.detail || "Không thể xóa tài khoản. Vui lòng thử lại.";
    showToast(errMsg, "error");
  } finally {
    btn.disabled = false;
    btn.querySelector("span").textContent = "Xóa tài khoản";
  }
}

/**
 * Utilities
 */
function normalizeStatus(st) {
  if (!st) return "";
  const s = String(st?.name || st?.value || st).trim().toUpperCase();
  if (s === "LOCK" || s === "LOCKED" || s.includes("KHÓA")) return "LOCKED";
  return "ACTIVE";
}

function getInitials(name) {
  if (!name) return "NV";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getCurrentAdminId() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u?.id ? Number(u.id) : null;
  } catch (_) {
    return null;
  }
}

function getCurrentAdminEmail() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u?.email ? String(u.email).trim() : null;
  } catch (_) {
    return null;
  }
}
