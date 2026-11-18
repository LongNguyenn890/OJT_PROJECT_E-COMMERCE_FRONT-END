// Xử lý logic nghiệp vụ trang Đăng nhập (FR-002)

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const rememberCheckbox = document.getElementById("remember-me");
  const togglePwdBtn = document.getElementById("toggle-password");
  const eyeIcon = document.getElementById("eye-icon");
  const submitBtn = document.getElementById("btn-login-submit");
  const alertBox = document.getElementById("auth-alert");
  const emailError = document.getElementById("login-email-error");
  const passwordError = document.getElementById("login-password-error");
  const forgotPwdBtn = document.getElementById("btn-forgot-password");

  const urlParams = new URLSearchParams(window.location.search);
  const redirectUrl = urlParams.get("redirect");

  // 1. Kiểm tra thông báo từ Route Guard hoặc Đăng ký thành công
  const authMessage = sessionStorage.getItem("auth_message");
  if (authMessage) {
    const isSuccess = authMessage.includes("thành công");
    showAlert(authMessage, isSuccess ? "success" : "error");
    if (typeof showToast === "function") {
      showToast(authMessage, isSuccess ? "success" : "error");
    }
    sessionStorage.removeItem("auth_message");
  }

  // 2. Nếu đã đăng nhập trước đó và không yêu cầu đăng nhập lại (force) -> tự động chuyển hướng
  const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
  let user = typeof Auth !== "undefined" ? Auth.getUser() : null;
  if (!user) {
    try {
      user = JSON.parse(localStorage.getItem("user") || "null");
    } catch (_) {}
  }

  if (token && user && user.id && !urlParams.has("force")) {
    const role = (user.role || "").toUpperCase();
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else if (role === "ADMIN" || role === "STAFF") {
      window.location.href = "admin-dashboard.html";
    } else {
      window.location.href = "customer-home.html";
    }
    return;
  }

  // 3. Tự động điền email nếu người dùng đã chọn "Ghi nhớ đăng nhập" trước đó
  const rememberedEmail = localStorage.getItem("shopease_remembered_email");
  if (rememberedEmail) {
    emailInput.value = rememberedEmail;
    rememberCheckbox.checked = true;
  }

  // 4. Chuyển đổi ẩn / hiện mật khẩu
  togglePwdBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";

    if (isPassword) {
      eyeIcon.innerHTML = `
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
        <line x1="2" x2="22" y1="2" y2="22"/>
      `;
    } else {
      eyeIcon.innerHTML = `
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
        <circle cx="12" cy="12" r="3"/>
      `;
    }
  });

  // 5. Hiển thị thông báo hỗ trợ quên mật khẩu
  if (forgotPwdBtn) {
    forgotPwdBtn.addEventListener("click", () => {
      showAlert("Vui lòng liên hệ tổng đài 1900 6868 hoặc quản trị viên để được cấp lại mật khẩu.", "info");
    });
  }

  // 6. Xóa thông báo lỗi khi người dùng gõ phím
  emailInput.addEventListener("input", () => {
    clearFieldError(emailInput, emailError);
    hideAlert();
  });
  passwordInput.addEventListener("input", () => {
    clearFieldError(passwordInput, passwordError);
    hideAlert();
  });

  // 7. Xử lý gửi Form đăng nhập với validation chặt chẽ
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    let isValid = true;

    // Validate email
    if (!email) {
      setFieldError(emailInput, emailError, "Vui lòng nhập email đăng nhập");
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setFieldError(emailInput, emailError, "Định dạng email không hợp lệ (VD: user@example.com)");
        isValid = false;
      }
    }

    // Validate password
    if (!password) {
      setFieldError(passwordInput, passwordError, "Vui lòng nhập mật khẩu");
      isValid = false;
    } else if (password.length < 6) {
      setFieldError(passwordInput, passwordError, "Mật khẩu phải chứa ít nhất 6 ký tự");
      isValid = false;
    }

    if (!isValid) return;

    // Gửi yêu cầu đăng nhập sang Backend FastAPI
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email: email,
        password: password,
      });

      // Lưu JWT Token vào localStorage
      const token = response.access_token;
      localStorage.setItem("token", token);

      // Ghi nhớ email nếu được tích chọn
      if (rememberCheckbox.checked) {
        localStorage.setItem("shopease_remembered_email", email);
      } else {
        localStorage.removeItem("shopease_remembered_email");
      }

      // Lấy thông tin tài khoản người dùng hiện tại
      let currentUser = null;
      try {
        currentUser = await api.get("/auth/me");
        localStorage.setItem("user", JSON.stringify(currentUser));
      } catch (err) {
        console.warn("Không thể lấy thông tin /auth/me:", err);
      }

      // Thông báo đăng nhập thành công bằng Toast
      showToast("Đăng nhập thành công! Đang chuyển hướng...", "success");

      // Lưu toast chào mừng hiển thị trên trang đích sau khi redirect (viết hoa chữ cái đầu)
      const welcomeName = currentUser && currentUser.full_name
        ? (typeof capitalizeWords === "function" ? capitalizeWords(currentUser.full_name) : currentUser.full_name)
        : (currentUser?.email || "bạn");
      sessionStorage.setItem("pending_toast", JSON.stringify({
        message: `Chào mừng ${welcomeName} đã quay trở lại!`,
        type: "success"
      }));

      // Chuyển hướng sau 900ms để kịp thưởng thức hiệu ứng toast
      setTimeout(() => {
        if (redirectUrl) {
          window.location.href = redirectUrl;
          return;
        }

        const role = currentUser && currentUser.role ? String(currentUser.role).toUpperCase() : "";
        if (role === "ADMIN" || role === "STAFF") {
          window.location.href = "admin-dashboard.html";
        } else {
          window.location.href = "customer-home.html";
        }
      }, 900);

    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      let message = error.message;

      if (error.status === 401) {
        if (message && message.includes("không tồn tại")) {
          message = "Tài khoản không tồn tại. Vui lòng kiểm tra lại email hoặc đăng ký tài khoản mới.";
          setFieldError(emailInput, emailError, "Tài khoản không tồn tại trong hệ thống");
        } else if (message && (message.includes("Mật khẩu") || message.includes("mật khẩu"))) {
          message = "Mật khẩu không chính xác. Vui lòng thử lại.";
          setFieldError(passwordInput, passwordError, "Mật khẩu không chính xác");
        } else {
          message = "Tài khoản không tồn tại hoặc mật khẩu không chính xác.";
          setFieldError(emailInput, emailError, "Kiểm tra lại email đăng nhập");
          setFieldError(passwordInput, passwordError, "Kiểm tra lại mật khẩu");
        }
      } else if (error.status === 403) {
        message = "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ bộ phận hỗ trợ.";
      }

      showAlert(message, "error");
    } finally {
      setLoading(false);
    }
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  function setFieldError(input, errorElement, message) {
    input.classList.add("has-error");
    errorElement.textContent = message;
    errorElement.classList.add("show");
  }

  function clearFieldError(input, errorElement) {
    input.classList.remove("has-error");
    errorElement.textContent = "";
    errorElement.classList.remove("show");
  }

  function showAlert(message, type = "error") {
    alertBox.className = `auth-alert auth-alert-${type} show`;
    alertBox.textContent = message;
  }

  function hideAlert() {
    alertBox.className = "auth-alert";
    alertBox.textContent = "";
  }

  function setLoading(isLoading) {
    if (isLoading) {
      submitBtn.classList.add("loading");
      submitBtn.disabled = true;
    } else {
      submitBtn.classList.remove("loading");
      submitBtn.disabled = false;
    }
  }
});
