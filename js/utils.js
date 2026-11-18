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
  overlay.className = "modal-overlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    opacity: 0;
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
    overlay.style.opacity = "0";
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
