// Module gọi API bằng axios: cấu hình 1 lần, mọi trang dùng chung.
// (axios được nạp từ CDN bằng thẻ <script> trong từng trang HTML, trước file này)
//
// Cách dùng (trong các file js/pages/*.js):
//   const items = await api.get("/items");
//   const items = await api.get("/items", { q: "com" });          // -> /items?q=com
//   const created = await api.post("/items", { name: "Trà đá", price: 5000 });
//   await api.put("/items/1", { name: "Tên mới" });
//   await api.delete("/items/1");
//
// Các hàm trả về thẳng dữ liệu JSON (đã lấy sẵn response.data).
// Nếu lỗi, hàm sẽ throw ApiError -> bắt bằng try/catch và hiện error.message cho người dùng.

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status; // mã HTTP: 404, 422, 500... (0 = không gọi được server)
    this.data = data; // nội dung lỗi gốc server trả về
  }
}

// Instance axios dùng chung: mọi request tự nối thêm baseURL phía trước
const http = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: 10000, // quá 10 giây không phản hồi thì báo lỗi
  headers: { "Content-Type": "application/json" },
});

// Tự động gắn token JWT nếu đã đăng nhập (loại bỏ token giả lập demo)
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && token !== "demo-admin-session-token") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Lấy câu thông báo lỗi dễ đọc từ response của FastAPI
function getErrorMessage(data, status) {
  if (data && typeof data.detail === "string") return data.detail;
  // Lỗi 422 (dữ liệu không hợp lệ): detail là mảng [{ loc: [...], msg: "..." }]
  if (data && Array.isArray(data.detail)) {
    return data.detail.map((e) => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join("; ");
  }
  return `Lỗi ${status}`;
}

// Gom xử lý lỗi một chỗ: đổi lỗi của axios thành ApiError dễ dùng
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server có trả lời nhưng là lỗi (4xx, 5xx)
      const { status, data } = error.response;

      // Tự động đăng xuất và chuyển về trang đăng nhập khi nhận lỗi 401 Unauthorized,
      // 404 không tìm thấy thông tin tài khoản, hoặc 403 tài khoản đã bị khóa
      const detailStr = (data && typeof data.detail === "string") ? data.detail : "";
      const isAccountLocked = status === 403 && detailStr.toLowerCase().includes("khóa");
      const isAccountNotFound = (
        status === 401 ||
        isAccountLocked ||
        (status === 404 && (
          detailStr.toLowerCase().includes("không tìm thấy thông tin tài khoản") ||
          detailStr.toLowerCase().includes("tài khoản") ||
          (error.config?.url && error.config.url.includes("/auth/me"))
        ))
      );

      if (isAccountNotFound) {
        const isAuthPage = window.location.pathname.endsWith("/login.html") ||
                           window.location.pathname.endsWith("/register.html");
        const isAdminPage = window.location.pathname.includes("admin-") ||
                            window.location.pathname.includes("customer-management") ||
                            document.body?.dataset?.auth === "admin";
        if (!isAuthPage && !isAdminPage) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          let msg = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
          if (isAccountLocked) {
            msg = "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.";
          } else if (status === 404 || detailStr.toLowerCase().includes("không tìm thấy")) {
            msg = "Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.";
          }
          sessionStorage.setItem("auth_message", msg);

          const root = document.body?.dataset?.root || "./";
          const currentUrl = window.location.pathname + window.location.search;
          window.location.href = `${root}pages/login.html?redirect=${encodeURIComponent(currentUrl)}`;
        }
      }

      return Promise.reject(new ApiError(getErrorMessage(data, status), status, data));
    }
    // Không có response: server tắt, sai URL, bị chặn CORS, hoặc quá thời gian chờ
    return Promise.reject(new ApiError(
      "Không kết nối được backend. Backend đã chạy chưa? Kiểm tra CONFIG.API_BASE_URL.", 0,
    ));
  },
);

const api = {
  get: (path, params, config) => {
    const actualParams = (params && params.params && typeof params.params === "object") ? params.params : params;
    return http.get(path, { params: actualParams, ...config }).then((res) => res.data);
  },
  post: (path, body, config) => http.post(path, body, config).then((res) => res.data),
  put: (path, body, config) => http.put(path, body, config).then((res) => res.data),
  patch: (path, body, config) => http.patch(path, body, config).then((res) => res.data),
  delete: (path, config) => http.delete(path, config).then((res) => res.data),
};
