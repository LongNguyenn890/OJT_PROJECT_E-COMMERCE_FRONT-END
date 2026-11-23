// Các hàm tiện ích dùng chung cho nhiều trang.

// Chống XSS: luôn dùng hàm này khi chèn dữ liệu người dùng nhập vào innerHTML
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

// 45000 -> "45.000 ₫"
function formatMoney(value) {
  return Number(value).toLocaleString("vi-VN") + " ₫";
}

// "2026-11-04T09:30:00" -> "09:30 4/11/2026"
function formatDateTime(value) {
  const d = new Date(value);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " " +
    d.toLocaleDateString("vi-VN");
}

// Viết hoa chữ cái đầu của mỗi từ (Title Case): "nguyễn văn an" -> "Nguyễn Văn An"
function capitalizeWords(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

// Hiện thông báo toast góc phải trên cùng, khung chữ nhật bo góc, viền và shadow bên trái theo trạng thái
function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText = "position: fixed; top: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 12px; pointer-events: none;";
    document.body.appendChild(container);
  }

  // Cấu hình màu sắc, ánh sáng shadow và icon theo từng trạng thái
  const config = {
    success: {
      title: "Thành công",
      color: "#10b981",
      glow: "rgba(16, 185, 129, 0.45)",
      bgTint: "#ecfdf5",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`
    },
    error: {
      title: "Thất bại",
      color: "#ef4444",
      glow: "rgba(239, 68, 68, 0.45)",
      bgTint: "#fef2f2",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`
    },
    warning: {
      title: "Cảnh báo",
      color: "#f59e0b",
      glow: "rgba(245, 158, 11, 0.45)",
      bgTint: "#fffbeb",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
    },
    info: {
      title: "Thông báo",
      color: "#00288e",
      glow: "rgba(0, 40, 142, 0.42)",
      bgTint: "#eff6ff",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00288e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`
    }
  };

  const currentCfg = config[type] || config.info;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    pointer-events: auto;
    position: relative;
    min-width: 320px;
    max-width: 440px;
    padding: 14px 18px;
    border-radius: 14px;
    background: #ffffff;
    color: #131b2e;
    border: 1px solid #e5e7eb;
    border-left: 5px solid ${currentCfg.color};
    box-shadow: -8px 0 20px -3px ${currentCfg.glow}, 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-family: var(--se-font-body, system-ui, -apple-system, sans-serif);
    opacity: 0;
    transform: translateX(60px);
    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  toast.innerHTML = `
    <div style="width: 34px; height: 34px; border-radius: 50%; background: ${currentCfg.bgTint}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
      ${currentCfg.iconSvg}
    </div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-size: 14px; font-weight: 700; color: #131b2e; margin-bottom: 2px;">
        ${currentCfg.title}
      </div>
      <div style="font-size: 13.5px; color: #444653; line-height: 1.45; word-break: break-word;">
        ${escapeHtml(message)}
      </div>
    </div>
    <button type="button" aria-label="Đóng" style="background: none; border: none; padding: 4px; cursor: pointer; color: #9ca3af; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-top: -2px; margin-right: -4px; transition: color 0.15s, background-color 0.15s;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  `;

  // Nút đóng nhanh thủ công
  const closeBtn = toast.querySelector("button");
  if (closeBtn) {
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.color = "#131b2e";
      closeBtn.style.backgroundColor = "#f3f4f6";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.color = "#9ca3af";
      closeBtn.style.backgroundColor = "transparent";
    });
    closeBtn.addEventListener("click", () => dismissToast(toast, container));
  }

  container.appendChild(toast);

  // Kích hoạt animation xuất hiện mượt mà
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(0)";
  });

  // Tự biến mất sau 3.5 giây
  const autoDismissTimer = setTimeout(() => {
    dismissToast(toast, container);
  }, 3500);

  function dismissToast(targetToast, targetContainer) {
    clearTimeout(autoDismissTimer);
    targetToast.style.opacity = "0";
    targetToast.style.transform = "translateY(-16px) scale(0.96)";
    setTimeout(() => {
      targetToast.remove();
      if (targetContainer && targetContainer.children.length === 0) {
        targetContainer.remove();
      }
    }, 300);
  }
}

// Đăng ký toàn cục và thay thế hàm alert() mặc định của trình duyệt sang toast thông báo
window.showToast = showToast;
window.alert = function (message) {
  if (typeof showToast === "function") {
    showToast(String(message ?? ""), "info");
  } else {
    console.info("Toast alert:", message);
  }
};

// ==========================================================
// 15. POP-UP XÁC NHẬN (CONFIRMATION MODAL / DIALOG)
// ==========================================================
function showConfirmModal({
  title = "Xác nhận hành động",
  message = "Bạn có chắc chắn muốn thực hiện thao tác này?",
  confirmText = "Xác nhận",
  cancelText = "Hủy bỏ",
  type = "danger", // 'danger' | 'warning' | 'primary'
  onConfirm = () => {},
  onCancel = () => {}
} = {}) {
  // Đóng modal cũ nếu còn tồn tại
  const oldModal = document.getElementById("se-confirm-modal");
  if (oldModal) oldModal.remove();

  const configs = {
    danger: {
      btnBg: "#dc2626",
      btnHover: "#b91c1c",
      iconBg: "#fee2e2",
      iconColor: "#dc2626",
      iconSvg: `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" x2="9" y1="12" y2="12"/>
        </svg>
      `
    },
    warning: {
      btnBg: "#d97706",
      btnHover: "#b45309",
      iconBg: "#fef3c7",
      iconColor: "#d97706",
      iconSvg: `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      `
    },
    primary: {
      btnBg: "#00288e",
      btnHover: "#001f70",
      iconBg: "#eaedff",
      iconColor: "#00288e",
      iconSvg: `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00288e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      `
    }
  };

  const currentCfg = configs[type] || configs.danger;

  const overlay = document.createElement("div");
  overlay.id = "se-confirm-modal";
  overlay.className = "modal-overlay active";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 100000;
    display: flex !important;
    justify-content: center;
    align-items: center;
    padding: 16px;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    opacity: 0;
    visibility: visible !important;
    transition: opacity 0.22s ease;
  `;

  overlay.innerHTML = `
    <div class="modal se-confirm-card" style="
      width: 100%;
      max-width: 420px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      transform: scale(0.92) translateY(8px);
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid #e2e8f0;
      font-family: var(--se-font-body, system-ui, -apple-system, sans-serif);
    ">
      <div style="padding: 24px 24px 18px 24px; display: flex; gap: 16px; align-items: flex-start;">
        <div style="
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: ${currentCfg.iconBg};
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        ">
          ${currentCfg.iconSvg}
        </div>
        <div style="flex: 1;">
          <h3 style="margin: 0 0 6px 0; font-size: 17.5px; font-weight: 700; color: #0f172a; font-family: var(--se-font-heading, system-ui, sans-serif); letter-spacing: -0.01em;">
            ${escapeHtml(title)}
          </h3>
          <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.55;">
            ${escapeHtml(message)}
          </p>
        </div>
      </div>
      <div style="
        padding: 14px 24px;
        background: #f8fafc;
        border-top: 1px solid #f1f5f9;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
      ">
        <button id="modal-cancel-btn" type="button" style="
          padding: 8px 18px;
          font-size: 13.5px;
          font-weight: 600;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        ">
          ${escapeHtml(cancelText)}
        </button>
        <button id="modal-confirm-btn" type="button" style="
          padding: 8px 20px;
          font-size: 13.5px;
          font-weight: 600;
          border-radius: 8px;
          background: ${currentCfg.btnBg};
          color: #ffffff;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        ">
          ${escapeHtml(confirmText)}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animation xuất hiện mượt mà
  requestAnimationFrame(() => {
    overlay.classList.add("active");
    overlay.style.visibility = "visible";
    overlay.style.opacity = "1";
    const card = overlay.querySelector(".se-confirm-card");
    if (card) {
      card.style.transform = "scale(1) translateY(0)";
    }
  });

  const cancelBtn = overlay.querySelector("#modal-cancel-btn");
  const confirmBtn = overlay.querySelector("#modal-confirm-btn");

  // Hiệu ứng hover
  cancelBtn.addEventListener("mouseenter", () => cancelBtn.style.background = "#f1f5f9");
  cancelBtn.addEventListener("mouseleave", () => cancelBtn.style.background = "#ffffff");
  confirmBtn.addEventListener("mouseenter", () => confirmBtn.style.background = currentCfg.btnHover);
  confirmBtn.addEventListener("mouseleave", () => confirmBtn.style.background = currentCfg.btnBg);

  function destroyModal() {
    overlay.classList.remove("active");
    overlay.style.opacity = "0";
    overlay.style.visibility = "hidden";
    const card = overlay.querySelector(".se-confirm-card");
    if (card) {
      card.style.transform = "scale(0.92) translateY(8px)";
    }
    document.removeEventListener("keydown", onKeyDown);
    setTimeout(() => {
      overlay.remove();
    }, 220);
  }

  function handleCancel() {
    destroyModal();
    if (typeof onCancel === "function") onCancel();
  }

  function handleConfirm() {
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = "0.75";
    confirmBtn.style.cursor = "not-allowed";
    confirmBtn.textContent = "Đang xử lý...";
    destroyModal();
    if (typeof onConfirm === "function") onConfirm();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      handleCancel();
    }
  }

  cancelBtn.addEventListener("click", handleCancel);
  confirmBtn.addEventListener("click", handleConfirm);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      handleCancel();
    }
  });
  document.addEventListener("keydown", onKeyDown);
}

// Tiện ích xác thực và phân quyền người dùng (Authentication & RBAC Helper)
const Auth = {
  getToken: () => localStorage.getItem("token"),
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (_) {
      return null;
    }
  },
  setSession: (token, user) => {
    if (token) localStorage.setItem("token", token);
    if (user) localStorage.setItem("user", JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },
  isLoggedIn: () => !!localStorage.getItem("token"),
  getRole: () => {
    const user = Auth.getUser();
    return user && user.role ? String(user.role).toUpperCase() : null;
  },
  isAdmin: () => {
    const role = Auth.getRole();
    return role === "ADMIN" || role === "STAFF";
  },
  confirmLogout: (redirectRoot = "./") => {
    showConfirmModal({
      title: "Xác nhận đăng xuất",
      message: "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản ShopEase không?",
      confirmText: "Đăng xuất",
      cancelText: "Hủy",
      type: "danger",
      onConfirm: () => {
        Auth.logout(redirectRoot);
      }
    });
  },
  logout: async (redirectRoot = "./") => {
    try {
      if (typeof api !== "undefined") {
        await api.post("/auth/logout");
      }
    } catch (e) {
      console.warn("Lỗi gọi API đăng xuất:", e);
    } finally {
      Auth.clearSession();

      // Lưu flash toast hiển thị khi sang trang login
      sessionStorage.setItem("pending_toast", JSON.stringify({
        message: "Bạn đã đăng xuất thành công.",
        type: "success"
      }));

      // Chuyển hướng ngay lập tức đến trang đăng nhập (không có độ trễ)
      window.location.href = `${redirectRoot}pages/login.html`;
    }
  }
};

/**
 * Hàm Debounce trì hoãn gọi hàm cho tới khi người dùng ngừng thao tác
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
function debounce(func, wait = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Thiết lập hệ thống tìm kiếm thông minh cho các trang quản trị (Admin Autocomplete & Search History)
 * - Tự động debounce khi người dùng nhập từ khóa
 * - Hiển thị dropdown Lịch sử tìm kiếm gần đây (Search History) khi focus vào ô tìm kiếm
 * - Hiển thị dropdown Gợi ý tìm kiếm trực tiếp (Live Suggestions) khi gõ ký tự
 * - Lưu từ khóa tìm kiếm gần đây vào localStorage theo từng phân hệ quản trị
 * - Hỗ trợ phím Enter để chọn / tìm kiếm, Escape để đóng, mũi tên lên/xuống để duyệt
 * - Đóng dropdown khi click ra ngoài
 * 
 * @param {Object} opts
 * @param {string|HTMLInputElement} opts.input - ID hoặc element ô tìm kiếm
 * @param {string} opts.storageKey - Key lưu trữ lịch sử trong localStorage
 * @param {Function} opts.onSearch - Callback khi tìm kiếm: (query, item) => void
 * @param {Function} [opts.getSuggestions] - Async callback: async (query) => Array<{ title, subtitle, badge, value }>
 * @param {number} [opts.debounceMs=320] - Thời gian debounce gõ phím
 * @param {number} [opts.maxHistory=6] - Số lượng từ khóa lịch sử tối đa
 * @returns {Object} Các hàm điều khiển: { saveHistory, clearHistory, close, refreshSuggestions }
 */
function setupAdminSearchAutocomplete(opts) {
  const inputEl = typeof opts.input === "string" ? document.querySelector(opts.input) : opts.input;
  if (!inputEl) return null;

  const storageKey = opts.storageKey || "shopease_admin_search_history";
  const debounceMs = opts.debounceMs || 320;
  const maxHistory = opts.maxHistory || 6;
  const onSearch = opts.onSearch || (() => {});
  const onSelect = opts.onSelect || null;
  const getSuggestions = opts.getSuggestions || null;

  // Đảm bảo wrapper .admin-search-box có position: relative
  const wrapper = inputEl.closest(".admin-search-box") || inputEl.parentElement;
  if (wrapper && getComputedStyle(wrapper).position === "static") {
    wrapper.style.position = "relative";
  }

  // Tạo dropdown container nếu chưa có
  let dropdown = wrapper.querySelector(".admin-search-dropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.className = "admin-search-dropdown";
    dropdown.hidden = true;
    wrapper.appendChild(dropdown);
  }

  let lastSuggestions = [];
  let debounceTimer = null;
  let activeIndex = -1;

  const getHistory = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch (_) {
      return [];
    }
  };

  const saveHistoryItem = (val) => {
    const trimmed = String(val || "").trim();
    if (!trimmed) return;
    let list = getHistory().filter(item => {
      const v = typeof item === "string" ? item : (item.value || item.title);
      return String(v).toLowerCase() !== trimmed.toLowerCase();
    });
    list.unshift({ title: trimmed, value: trimmed, timestamp: Date.now() });
    if (list.length > maxHistory) list = list.slice(0, maxHistory);
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch (_) {}
  };

  const removeHistoryItem = (val) => {
    let list = getHistory().filter(item => {
      const v = typeof item === "string" ? item : (item.value || item.title);
      return String(v).toLowerCase() !== String(val).toLowerCase();
    });
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch (_) {}
  };

  const clearAllHistory = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch (_) {}
  };

  const closeDropdown = () => {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
    activeIndex = -1;
  };

  const highlightKeyword = (text, query) => {
    if (!text) return "";
    if (!query) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${q})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  };

  const renderHistory = () => {
    const history = getHistory();
    if (!history || history.length === 0) {
      closeDropdown();
      return;
    }

    dropdown.innerHTML = `
      <div class="admin-suggest-header">
        <span class="admin-suggest-header-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Lịch sử tìm kiếm
        </span>
        <button type="button" class="admin-suggest-clear-all" data-action="clear-all">Xóa lịch sử</button>
      </div>
      <div class="admin-suggest-list">
        ${history.map((item, idx) => {
          const title = typeof item === "string" ? item : item.title;
          const val = typeof item === "string" ? item : (item.value || item.title);
          return `
            <div class="admin-suggest-item" data-action="select-history" data-index="${idx}" data-value="${escapeHtml(val)}">
              <svg class="admin-suggest-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <div class="admin-suggest-content">
                <span class="admin-suggest-title">${escapeHtml(title)}</span>
              </div>
              <button type="button" class="admin-suggest-remove-item" data-action="remove-one" data-value="${escapeHtml(val)}" title="Xóa từ khóa này">&times;</button>
            </div>
          `;
        }).join("")}
      </div>
    `;
    dropdown.hidden = false;
  };

  const renderSuggestions = async (query) => {
    if (!getSuggestions) {
      closeDropdown();
      return;
    }

    try {
      dropdown.innerHTML = `
        <div style="padding: 14px; text-align: center; color: #94a3b8; font-size: 12.5px;">
          <span class="btn-op-spinner" style="width: 13px; height: 13px; border-width: 1.5px; vertical-align: -2px; margin-right: 6px;"></span>
          Đang tìm gợi ý...
        </div>
      `;
      dropdown.hidden = false;

      const suggestions = await getSuggestions(query);
      if (inputEl.value.trim() !== query) return; // Kiểm tra tránh race condition nếu người dùng đã gõ tiếp

      lastSuggestions = suggestions || [];

      if (!suggestions || suggestions.length === 0) {
        dropdown.innerHTML = `
          <div class="admin-suggest-empty">
            Không tìm thấy kết quả phù hợp cho "<b>${escapeHtml(query)}</b>"
          </div>
        `;
        return;
      }

      dropdown.innerHTML = `
        <div class="admin-suggest-header">
          <span class="admin-suggest-header-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Kết quả gợi ý (Bấm để xem chi tiết)
          </span>
        </div>
        <div class="admin-suggest-list">
          ${suggestions.map((s, idx) => {
            const title = typeof s === "string" ? s : s.title;
            const subtitle = typeof s === "object" ? s.subtitle : "";
            const badge = typeof s === "object" ? s.badge : "";
            const val = typeof s === "object" ? (s.value || s.title) : s;
            return `
              <div class="admin-suggest-item" data-action="select-suggest" data-index="${idx}" data-value="${escapeHtml(val)}">
                <svg class="admin-suggest-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <div class="admin-suggest-content">
                  <span class="admin-suggest-title">${highlightKeyword(title, query)}</span>
                  ${subtitle ? `<span class="admin-suggest-subtitle">${escapeHtml(subtitle)}</span>` : ""}
                </div>
                ${badge ? `<span class="admin-suggest-badge">${escapeHtml(badge)}</span>` : ""}
              </div>
            `;
          }).join("")}
        </div>
      `;
      dropdown.hidden = false;
    } catch (err) {
      console.warn("Lỗi tải gợi ý:", err);
      closeDropdown();
    }
  };

  // Event: Focus -> hiển thị Lịch sử nếu rỗng, hoặc Gợi ý nếu đã có text
  inputEl.addEventListener("focus", () => {
    const val = inputEl.value.trim();
    if (!val) {
      renderHistory();
    } else {
      renderSuggestions(val);
    }
  });

  // Event: Input (Debounce) -> CHỈ hiển thị dropdown gợi ý, TUYỆT ĐỐI KHÔNG lọc / thay đổi khu vực bảng hiển thị chung
  inputEl.addEventListener("input", () => {
    const val = inputEl.value.trim();
    clearTimeout(debounceTimer);

    if (!val) {
      renderHistory();
      // Khi người dùng xóa trắng ô tìm kiếm, mới khôi phục lại bảng danh sách ban đầu
      debounceTimer = setTimeout(() => {
        onSearch("", null);
      }, debounceMs);
      return;
    }

    // Khi gõ phím: CHỈ tìm kiếm gợi ý trên dropdown, KHÔNG đổi dữ liệu bảng chung
    debounceTimer = setTimeout(() => {
      renderSuggestions(val);
    }, debounceMs);
  });

  // Event: Keydown (Enter, Escape, Arrow Up/Down)
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDropdown();
      return;
    }

    const items = dropdown.querySelectorAll(".admin-suggest-item[data-action='select-suggest'], .admin-suggest-item[data-action='select-history']");
    if (e.key === "ArrowDown") {
      if (dropdown.hidden || items.length === 0) return;
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      items.forEach((it, idx) => it.classList.toggle("highlighted", idx === activeIndex));
      if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: "nearest" });
      return;
    }

    if (e.key === "ArrowUp") {
      if (dropdown.hidden || items.length === 0) return;
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      items.forEach((it, idx) => it.classList.toggle("highlighted", idx === activeIndex));
      if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: "nearest" });
      return;
    }

    if (e.key === "Enter") {
      clearTimeout(debounceTimer);
      if (!dropdown.hidden && activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        items[activeIndex].click();
      } else if (!dropdown.hidden && lastSuggestions.length > 0) {
        // Nếu có gợi ý đang mở và bấm Enter, chọn gợi ý đầu tiên
        e.preventDefault();
        const firstItem = lastSuggestions[0];
        const selectedVal = firstItem.value || firstItem.title;
        inputEl.value = selectedVal;
        saveHistoryItem(selectedVal);
        closeDropdown();
        if (typeof onSelect === "function") {
          onSelect(firstItem);
        }
        if (typeof onSearch === "function") {
          onSearch(selectedVal, firstItem);
        }
      } else {
        // Khi bấm Enter không chọn gợi ý hoặc dropdown đang đóng: thực thi tìm kiếm bình thường trên bảng
        e.preventDefault();
        const currentVal = inputEl.value.trim();
        saveHistoryItem(currentVal);
        closeDropdown();
        if (typeof onSearch === "function") {
          onSearch(currentVal, null);
        }
      }
    }
  });

  // Click on dropdown items: CHỈ KHI BẤM VÀO KẾT QUẢ MỚI HIỂN THỊ CHI TIẾT
  dropdown.addEventListener("click", (e) => {
    const clearBtn = e.target.closest("[data-action='clear-all']");
    if (clearBtn) {
      e.stopPropagation();
      clearAllHistory();
      closeDropdown();
      return;
    }

    const removeBtn = e.target.closest("[data-action='remove-one']");
    if (removeBtn) {
      e.stopPropagation();
      const valToRemove = removeBtn.getAttribute("data-value");
      removeHistoryItem(valToRemove);
      renderHistory();
      return;
    }

    const suggestItem = e.target.closest("[data-action='select-suggest']");
    if (suggestItem) {
      e.stopPropagation();
      const idx = parseInt(suggestItem.getAttribute("data-index"), 10);
      const selectedItem = (!isNaN(idx) && lastSuggestions[idx]) ? lastSuggestions[idx] : null;
      const selectedVal = suggestItem.getAttribute("data-value");
      
      inputEl.value = selectedVal;
      saveHistoryItem(selectedVal);
      closeDropdown();

      // MỞ THÔNG TIN CHI TIẾT CỦA ĐỐI TƯỢNG VỪA CHỌN
      if (typeof onSelect === "function" && selectedItem) {
        onSelect(selectedItem);
      }
      if (typeof onSearch === "function") {
        onSearch(selectedVal, selectedItem);
      }
      return;
    }

    const historyItem = e.target.closest("[data-action='select-history']");
    if (historyItem) {
      e.stopPropagation();
      const selectedVal = historyItem.getAttribute("data-value");
      inputEl.value = selectedVal;
      saveHistoryItem(selectedVal);
      closeDropdown();

      // Khi bấm từ lịch sử: áp dụng tìm kiếm cho từ khóa đó
      if (typeof onSearch === "function") {
        onSearch(selectedVal, null);
      }
    }
  });

  // Click ra ngoài để đóng dropdown
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      closeDropdown();
    }
  });

  return {
    saveHistory: saveHistoryItem,
    clearHistory: clearAllHistory,
    close: closeDropdown,
    refreshSuggestions: () => {
      const val = inputEl.value.trim();
      if (val) renderSuggestions(val);
      else renderHistory();
    }
  };
}
