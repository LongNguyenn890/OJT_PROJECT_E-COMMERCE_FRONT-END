// Xử lý logic nghiệp vụ trang Đăng ký tài khoản mới (FR-001)

document.addEventListener("DOMContentLoaded", () => {
  // 1. Nếu đã đăng nhập thì chuyển hướng về trang chủ
  const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
  if (token) {
    const root = document.body.dataset.root || "../";
    window.location.href = `${root}pages/customer-home.html`;
    return;
  }

  const registerForm = document.getElementById("register-form");
  const fullNameInput = document.getElementById("reg-fullname");
  const phoneInput = document.getElementById("reg-phone");
  const emailInput = document.getElementById("reg-email");
  const passwordInput = document.getElementById("reg-password");
  const confirmPasswordInput = document.getElementById("reg-confirm-password");
  const termsCheckbox = document.getElementById("reg-terms");

  const togglePwdBtn = document.getElementById("toggle-reg-password");
  const toggleConfirmPwdBtn = document.getElementById("toggle-reg-confirm-password");
  const eyeIcon = document.getElementById("reg-eye-icon");
  const confirmEyeIcon = document.getElementById("reg-confirm-eye-icon");

  const submitBtn = document.getElementById("btn-register-submit");
  const alertBox = document.getElementById("auth-alert");

  const fullNameError = document.getElementById("reg-fullname-error");
  const phoneError = document.getElementById("reg-phone-error");
  const emailError = document.getElementById("reg-email-error");
  const passwordError = document.getElementById("reg-password-error");
  const confirmPasswordError = document.getElementById("reg-confirm-password-error");
  const termsError = document.getElementById("reg-terms-error");

  // Toggle ẩn / hiện mật khẩu chính
  setupPasswordToggle(togglePwdBtn, passwordInput, eyeIcon);

  // Toggle ẩn / hiện mật khẩu xác nhận
  setupPasswordToggle(toggleConfirmPwdBtn, confirmPasswordInput, confirmEyeIcon);

  function setupPasswordToggle(btn, input, icon) {
    btn.addEventListener("click", () => {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";

      if (isPassword) {
        icon.innerHTML = `
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
          <line x1="2" x2="22" y1="2" y2="22"/>
        `;
      } else {
        icon.innerHTML = `
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        `;
      }
    });
  }

  // Xóa lỗi khi gõ phím
  const inputs = [
    { input: fullNameInput, error: fullNameError },
    { input: phoneInput, error: phoneError },
    { input: emailInput, error: emailError },
    { input: passwordInput, error: passwordError },
    { input: confirmPasswordInput, error: confirmPasswordError },
  ];

  inputs.forEach(({ input, error }) => {
    input.addEventListener("input", () => {
      clearFieldError(input, error);
      hideAlert();
    });
  });

  termsCheckbox.addEventListener("change", () => {
    if (termsCheckbox.checked) {
      termsError.textContent = "";
      termsError.classList.remove("show");
    }
  });

  // Xử lý gửi Form đăng ký
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();

    const fullName = fullNameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    let isValid = true;

    // Validate Họ và tên (min 5, max 100 ký tự theo Backend UserCreate)
    if (!fullName) {
      setFieldError(fullNameInput, fullNameError, "Vui lòng nhập họ và tên");
      isValid = false;
    } else if (fullName.length < 5) {
      setFieldError(fullNameInput, fullNameError, "Họ và tên phải có ít nhất 5 ký tự");
      isValid = false;
    }

    // Validate Số điện thoại (10 - 15 ký tự số)
    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8,13}$/;
    if (!phone) {
      setFieldError(phoneInput, phoneError, "Vui lòng nhập số điện thoại");
      isValid = false;
    } else if (!phoneRegex.test(phone)) {
      setFieldError(phoneInput, phoneError, "Số điện thoại không đúng định dạng (VD: 0912345678)");
      isValid = false;
    }

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setFieldError(emailInput, emailError, "Vui lòng nhập địa chỉ email");
      isValid = false;
    } else if (!emailRegex.test(email)) {
      setFieldError(emailInput, emailError, "Định dạng email không hợp lệ (VD: name@example.com)");
      isValid = false;
    }

    // Validate Mật khẩu (tối thiểu 6 ký tự, không chứa khoảng trắng)
    if (!password) {
      setFieldError(passwordInput, passwordError, "Vui lòng nhập mật khẩu");
      isValid = false;
    } else if (/\s/.test(password)) {
      setFieldError(passwordInput, passwordError, "Mật khẩu không được chứa khoảng trắng");
      isValid = false;
    } else if (password.length < 6) {
      setFieldError(passwordInput, passwordError, "Mật khẩu phải chứa ít nhất 6 ký tự");
      isValid = false;
    }

    // Validate Xác nhận mật khẩu
    if (!confirmPassword) {
      setFieldError(confirmPasswordInput, confirmPasswordError, "Vui lòng nhập lại mật khẩu");
      isValid = false;
    } else if (/\s/.test(confirmPassword)) {
      setFieldError(confirmPasswordInput, confirmPasswordError, "Mật khẩu xác nhận không được chứa khoảng trắng");
      isValid = false;
    } else if (confirmPassword !== password) {
      setFieldError(confirmPasswordInput, confirmPasswordError, "Mật khẩu xác nhận không khớp");
      isValid = false;
    }

    // Validate Đồng ý điều khoản
    if (!termsCheckbox.checked) {
      termsError.textContent = "Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách bảo mật để tiếp tục";
      termsError.classList.add("show");
      isValid = false;
    }

    if (!isValid) return;

    // Gửi yêu cầu đăng ký sang Backend FastAPI
    setLoading(true);

    try {
      const formattedFullName = typeof capitalizeWords === "function" ? capitalizeWords(fullName) : fullName;
      await api.post("/auth/register", {
        full_name: formattedFullName,
        email: email,
        phone: phone,
        password: password,
      });

      // Lưu email vừa đăng ký và thông báo thành công cho trang login
      localStorage.setItem("shopease_remembered_email", email);
      sessionStorage.setItem("auth_message", "Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.");

      showToast("Đăng ký tài khoản thành công! Đang chuyển hướng...", "success");
      showAlert("Đăng ký tài khoản thành công! Đang chuyển đến trang đăng nhập...", "success");

      // Chuyển hướng sang trang đăng nhập sau 1.2 giây
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);

    } catch (error) {
      console.error("Lỗi đăng ký:", error);
      let message = error.message;

      if (error.status === 409) {
        message = "Email này đã được sử dụng. Vui lòng sử dụng email khác hoặc đăng nhập.";
        setFieldError(emailInput, emailError, "Email đã tồn tại trong hệ thống");
      } else if (error.status === 422) {
        message = `Dữ liệu không hợp lệ: ${error.message}`;
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
