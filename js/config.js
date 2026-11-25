// Cấu hình chung của frontend.
// Tự động nhận diện môi trường:
// - Nếu chạy local (Live Server / localhost / 127.0.0.1 / file:): dùng backend local
// - Nếu chạy trên Vercel hoặc server online: dùng backend production
const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.protocol === "file:");

const CONFIG = {
  API_BASE_URL: isLocal
    ? "http://127.0.0.1:8000/api"
    : "https://shopcasebackend-nu.vercel.app/api",
  APP_NAME: "ShopEase",
};
