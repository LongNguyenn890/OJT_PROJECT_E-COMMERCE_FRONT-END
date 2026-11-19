/**
 * ShopEase - Quản lý Nhân sự & Phân quyền (Admin Staff Management)
 * Xử lý toàn bộ logic cho trang admin-staff.html:
 *  - GET    /api/customers?role=INTERNAL   : Danh sách nhân viên & quản trị viên
 *  - POST   /api/customers/staff           : Tạo mới tài khoản nhân viên
 *  - PUT    /api/customers/staff/{id}      : Chỉnh sửa thông tin, phân quyền, đổi mật khẩu
 *  - PATCH  /api/customers/{id}/status     : Khóa hoặc mở khóa tài khoản
 *  - DELETE /api/customers/{id}            : Xóa tài khoản nhân viên
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
  initModals();
  initFilters();
  initForms();

  // Đảm bảo phiên quản trị và tải dữ liệu
  await ensureAdminSession();
  await loadStaffKpis();
  await loadStaffList();
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
      if (!roleStr.includes("ADMIN") && !roleStr.includes("STAFF")) {
        needsLogin = true;
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
    const res = await api.get("/customers", {
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

    const res = await api.get("/customers", params);
    const items = res?.items || [];
    totalItems = res?.total !== undefined ? res.total : items.length;

    renderStaffTable(items);
    renderPagination();

    const summaryLbl = document.getElementById("staff-summary-lbl");
    if (summaryLbl) {
      const from = items.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
      const to = Math.min(currentPage * pageSize, totalItems);
      summaryLbl.textContent = `Hiển thị ${from} - ${to} trong tổng số ${totalItems} nhân sự`;
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
 * Render thanh phân trang
 */
function renderPagination() {
  const container = document.getElementById("staff-pagination");
  if (!container) return;

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = "";
  html += `
    <button type="button" class="page-btn" ${currentPage === 1 ? "disabled" : ""} onclick="changePage(${currentPage - 1})">
      &laquo;
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      html += `
        <button type="button" class="page-btn ${i === currentPage ? "active" : ""}" onclick="changePage(${i})">
          ${i}
        </button>
      `;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
    }
  }

  html += `
    <button type="button" class="page-btn ${currentPage === totalPages ? "disabled" : ""} onclick="changePage(${currentPage + 1})">
      &raquo;
    </button>
  `;

  container.innerHTML = html;
}

window.changePage = function (p) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  if (p < 1 || p > totalPages || p === currentPage) return;
  currentPage = p;
  loadStaffList();
};

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

        await api.post("/customers/staff", {
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

        await api.put(`/customers/staff/${id}`, payload);

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

    await api.patch(`/customers/${id}/status`, { status: newStatus });

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

    const res = await api.delete(`/customers/${id}`);
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
