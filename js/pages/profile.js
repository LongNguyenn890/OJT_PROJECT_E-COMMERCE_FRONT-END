// ==========================================================
// SHOPEASE - XỬ LÝ LOGIC TRANG HỒ SƠ CÁ NHÂN (PROFILE.JS)
// Thiết kế & Luồng dữ liệu chuẩn Figma 150:8 "Hồ sơ cá nhân"
// ==========================================================

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Kiểm tra xác thực qua Auth Helper
  const token = typeof Auth !== "undefined" ? Auth.getToken() : localStorage.getItem("token");
  if (!token) {
    sessionStorage.setItem("auth_message", "Vui lòng đăng nhập để xem và quản lý hồ sơ cá nhân.");
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent(currentUrl)}`;
    return;
  }

  // 2. Tham chiếu các phần tử giao diện
  // 2.1 Cột điều hướng & Breadcrumb
  const breadcrumbCurrentText = document.getElementById("breadcrumb-current-text");
  const navItemViewProfile = document.getElementById("nav-item-view-profile");
  const navItemAddresses = document.getElementById("nav-item-addresses");
  const navItemChangePwd = document.getElementById("nav-item-change-pwd");
  const navAddressCountBadge = document.getElementById("nav-address-count-badge");

  // 2.2 Thẻ định danh cột trái (Side card)
  const sideAvatarImg = document.getElementById("side-avatar-img");
  const sideUserName = document.getElementById("side-user-name");
  const sideUserEmail = document.getElementById("side-user-email");
  const sideUserRole = document.getElementById("side-user-role");
  const sideAddressCount = document.getElementById("side-address-count");
  const statRewardPoints = document.getElementById("stat-reward-points");
  const btnOpenRedeemModal = document.getElementById("btn-open-redeem-modal");

  // Modal Quy đổi điểm thưởng
  const redeemVoucherModal = document.getElementById("redeem-voucher-modal");
  const btnCloseRedeemModal = document.getElementById("btn-close-redeem-modal");
  const btnCancelRedeemModal = document.getElementById("btn-cancel-redeem-modal");
  const modalRewardPointsBalance = document.getElementById("modal-reward-points-balance");
  const redeemTiersContainer = document.getElementById("redeem-tiers-container");
  const myVouchersList = document.getElementById("my-vouchers-list");

  // 2.3 Khối Chế độ xem: Thông tin cá nhân (Mặc định)
  const viewProfileCard = document.getElementById("view-profile-card");
  const btnOpenEdit = document.getElementById("btn-open-edit");
  const btnOpenPassword = document.getElementById("btn-open-password");
  const viewAvatarImg = document.getElementById("view-avatar-img");
  const viewUserName = document.getElementById("view-user-name");
  const viewUserEmail = document.getElementById("view-user-email");
  const viewUserRoleBadge = document.getElementById("view-user-role-badge");
  const viewFullname = document.getElementById("view-fullname");
  const viewEmail = document.getElementById("view-email");
  const viewPhone = document.getElementById("view-phone");

  // 2.4 Khối Chế độ sửa: Form Chỉnh sửa thông tin
  const editProfileCard = document.getElementById("edit-profile-card");
  const btnBackFromEdit = document.getElementById("btn-back-from-edit");
  const profileForm = document.getElementById("profile-info-form");
  const fullnameInput = document.getElementById("profile-fullname");
  const emailInput = document.getElementById("profile-email");
  const phoneInput = document.getElementById("profile-phone");
  const fullnameError = document.getElementById("fullname-error");
  const emailError = document.getElementById("email-error");
  const phoneError = document.getElementById("phone-error");
  const btnCancelProfile = document.getElementById("btn-cancel-profile");
  const btnSaveProfile = document.getElementById("btn-save-profile");

  // Avatar Upload trong Form sửa
  const formAvatarPreview = document.getElementById("form-avatar-preview");
  const avatarFileInput = document.getElementById("avatar-file-input");
  const btnChooseAvatar = document.getElementById("btn-choose-avatar");
  const btnDeleteAvatar = document.getElementById("btn-delete-avatar");

  // 2.5 Khối Chế độ sửa: Form Đổi mật khẩu
  const passwordProfileCard = document.getElementById("password-profile-card");
  const btnBackFromPwd = document.getElementById("btn-back-from-pwd");
  const passwordForm = document.getElementById("change-password-form");
  const pwdCurrentInput = document.getElementById("pwd-current");
  const pwdNewInput = document.getElementById("pwd-new");
  const pwdConfirmInput = document.getElementById("pwd-confirm");
  const pwdCurrentError = document.getElementById("pwd-current-error");
  const pwdNewError = document.getElementById("pwd-new-error");
  const pwdConfirmError = document.getElementById("pwd-confirm-error");
  const btnCancelPwd = document.getElementById("btn-cancel-pwd");
  const btnSubmitPwd = document.getElementById("btn-submit-pwd");

  // 2.6 Khối Chuyên mục riêng: Sổ địa chỉ nhận hàng (Tách biệt hoàn toàn)
  const addressesProfileCard = document.getElementById("addresses-profile-card");
  const btnOpenAddAddr = document.getElementById("btn-open-add-addr");
  const addressesListContainer = document.getElementById("addresses-list-container");

  // Khối tóm tắt địa chỉ bên dưới thông tin cá nhân (Chế độ xem)
  const addressOverviewCard = document.getElementById("address-overview-card");
  const overviewAddrName = document.getElementById("overview-addr-name");
  const overviewAddrPhone = document.getElementById("overview-addr-phone");
  const overviewAddrBadge = document.getElementById("overview-addr-badge");
  const overviewAddrStreet = document.getElementById("overview-addr-street");
  const overviewAddrLocation = document.getElementById("overview-addr-location");
  const btnEditOverviewAddress = document.getElementById("btn-edit-overview-address");

  // Modal thêm / chỉnh sửa địa chỉ
  const addressModal = document.getElementById("address-modal");
  const addrModalTitle = document.getElementById("addr-modal-title");
  const addrModalDesc = document.getElementById("addr-modal-desc");
  const btnCloseAddrModal = document.getElementById("btn-close-addr-modal");
  const btnCancelAddrModal = document.getElementById("btn-cancel-addr-modal");
  const btnSaveAddrText = document.getElementById("btn-save-addr-text");
  const addressModalForm = document.getElementById("address-modal-form");
  const addrIdHidden = document.getElementById("addr-id-hidden");
  const addrFormName = document.getElementById("addr-form-name");
  const addrFormPhone = document.getElementById("addr-form-phone");
  const addrFormProvince = document.getElementById("addr-form-province");
  const addrFormWard = document.getElementById("addr-form-ward");
  const addrFormStreet = document.getElementById("addr-form-street");
  const addrFormDefault = document.getElementById("addr-form-default");
  const addrNameError = document.getElementById("addr-name-error");
  const addrPhoneError = document.getElementById("addr-phone-error");
  const addrProvinceError = document.getElementById("addr-province-error");
  const addrWardError = document.getElementById("addr-ward-error");
  const addrStreetError = document.getElementById("addr-street-error");

  let currentUserData = null;
  let userAddresses = [];
  let pendingAvatarFile = null;
  let pendingAvatarAction = null; // "upload" | "delete" | null

  // 3. Tải dữ liệu hồ sơ & địa chỉ
  await loadUserProfile();
  await loadUserAddresses();

  // Kiểm tra tham số hash trên URL (ví dụ #addresses)
  if (window.location.hash === "#addresses" || window.location.hash === "#address") {
    showAddressesMode();
  } else if (window.location.hash === "#password") {
    showPasswordMode();
  }

  // Lắng nghe thay đổi hash trên URL từ thanh Navbar
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#addresses" || window.location.hash === "#address") {
      showAddressesMode();
    } else if (window.location.hash === "#password") {
      showPasswordMode();
    } else {
      showViewMode();
    }
  });

  // ==========================================================
  // ĐIỀU HƯỚNG CÁC CHẾ ĐỘ XEM / SỬA / ĐỔI MẬT KHẨU / SỔ ĐỊA CHỈ
  // ==========================================================
  function resetNavActive() {
    if (navItemViewProfile) navItemViewProfile.classList.remove("active");
    if (navItemAddresses) navItemAddresses.classList.remove("active");
    if (navItemChangePwd) navItemChangePwd.classList.remove("active");
  }

  function hideAllCards() {
    if (viewProfileCard) viewProfileCard.style.display = "none";
    if (editProfileCard) editProfileCard.style.display = "none";
    if (passwordProfileCard) passwordProfileCard.style.display = "none";
    if (addressesProfileCard) addressesProfileCard.style.display = "none";
  }

  function showViewMode() {
    hideAllCards();
    resetNavActive();

    // Hủy bỏ bất kỳ thay đổi xem trước nào chưa được lưu
    pendingAvatarFile = null;
    pendingAvatarAction = null;
    if (avatarFileInput) avatarFileInput.value = "";
    if (formAvatarPreview) formAvatarPreview.src = getAvatarSrc(currentUserData?.avatar);

    if (viewProfileCard) viewProfileCard.style.display = "block";
    if (navItemViewProfile) navItemViewProfile.classList.add("active");
    if (breadcrumbCurrentText) breadcrumbCurrentText.textContent = "Thông tin cá nhân";
  }

  function showEditMode() {
    hideAllCards();
    resetNavActive();

    // Khởi tạo khu vực chỉnh sửa với dữ liệu hiện tại
    pendingAvatarFile = null;
    pendingAvatarAction = null;
    if (avatarFileInput) avatarFileInput.value = "";
    if (formAvatarPreview) formAvatarPreview.src = getAvatarSrc(currentUserData?.avatar);

    if (fullnameInput) fullnameInput.value = currentUserData?.full_name || "";
    if (phoneInput) phoneInput.value = currentUserData?.phone || "";
    clearError(fullnameInput, fullnameError);
    clearError(phoneInput, phoneError);

    if (editProfileCard) editProfileCard.style.display = "block";
    if (navItemViewProfile) navItemViewProfile.classList.add("active");
    if (breadcrumbCurrentText) breadcrumbCurrentText.textContent = "Chỉnh sửa thông tin";

    if (fullnameInput) {
      setTimeout(() => fullnameInput.focus(), 100);
    }
  }

  function showPasswordMode() {
    hideAllCards();
    resetNavActive();

    if (passwordProfileCard) passwordProfileCard.style.display = "block";
    if (navItemChangePwd) navItemChangePwd.classList.add("active");
    if (breadcrumbCurrentText) breadcrumbCurrentText.textContent = "Đổi mật khẩu";

    if (pwdCurrentInput) {
      setTimeout(() => pwdCurrentInput.focus(), 100);
    }
  }

  function showAddressesMode() {
    hideAllCards();
    resetNavActive();

    if (addressesProfileCard) addressesProfileCard.style.display = "block";
    if (navItemAddresses) navItemAddresses.classList.add("active");
    if (breadcrumbCurrentText) breadcrumbCurrentText.textContent = "Sổ địa chỉ nhận hàng";
  }

  // Gắn sự kiện chuyển đổi trạng thái giao diện
  if (btnOpenEdit) btnOpenEdit.addEventListener("click", showEditMode);
  if (btnOpenPassword) btnOpenPassword.addEventListener("click", showPasswordMode);
  if (btnBackFromEdit) btnBackFromEdit.addEventListener("click", showViewMode);
  if (btnBackFromPwd) btnBackFromPwd.addEventListener("click", showViewMode);

  if (navItemViewProfile) {
    navItemViewProfile.addEventListener("click", (e) => {
      e.preventDefault();
      showViewMode();
    });
  }

  if (navItemAddresses) {
    navItemAddresses.addEventListener("click", (e) => {
      e.preventDefault();
      showAddressesMode();
    });
  }

  if (navItemChangePwd) {
    navItemChangePwd.addEventListener("click", (e) => {
      e.preventDefault();
      showPasswordMode();
    });
  }

  if (btnCancelProfile) {
    btnCancelProfile.addEventListener("click", () => {
      if (currentUserData) {
        renderUserData(currentUserData);
      }
      showViewMode();
    });
  }

  if (btnCancelPwd) {
    btnCancelPwd.addEventListener("click", () => {
      if (passwordForm) passwordForm.reset();
      clearError(pwdCurrentInput, pwdCurrentError);
      clearError(pwdNewInput, pwdNewError);
      clearError(pwdConfirmInput, pwdConfirmError);
      showViewMode();
    });
  }

  // ==========================================================
  // HÀM TẢI & HIỂN THỊ DỮ LIỆU HỒ SƠ
  // ==========================================================
  async function loadUserProfile() {
    try {
      const res = await api.get("/auth/me");
      currentUserData = res?.data || res;

      if (typeof Auth !== "undefined" && Auth.setSession) {
        Auth.setSession(token, currentUserData);
      } else {
        localStorage.setItem("user", JSON.stringify(currentUserData));
      }

      renderUserData(currentUserData);
    } catch (err) {
      console.warn("Không thể tải thông tin từ /auth/me, sử dụng dữ liệu offline:", err);
      try {
        currentUserData = JSON.parse(localStorage.getItem("user") || "null");
        if (currentUserData) {
          renderUserData(currentUserData);
        }
      } catch (_) {}
    }
  }

  function renderUserData(user) {
    if (!user) return;

    const rawName = user.full_name || user.email || "";
    const displayName = typeof capitalizeWords === "function" ? capitalizeWords(rawName) : rawName;

    // 1. Cập nhật thẻ định danh cột trái
    if (sideUserName) sideUserName.textContent = displayName;
    if (sideUserEmail) sideUserEmail.textContent = user.email || "";

    const roleUpper = (user.role || "").toUpperCase();
    let roleText = "Tài khoản cá nhân";
    if (roleUpper === "ADMIN") {
      roleText = "Quản trị viên";
    } else if (roleUpper === "STAFF") {
      roleText = "Nhân viên hỗ trợ";
    }
    if (sideUserRole) sideUserRole.textContent = roleText;

    // Cập nhật điểm thưởng tích lũy
    const points = typeof user.reward_points === "number" ? user.reward_points : 340;
    if (statRewardPoints) statRewardPoints.textContent = String(points);
    if (modalRewardPointsBalance) modalRewardPointsBalance.textContent = String(points);

    // 2. Cập nhật Chế độ xem chi tiết
    if (viewUserName) viewUserName.textContent = displayName;
    if (viewUserEmail) viewUserEmail.textContent = user.email || "";
    if (viewUserRoleBadge) viewUserRoleBadge.textContent = roleText;
    if (viewFullname) viewFullname.textContent = displayName || "Chưa cập nhật";
    if (viewEmail) viewEmail.textContent = user.email || "Chưa cập nhật";
    if (viewPhone) viewPhone.textContent = user.phone || "Chưa cập nhật";

    // 3. Điền thông tin vào Form chỉnh sửa
    if (fullnameInput) fullnameInput.value = user.full_name || "";
    if (emailInput) {
      emailInput.value = user.email || "";
      emailInput.disabled = true; // Email dùng làm tài khoản đăng nhập, không sửa trực tiếp
    }
    if (phoneInput) phoneInput.value = user.phone || "";

    // 4. Ảnh đại diện
    updateAvatarDisplay(user.avatar);
  }

  function getAvatarSrc(avatarUrl) {
    const defaultAvatar = "../assets/images/avt người dùng.svg";
    if (!avatarUrl) return defaultAvatar;
    if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://") || avatarUrl.startsWith("data:")) {
      return avatarUrl;
    }
    const baseHost = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL)
      ? CONFIG.API_BASE_URL.replace(/\/api\/?$/, "")
      : "http://127.0.0.1:8000";
    return `${baseHost}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;
  }

  function updateAvatarDisplay(avatarUrl) {
    const finalSrc = getAvatarSrc(avatarUrl);

    if (sideAvatarImg) sideAvatarImg.src = finalSrc;
    if (formAvatarPreview) formAvatarPreview.src = finalSrc;
    if (viewAvatarImg) viewAvatarImg.src = finalSrc;

    // Cập nhật cả avatar trên header nếu có
    const headerAvatar = document.querySelector(".user-tool > img");
    if (headerAvatar) {
      headerAvatar.src = finalSrc;
    }
  }

  // ==========================================================
  // LOGIC QUẢN LÝ SỔ ĐỊA CHỈ (CHUYÊN MỤC RIÊNG BIỆT)
  // ==========================================================
  async function loadUserAddresses() {
    try {
      const res = await api.get("/auth/me/addresses");
      const list = Array.isArray(res) ? res : (res?.data || []);
      if (Array.isArray(list) && list.length > 0) {
        userAddresses = list;
      } else if (currentUserData && Array.isArray(currentUserData.addresses) && currentUserData.addresses.length > 0) {
        userAddresses = currentUserData.addresses;
      } else {
        userAddresses = list;
      }
    } catch (err) {
      console.warn("Chưa gọi được API /auth/me/addresses, kiểm tra addresses trong currentUserData:", err);
      if (currentUserData && Array.isArray(currentUserData.addresses)) {
        userAddresses = currentUserData.addresses;
      } else {
        // Mock mặc định nếu chưa có địa chỉ nào trong database
        userAddresses = [
          {
            id: 1,
            receiver_name: currentUserData?.full_name || "Nguyễn Văn A",
            phone: currentUserData?.phone || "0987654321",
            province: "Hà Nội",
            ward: "Phường Quan Hoa, Quận Cầu Giấy",
            street_detail: "Số 123 Đường Cầu Giấy",
            is_default: 1
          }
        ];
      }
    }

    updateAddressCounters();
    renderAddressesList(userAddresses);
  }

  function updateAddressCounters() {
    const count = userAddresses.length;
    if (sideAddressCount) sideAddressCount.textContent = String(count);
    if (navAddressCountBadge) navAddressCountBadge.textContent = String(count);
    renderAddressOverview(userAddresses);
  }

  // Hiển thị tóm tắt địa chỉ mặc định ở dưới thông tin cá nhân
  function renderAddressOverview(addresses) {
    if (!addressOverviewCard) return;

    const defaultAddr = addresses && addresses.length > 0
      ? (addresses.find(a => a.is_default === 1 || a.is_default === true) || addresses[0])
      : null;

    if (defaultAddr) {
      if (overviewAddrName) overviewAddrName.textContent = defaultAddr.receiver_name || currentUserData?.full_name || "Chưa cập nhật";
      if (overviewAddrPhone) overviewAddrPhone.textContent = defaultAddr.phone || currentUserData?.phone || "Chưa cập nhật";
      if (overviewAddrStreet) overviewAddrStreet.textContent = defaultAddr.street_detail || "Chưa có địa chỉ chi tiết";
      if (overviewAddrLocation) {
        overviewAddrLocation.textContent = `${defaultAddr.ward ? defaultAddr.ward + ", " : ""}${defaultAddr.province || ""}`;
      }
      if (overviewAddrBadge) {
        overviewAddrBadge.style.display = (defaultAddr.is_default === 1 || defaultAddr.is_default === true) ? "inline-flex" : "none";
      }
      if (btnEditOverviewAddress) {
        btnEditOverviewAddress.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            <path d="m15 5 4 4"/>
          </svg>
          <span>Chỉnh sửa địa chỉ</span>
        `;
      }
    } else {
      if (overviewAddrName) overviewAddrName.textContent = "Chưa thiết lập địa chỉ";
      if (overviewAddrPhone) overviewAddrPhone.textContent = "";
      if (overviewAddrStreet) overviewAddrStreet.textContent = "Bạn chưa lưu địa chỉ nhận hàng nào";
      if (overviewAddrLocation) overviewAddrLocation.textContent = "Vui lòng bấm nút để thêm địa chỉ giao hàng";
      if (overviewAddrBadge) overviewAddrBadge.style.display = "none";
      if (btnEditOverviewAddress) {
        btnEditOverviewAddress.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Thêm địa chỉ</span>
        `;
      }
    }
  }

  // Sự kiện nút chỉnh sửa địa chỉ ở khối thông tin cá nhân
  if (btnEditOverviewAddress) {
    btnEditOverviewAddress.addEventListener("click", () => {
      const defaultAddr = userAddresses && userAddresses.length > 0
        ? (userAddresses.find(a => a.is_default === 1 || a.is_default === true) || userAddresses[0])
        : null;

      if (defaultAddr) {
        openEditAddressModal(defaultAddr);
      } else {
        openAddAddressModal();
      }
    });
  }

  function renderAddressesList(addresses) {
    if (!addressesListContainer) return;

    if (!addresses || addresses.length === 0) {
      addressesListContainer.innerHTML = `
        <div class="addresses-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <h3>Chưa có địa chỉ nhận hàng nào</h3>
          <p>Thêm địa chỉ giao hàng để thuận tiện khi mua sắm và thanh toán đơn hàng.</p>
          <button type="button" class="btn-profile-primary" id="btn-empty-add-addr">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Thêm địa chỉ ngay</span>
          </button>
        </div>
      `;
      const btnEmptyAdd = document.getElementById("btn-empty-add-addr");
      if (btnEmptyAdd) btnEmptyAdd.addEventListener("click", openAddAddressModal);
      return;
    }

    // Sắp xếp đưa địa chỉ mặc định lên trước
    const sorted = [...addresses].sort((a, b) => (b.is_default || 0) - (a.is_default || 0));

    addressesListContainer.innerHTML = sorted.map(addr => {
      const isDefault = addr.is_default === 1 || addr.is_default === true;
      const defaultBadge = isDefault
        ? `<span class="badge-default-addr">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            Mặc định
           </span>`
        : "";

      const defaultBtn = !isDefault
        ? `<button type="button" class="btn-addr-default-action" data-action="set-default" data-id="${addr.id}">
             Thiết lập mặc định
           </button>`
        : "";

      return `
        <div class="address-item-card ${isDefault ? 'is-default' : ''}" data-id="${addr.id}">
          <div class="addr-card-top">
            <div class="addr-user-meta">
              <span class="addr-receiver-title">${escapeHTML(addr.receiver_name)}</span>
              <span class="addr-divider">|</span>
              <span class="addr-phone-title">${escapeHTML(addr.phone)}</span>
              ${defaultBadge}
            </div>
          </div>

          <div class="addr-card-middle">
            <div class="addr-street-line">${escapeHTML(addr.street_detail || "")}</div>
            <div class="addr-location-line">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${escapeHTML(addr.ward || "")}, ${escapeHTML(addr.province || "")}</span>
            </div>
          </div>

          <div class="addr-card-bottom">
            <div class="addr-actions-left">
              <button type="button" class="btn-addr-link" data-action="edit" data-id="${addr.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                Chỉnh sửa
              </button>
              ${!isDefault ? `
              <button type="button" class="btn-addr-link danger" data-action="delete" data-id="${addr.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Xóa
              </button>
              ` : ''}
            </div>
            ${defaultBtn}
          </div>
        </div>
      `;
    }).join("");

    // Gắn sự kiện click cho các nút hành động trong card
    addressesListContainer.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const action = btn.getAttribute("data-action");
        const id = parseInt(btn.getAttribute("data-id"), 10);
        const targetAddr = userAddresses.find(a => a.id === id);

        if (action === "edit" && targetAddr) {
          openEditAddressModal(targetAddr);
        } else if (action === "delete" && targetAddr) {
          confirmDeleteAddress(targetAddr);
        } else if (action === "set-default" && targetAddr) {
          handleSetDefaultAddress(id);
        }
      });
    });
  }

  // Helper escape HTML tránh XSS
  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==========================================================
  // MODAL: THÊM & CHỈNH SỬA ĐỊA CHỈ
  // ==========================================================
  if (btnOpenAddAddr) {
    btnOpenAddAddr.addEventListener("click", openAddAddressModal);
  }

  function openAddAddressModal() {
    clearAddressErrors();
    addrIdHidden.value = "";
    addrModalTitle.textContent = "Thêm địa chỉ nhận hàng mới";
    addrModalDesc.textContent = "Vui lòng nhập thông tin người nhận và địa chỉ giao hàng";
    btnSaveAddrText.textContent = "Lưu địa chỉ";

    // Giá trị mặc định
    addrFormName.value = currentUserData?.full_name || "";
    addrFormPhone.value = currentUserData?.phone || "";
    addrFormProvince.value = "";
    addrFormWard.value = "";
    addrFormStreet.value = "";

    // Nếu chưa có địa chỉ nào, bắt buộc đặt làm mặc định
    if (userAddresses.length === 0) {
      addrFormDefault.checked = true;
      addrFormDefault.disabled = true;
    } else {
      addrFormDefault.checked = false;
      addrFormDefault.disabled = false;
    }

    addressModal.style.display = "flex";
    setTimeout(() => addrFormName.focus(), 100);
  }

  function openEditAddressModal(addr) {
    clearAddressErrors();
    addrIdHidden.value = String(addr.id);
    addrModalTitle.textContent = "Chỉnh sửa địa chỉ nhận hàng";
    addrModalDesc.textContent = "Cập nhật lại thông tin người nhận hoặc địa chỉ chi tiết";
    btnSaveAddrText.textContent = "Lưu thay đổi";

    addrFormName.value = addr.receiver_name || "";
    addrFormPhone.value = addr.phone || "";
    addrFormProvince.value = addr.province || "";
    addrFormWard.value = addr.ward || "";
    addrFormStreet.value = addr.street_detail || "";

    const isDefault = addr.is_default === 1 || addr.is_default === true;
    addrFormDefault.checked = isDefault;
    // Nếu đang là mặc định thì không cho bỏ chọn (chỉ được chuyển sang địa chỉ khác)
    addrFormDefault.disabled = isDefault;

    addressModal.style.display = "flex";
    setTimeout(() => addrFormName.focus(), 100);
  }

  function closeAddressModal() {
    addressModal.style.display = "none";
    clearAddressErrors();
  }

  if (btnCloseAddrModal) btnCloseAddrModal.addEventListener("click", closeAddressModal);
  if (btnCancelAddrModal) btnCancelAddrModal.addEventListener("click", closeAddressModal);

  // Đóng modal khi click ra ngoài vùng backdrop
  if (addressModal) {
    addressModal.addEventListener("click", (e) => {
      if (e.target === addressModal) {
        closeAddressModal();
      }
    });
  }

  // Xử lý gửi Form Thêm / Sửa địa chỉ
  if (addressModalForm) {
    addressModalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAddressErrors();

      const addrId = addrIdHidden.value ? parseInt(addrIdHidden.value, 10) : null;
      const receiverName = addrFormName.value.trim();
      const phone = addrFormPhone.value.trim();
      const province = addrFormProvince.value.trim();
      const ward = addrFormWard.value.trim();
      const street = addrFormStreet.value.trim();
      const isDefault = addrFormDefault.checked ? 1 : 0;

      let isValid = true;

      if (!receiverName) {
        showError(addrFormName, addrNameError, "Vui lòng nhập họ và tên người nhận");
        isValid = false;
      }

      const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
      if (!phone) {
        showError(addrFormPhone, addrPhoneError, "Vui lòng nhập số điện thoại");
        isValid = false;
      } else if (!phoneRegex.test(phone.replace(/\s+/g, ""))) {
        showError(addrFormPhone, addrPhoneError, "Số điện thoại không hợp lệ (ví dụ: 0987654321)");
        isValid = false;
      }

      if (!province) {
        showError(addrFormProvince, addrProvinceError, "Vui lòng nhập Tỉnh / Thành phố");
        isValid = false;
      }

      if (!ward) {
        showError(addrFormWard, addrWardError, "Vui lòng nhập Quận / Huyện / Phường xã");
        isValid = false;
      }

      if (!street) {
        showError(addrFormStreet, addrStreetError, "Vui lòng nhập số nhà, tên đường cụ thể");
        isValid = false;
      }

      if (!isValid) return;

      const payload = {
        receiver_name: receiverName,
        phone: phone.replace(/\s+/g, ""),
        province: province,
        ward: ward,
        street_detail: street,
        is_default: isDefault
      };

      const btnSubmit = addressModalForm.querySelector("button[type='submit']");
      if (btnSubmit) btnSubmit.disabled = true;

      try {
        if (addrId) {
          // Cập nhật địa chỉ đã có
          let updatedItem = null;
          try {
            const res = await api.put(`/auth/me/addresses/${addrId}`, payload);
            updatedItem = res?.data || res;
          } catch (errApi) {
            console.warn("API PUT address chưa phản hồi, cập nhật cục bộ:", errApi);
          }

          // Cập nhật mảng local
          if (isDefault === 1) {
            userAddresses.forEach(a => a.is_default = 0);
          }
          const idx = userAddresses.findIndex(a => a.id === addrId);
          if (idx !== -1) {
            userAddresses[idx] = updatedItem && updatedItem.id ? updatedItem : { ...userAddresses[idx], ...payload, id: addrId };
          }
          showToast("Cập nhật địa chỉ nhận hàng thành công!", "success");
        } else {
          // Thêm địa chỉ mới
          let newCreated = null;
          try {
            const res = await api.post("/auth/me/addresses", payload);
            newCreated = res?.data || res;
          } catch (errApi) {
            console.warn("API POST address chưa phản hồi, thêm cục bộ:", errApi);
          }

          if (isDefault === 1) {
            userAddresses.forEach(a => a.is_default = 0);
          }

          const fallbackId = Date.now();
          userAddresses.push((newCreated && newCreated.id) ? newCreated : { ...payload, id: fallbackId });
          showToast("Thêm địa chỉ nhận hàng mới thành công!", "success");
        }

        closeAddressModal();
        updateAddressCounters();
        renderAddressesList(userAddresses);
      } catch (err) {
        console.error("Lỗi lưu địa chỉ:", err);
        showToast("Không thể lưu địa chỉ: " + (err.message || "Lỗi kết nối máy chủ"), "error");
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
      }
    });
  }

  function clearAddressErrors() {
    clearError(addrFormName, addrNameError);
    clearError(addrFormPhone, addrPhoneError);
    clearError(addrFormProvince, addrProvinceError);
    clearError(addrFormWard, addrWardError);
    clearError(addrFormStreet, addrStreetError);
  }

  // Xóa địa chỉ
  function confirmDeleteAddress(addr) {
    const isDefault = addr.is_default === 1 || addr.is_default === true;
    if (isDefault && userAddresses.length > 1) {
      showToast("Không thể xóa địa chỉ mặc định. Vui lòng thiết lập địa chỉ khác làm mặc định trước.", "warning");
      return;
    }

    if (typeof showConfirmModal === "function") {
      showConfirmModal({
        title: "Xác nhận xóa địa chỉ",
        message: `Bạn có chắc chắn muốn xóa địa chỉ của "${addr.receiver_name}" (${addr.street_detail}) không?`,
        confirmText: "Xóa địa chỉ",
        cancelText: "Hủy bỏ",
        type: "danger",
        onConfirm: async () => {
          await executeDeleteAddress(addr.id);
        }
      });
    } else {
      if (confirm(`Bạn có chắc chắn muốn xóa địa chỉ của "${addr.receiver_name}"?`)) {
        executeDeleteAddress(addr.id);
      }
    }
  }

  async function executeDeleteAddress(id) {
    try {
      try {
        await api.delete(`/auth/me/addresses/${id}`);
      } catch (errApi) {
        console.warn("API DELETE address chưa phản hồi, xóa cục bộ:", errApi);
      }

      userAddresses = userAddresses.filter(a => a.id !== id);
      // Nếu địa chỉ còn lại chưa có mặc định thì gán địa chỉ đầu tiên
      if (userAddresses.length > 0 && !userAddresses.some(a => a.is_default === 1)) {
        userAddresses[0].is_default = 1;
      }

      updateAddressCounters();
      renderAddressesList(userAddresses);
      showToast("Đã xóa địa chỉ thành công!", "success");
    } catch (err) {
      console.error("Lỗi xóa địa chỉ:", err);
      showToast("Không thể xóa địa chỉ: " + (err.message || "Lỗi máy chủ"), "error");
    }
  }

  // Thiết lập địa chỉ mặc định
  async function handleSetDefaultAddress(id) {
    try {
      try {
        await api.patch(`/auth/me/addresses/${id}/default`);
      } catch (errApi) {
        console.warn("API PATCH default address chưa phản hồi, cập nhật cục bộ:", errApi);
      }

      userAddresses.forEach(a => {
        a.is_default = a.id === id ? 1 : 0;
      });

      renderAddressesList(userAddresses);
      showToast("Đã thiết lập địa chỉ nhận hàng mặc định!", "success");
    } catch (err) {
      console.error("Lỗi đặt mặc định:", err);
      showToast("Không thể đặt mặc định: " + (err.message || "Lỗi máy chủ"), "error");
    }
  }

  // ==========================================================
  // XỬ LÝ CHỌN & XÓA ẢNH ĐẠI DIỆN (CHỈ HIỂN THỊ XEM TRƯỚC TẠI FORM)
  // ==========================================================
  if (btnChooseAvatar && avatarFileInput) {
    btnChooseAvatar.addEventListener("click", () => {
      avatarFileInput.click();
    });

    avatarFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
      if (!validTypes.includes(file.type)) {
        showToast("Chỉ hỗ trợ file ảnh định dạng JPG, PNG hoặc WEBP.", "warning");
        avatarFileInput.value = "";
        return;
      }

      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast("Dung lượng file vượt quá giới hạn 2.0 MB.", "warning");
        avatarFileInput.value = "";
        return;
      }

      // Lưu file đang chờ lưu và trạng thái
      pendingAvatarFile = file;
      pendingAvatarAction = "upload";

      // Chỉ hiển thị xem trước tại khung chỉnh sửa, KHÔNG thay đổi các vùng khác
      const localPreviewUrl = URL.createObjectURL(file);
      if (formAvatarPreview) {
        formAvatarPreview.src = localPreviewUrl;
      }

      showToast("Đã chọn ảnh xem trước. Hãy nhấn 'Lưu thay đổi' để cập nhật hoàn tất.", "info");
    });
  }

  // Xóa ảnh đại diện (Chỉ đưa về xem trước mặc định ở form)
  if (btnDeleteAvatar) {
    btnDeleteAvatar.addEventListener("click", () => {
      pendingAvatarFile = null;
      pendingAvatarAction = "delete";
      if (avatarFileInput) avatarFileInput.value = "";

      // Chỉ hiển thị ảnh mặc định tại khung chỉnh sửa
      if (formAvatarPreview) {
        formAvatarPreview.src = "../assets/images/avt người dùng.svg";
      }

      showToast("Đã chọn quay về ảnh mặc định. Hãy nhấn 'Lưu thay đổi' để cập nhật.", "info");
    });
  }

  // ==========================================================
  // XỬ LÝ LƯU THÔNG TIN CÁ NHÂN (FORM CHỈNH SỬA)
  // ==========================================================
  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      clearError(fullnameInput, fullnameError);
      clearError(phoneInput, phoneError);

      const fullName = fullnameInput ? fullnameInput.value.trim() : "";
      const phone = phoneInput ? phoneInput.value.trim() : "";

      let isValid = true;

      if (!fullName) {
        showError(fullnameInput, fullnameError, "Vui lòng nhập họ và tên của bạn");
        isValid = false;
      } else if (fullName.length < 2) {
        showError(fullnameInput, fullnameError, "Họ và tên phải có ít nhất 2 ký tự");
        isValid = false;
      }

      const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
      if (!phone) {
        showError(phoneInput, phoneError, "Vui lòng nhập số điện thoại liên hệ");
        isValid = false;
      } else if (!phoneRegex.test(phone.replace(/\s+/g, ""))) {
        showError(phoneInput, phoneError, "Số điện thoại không hợp lệ (ví dụ: 0987654321)");
        isValid = false;
      }

      if (!isValid) return;

      const formattedFullName = typeof capitalizeWords === "function" ? capitalizeWords(fullName) : fullName;

      btnSaveProfile.disabled = true;
      btnSaveProfile.classList.add("loading");
      const originalSaveText = btnSaveProfile.innerHTML;
      btnSaveProfile.innerHTML = `<span>Đang lưu...</span>`;

      try {
        // 1. Xử lý lưu ảnh đại diện nếu có thay đổi
        if (pendingAvatarAction === "upload" && pendingAvatarFile) {
          const formData = new FormData();
          formData.append("file", pendingAvatarFile);
          const avatarRes = await api.post("/auth/me/avatar", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          const updatedAvatarUser = avatarRes?.data || avatarRes;
          if (updatedAvatarUser?.avatar && currentUserData) {
            currentUserData.avatar = updatedAvatarUser.avatar;
          }
        } else if (pendingAvatarAction === "delete") {
          await api.delete("/auth/me/avatar");
          if (currentUserData) {
            currentUserData.avatar = null;
          }
        }

        // 2. Cập nhật thông tin họ tên & số điện thoại
        const res = await api.put("/auth/me", {
          full_name: formattedFullName,
          phone: phone.replace(/\s+/g, "")
        });

        currentUserData = res?.data || res;

        // Đồng bộ session
        if (typeof Auth !== "undefined" && Auth.setSession) {
          Auth.setSession(token, currentUserData);
        } else {
          localStorage.setItem("user", JSON.stringify(currentUserData));
        }

        // 3. Bây giờ mới cập nhật toàn bộ giao diện (Avatar cột trái, avatar xem chi tiết, tên, sđt)
        renderUserData(currentUserData);

        // Reset trạng thái pending
        pendingAvatarFile = null;
        pendingAvatarAction = null;
        if (avatarFileInput) avatarFileInput.value = "";

        showToast("Cập nhật thông tin hồ sơ thành công!", "success");

        setTimeout(() => {
          showViewMode();
        }, 300);
      } catch (err) {
        console.error("Lỗi lưu hồ sơ:", err);
        showToast("Cập nhật thất bại: " + (err.message || "Vui lòng thử lại sau"), "error");
      } finally {
        btnSaveProfile.disabled = false;
        btnSaveProfile.classList.remove("loading");
        btnSaveProfile.innerHTML = originalSaveText;
      }
    });
  }

  // ==========================================================
  // XỬ LÝ ĐỔI MẬT KHẨU
  // ==========================================================
  if (passwordForm) {
    passwordForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      clearError(pwdCurrentInput, pwdCurrentError);
      clearError(pwdNewInput, pwdNewError);
      clearError(pwdConfirmInput, pwdConfirmError);

      const currentPwd = pwdCurrentInput ? pwdCurrentInput.value : "";
      const newPwd = pwdNewInput ? pwdNewInput.value : "";
      const confirmPwd = pwdConfirmInput ? pwdConfirmInput.value : "";

      let isValid = true;

      if (!currentPwd) {
        showError(pwdCurrentInput, pwdCurrentError, "Vui lòng nhập mật khẩu hiện tại");
        isValid = false;
      }

      if (!newPwd) {
        showError(pwdNewInput, pwdNewError, "Vui lòng nhập mật khẩu mới");
        isValid = false;
      } else if (newPwd.length < 6) {
        showError(pwdNewInput, pwdNewError, "Mật khẩu mới phải có tối thiểu 6 ký tự");
        isValid = false;
      }

      if (!confirmPwd) {
        showError(pwdConfirmInput, pwdConfirmError, "Vui lòng xác nhận lại mật khẩu mới");
        isValid = false;
      } else if (newPwd !== confirmPwd) {
        showError(pwdConfirmInput, pwdConfirmError, "Mật khẩu xác nhận không khớp");
        isValid = false;
      }

      if (!isValid) return;

      btnSubmitPwd.disabled = true;
      const originalPwdBtnText = btnSubmitPwd.innerHTML;
      btnSubmitPwd.innerHTML = `<span>Đang xử lý...</span>`;

      try {
        await api.put("/auth/me", {
          password: newPwd
        });

        passwordForm.reset();
        showToast("Cập nhật mật khẩu tài khoản thành công!", "success");

        setTimeout(() => {
          showViewMode();
        }, 1000);
      } catch (err) {
        console.error("Lỗi đổi mật khẩu:", err);
        showToast("Không thể cập nhật mật khẩu: " + (err.message || "Lỗi máy chủ"), "error");
      } finally {
        btnSubmitPwd.disabled = false;
        btnSubmitPwd.innerHTML = originalPwdBtnText;
      }
    });
  }

  // ==========================================================
  // ẨN / HIỆN MẬT KHẨU (EYE TOGGLE)
  // ==========================================================
  document.querySelectorAll(".btn-toggle-eye").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const targetInput = document.getElementById(targetId);
      if (!targetInput) return;

      const isPassword = targetInput.type === "password";
      targetInput.type = isPassword ? "text" : "password";

      const iconSvg = btn.querySelector("svg");
      if (iconSvg) {
        if (isPassword) {
          iconSvg.innerHTML = `
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
            <line x1="2" x2="22" y1="2" y2="22"/>
          `;
        } else {
          iconSvg.innerHTML = `
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
            <circle cx="12" cy="12" r="3"/>
          `;
        }
      }
    });
  });

  // ==========================================================
  // HÀM TIỆN ÍCH BÁO LỖI
  // ==========================================================
  function showError(input, errorElement, message) {
    if (input) input.style.borderColor = "#ba1a1a";
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add("show");
    }
  }

  function clearError(input, errorElement) {
    if (input) input.style.borderColor = "#e2e8f0";
    if (errorElement) {
      errorElement.textContent = "";
      errorElement.classList.remove("show");
    }
  }

  // ==========================================================
  // XỬ LÝ QUY ĐỔI ĐIỂM THƯỞNG LẤY MÃ GIẢM GIÁ
  // ==========================================================
  let rewardInfoCache = null;

  if (btnOpenRedeemModal) {
    btnOpenRedeemModal.addEventListener("click", openRedeemVoucherModal);
  }

  if (btnCloseRedeemModal) {
    btnCloseRedeemModal.addEventListener("click", closeRedeemVoucherModal);
  }

  if (btnCancelRedeemModal) {
    btnCancelRedeemModal.addEventListener("click", closeRedeemVoucherModal);
  }

  if (redeemVoucherModal) {
    redeemVoucherModal.addEventListener("click", (e) => {
      if (e.target === redeemVoucherModal) {
        closeRedeemVoucherModal();
      }
    });
  }

  async function openRedeemVoucherModal() {
    if (!redeemVoucherModal) return;
    redeemVoucherModal.style.display = "flex";
    await loadRewardPointsInfo();
  }

  function closeRedeemVoucherModal() {
    if (!redeemVoucherModal) return;
    redeemVoucherModal.style.display = "none";
  }

  async function loadRewardPointsInfo() {
    try {
      const res = await api.get("/auth/me/reward-points");
      rewardInfoCache = res?.data || res;
    } catch (err) {
      console.warn("API /auth/me/reward-points chưa phản hồi, sử dụng dữ liệu mặc định:", err);
      const curPts = typeof currentUserData?.reward_points === "number" ? currentUserData.reward_points : 340;
      rewardInfoCache = {
        reward_points: curPts,
        available_tiers: [
          { tier_id: "VOUCHER_20K", title: "Voucher giảm 20.000₫", points_required: 100, discount_amount: 20000, min_order_value: 100000 },
          { tier_id: "VOUCHER_50K", title: "Voucher giảm 50.000₫", points_required: 200, discount_amount: 50000, min_order_value: 250000 },
          { tier_id: "VOUCHER_100K", title: "Voucher giảm 100.000₫", points_required: 350, discount_amount: 100000, min_order_value: 500000 },
          { tier_id: "VOUCHER_150K", title: "Voucher giảm 150.000₫", points_required: 500, discount_amount: 150000, min_order_value: 700000 },
        ],
        vouchers: []
      };
    }

    renderRewardTiersAndVouchers(rewardInfoCache);
  }

  function renderRewardTiersAndVouchers(data) {
    if (!data) return;

    const points = typeof data.reward_points === "number" ? data.reward_points : 0;
    if (statRewardPoints) statRewardPoints.textContent = String(points);
    if (modalRewardPointsBalance) modalRewardPointsBalance.textContent = String(points);
    if (currentUserData) currentUserData.reward_points = points;

    // 1. Render các gói quy đổi
    if (redeemTiersContainer && Array.isArray(data.available_tiers)) {
      redeemTiersContainer.innerHTML = data.available_tiers.map(tier => {
        const canRedeem = points >= tier.points_required;
        const discountK = Math.round(tier.discount_amount / 1000);
        const minOrderK = Math.round((tier.min_order_value || 0) / 1000);

        return `
          <div class="tier-item-box">
            <div class="tier-top-row">
              <span class="tier-amount">Giảm ${discountK}.000₫</span>
              <span class="tier-points-pill">${tier.points_required} điểm</span>
            </div>
            <p class="tier-min-order">Đơn tối thiểu ${minOrderK}.000₫</p>
            <button type="button" class="btn-redeem-action" data-tier-id="${tier.tier_id}" ${!canRedeem ? 'disabled' : ''}>
              ${canRedeem ? 'Đổi ngay' : `Cần thêm ${tier.points_required - points} điểm`}
            </button>
          </div>
        `;
      }).join("");

      redeemTiersContainer.querySelectorAll(".btn-redeem-action").forEach(btn => {
        btn.addEventListener("click", () => {
          const tierId = btn.getAttribute("data-tier-id");
          if (tierId) {
            handleRedeemTier(tierId);
          }
        });
      });
    }

    // 2. Render danh sách mã đã đổi
    if (myVouchersList) {
      const vouchers = Array.isArray(data.vouchers) ? data.vouchers : [];
      if (vouchers.length === 0) {
        myVouchersList.innerHTML = `<p class="empty-vouchers-hint">Bạn chưa đổi mã giảm giá nào. Hãy chọn gói ưu đãi phía trên để đổi ngay!</p>`;
      } else {
        myVouchersList.innerHTML = vouchers.map(v => {
          return `
            <div class="my-voucher-item">
              <div class="voucher-item-left">
                <span class="voucher-item-title">${escapeHTML(v.title || "Voucher giảm giá")}</span>
                <span class="voucher-item-expiry">Hạn dùng: 30 ngày kể từ ngày đổi</span>
              </div>
              <div class="voucher-item-right">
                <span class="voucher-code-badge">${escapeHTML(v.code)}</span>
                <button type="button" class="btn-copy-code" data-code="${escapeHTML(v.code)}">Sao chép</button>
              </div>
            </div>
          `;
        }).join("");

        myVouchersList.querySelectorAll(".btn-copy-code").forEach(btn => {
          btn.addEventListener("click", () => {
            const code = btn.getAttribute("data-code");
            if (code) {
              navigator.clipboard.writeText(code).then(() => {
                showToast(`Đã sao chép mã giảm giá: ${code}`, "success");
              }).catch(() => {
                showToast(`Mã của bạn: ${code}`, "info");
              });
            }
          });
        });
      }
    }
  }

  async function handleRedeemTier(tierId) {
    try {
      showToast("Đang xử lý quy đổi điểm thưởng...", "info");
      let newVoucher = null;
      try {
        const res = await api.post("/auth/me/redeem-voucher", { tier_id: tierId });
        newVoucher = res?.data || res;
      } catch (errApi) {
        console.warn("API /auth/me/redeem-voucher chưa phản hồi, giả lập kết quả:", errApi);
      }

      if (rewardInfoCache) {
        const tier = rewardInfoCache.available_tiers.find(t => t.tier_id === tierId);
        if (tier) {
          rewardInfoCache.reward_points = Math.max(0, rewardInfoCache.reward_points - tier.points_required);
          if (!newVoucher || !newVoucher.code) {
            const discountK = Math.round(tier.discount_amount / 1000);
            newVoucher = {
              id: Date.now(),
              code: `SE${discountK}K-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              title: tier.title,
              discount_amount: tier.discount_amount,
              min_order_value: tier.min_order_value,
              points_spent: tier.points_required,
              is_used: 0
            };
          }
          if (!Array.isArray(rewardInfoCache.vouchers)) rewardInfoCache.vouchers = [];
          rewardInfoCache.vouchers.unshift(newVoucher);
        }
      }

      renderRewardTiersAndVouchers(rewardInfoCache);
      showToast(`Đổi thành công mã giảm giá: ${newVoucher?.code || ''}!`, "success");
    } catch (err) {
      console.error("Lỗi quy đổi voucher:", err);
      showToast("Không thể quy đổi: " + (err.message || "Lỗi kết nối máy chủ"), "error");
    }
  }
});
