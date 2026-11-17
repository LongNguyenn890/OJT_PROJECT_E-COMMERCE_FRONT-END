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
  logout: async (redirectRoot = "./") => {
    // 1. Hiển thị thông báo Toast đăng xuất
    if (typeof showToast === "function") {
      showToast("Đăng xuất thành công! Đang chuyển hướng sau 2 giây...", "info");
    }

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

      // 2. Tạo độ delay khoảng 2 giây (2000ms) trước khi chuyển hướng
      setTimeout(() => {
        window.location.href = `${redirectRoot}pages/login.html`;
      }, 2000);
    }
  }
};
