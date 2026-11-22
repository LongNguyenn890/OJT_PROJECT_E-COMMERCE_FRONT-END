/**
 * Wishlist Module for ShopEase
 * Quản lý danh sách sản phẩm yêu thích cho cả Khách vãng lai và Thành viên đã đăng nhập.
 * Đồng bộ trạng thái tức thì trên toàn bộ hệ thống qua localStorage và CustomEvent.
 */
(function (window) {
  "use strict";

  const GUEST_KEY = "shopease_wishlist_guest";

  function getUser() {
    try {
      if (typeof Auth !== "undefined" && typeof Auth.getUser === "function") {
        const u = Auth.getUser();
        if (u) return u;
      }
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function getStorageKey() {
    const user = getUser();
    return user && user.id ? `shopease_wishlist_user_${user.id}` : GUEST_KEY;
  }

  // Tự động gộp danh sách yêu thích của khách vào tài khoản khi vừa đăng nhập
  function migrateGuestWishlistIfLoggedIn() {
    const user = getUser();
    if (!user || !user.id) return;
    const userKey = `shopease_wishlist_user_${user.id}`;
    try {
      const guestRaw = localStorage.getItem(GUEST_KEY);
      if (!guestRaw) return;
      const guestItems = JSON.parse(guestRaw);
      if (Array.isArray(guestItems) && guestItems.length > 0) {
        const userItems = JSON.parse(localStorage.getItem(userKey) || "[]");
        const existingIds = new Set(userItems.map(item => String(item.id)));
        guestItems.forEach(item => {
          if (!existingIds.has(String(item.id))) {
            userItems.push(item);
            existingIds.add(String(item.id));
          }
        });
        localStorage.setItem(userKey, JSON.stringify(userItems));
        localStorage.removeItem(GUEST_KEY);
      }
    } catch (e) {
      console.warn("Wishlist migration warning:", e);
    }
  }

  const Wishlist = {
    init() {
      migrateGuestWishlistIfLoggedIn();
      this.updateBadges();
      this.syncButtons();

      // Lắng nghe thay đổi giữa các tab trình duyệt
      window.addEventListener("storage", (e) => {
        if (e.key && e.key.startsWith("shopease_wishlist_")) {
          this.updateBadges();
          this.syncButtons();
          window.dispatchEvent(new CustomEvent("wishlist:updated"));
        }
      });
    },

    getItems() {
      migrateGuestWishlistIfLoggedIn();
      const key = getStorageKey();
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.error("Error reading wishlist:", e);
        return [];
      }
    },

    setItems(items) {
      const key = getStorageKey();
      try {
        localStorage.setItem(key, JSON.stringify(items || []));
      } catch (e) {
        console.error("Error writing wishlist:", e);
      }
      this.updateBadges();
      this.syncButtons();
      window.dispatchEvent(new CustomEvent("wishlist:updated", { detail: { count: (items || []).length, items } }));
    },

    count() {
      return this.getItems().length;
    },

    isWishlisted(productId) {
      if (productId === undefined || productId === null) return false;
      const pid = String(productId);
      const items = this.getItems();
      return items.some(item => String(item.id) === pid);
    },

    add(product, options = {}) {
      if (!product || product.id === undefined || product.id === null) return false;
      const items = this.getItems();
      const pid = String(product.id);
      if (items.some(item => String(item.id) === pid)) {
        if (!options.silent && typeof showToast === "function") {
          showToast("Sản phẩm đã có trong danh sách yêu thích!", "info");
        }
        return false;
      }

      const newItem = {
        id: Number(product.id),
        name: product.name || "Sản phẩm",
        price: Number(product.price) || 0,
        promotional_price: (product.promotional_price !== null && product.promotional_price !== undefined && Number(product.promotional_price) >= 0)
          ? Number(product.promotional_price)
          : null,
        image_url: product.image_url || product.primary_image || "",
        category_name: product.category_name || (product.category && product.category.name) || "",
        short_description: product.short_description || product.description || "",
        stock_quantity: product.stock_quantity !== undefined ? Number(product.stock_quantity) : null,
        added_at: new Date().toISOString()
      };

      items.unshift(newItem);
      this.setItems(items);

      if (!options.silent && typeof showToast === "function") {
        showToast("Đã lưu vào danh sách yêu thích!", "success");
      }
      return true;
    },

    remove(productId, options = {}) {
      if (productId === undefined || productId === null) return false;
      const pid = String(productId);
      const items = this.getItems();
      const filtered = items.filter(item => String(item.id) !== pid);
      if (filtered.length === items.length) return false;

      this.setItems(filtered);

      if (!options.silent && typeof showToast === "function") {
        showToast("Đã bỏ khỏi danh sách yêu thích!", "info");
      }
      return true;
    },

    toggle(product, options = {}) {
      if (!product || product.id === undefined || product.id === null) return false;
      if (this.isWishlisted(product.id)) {
        this.remove(product.id, options);
        return false;
      } else {
        this.add(product, options);
        return true;
      }
    },

    clear(options = {}) {
      this.setItems([]);
      if (!options.silent && typeof showToast === "function") {
        showToast("Đã xóa toàn bộ danh sách yêu thích!", "info");
      }
    },

    updateBadges() {
      const c = this.count();
      const countElem = document.getElementById("wishlist-count");
      const countLabelElem = document.getElementById("wishlist-count-label");
      const pageCountElem = document.getElementById("wishlist-page-count");

      if (countElem) {
        countElem.textContent = c;
        countElem.style.display = c > 0 ? "inline-flex" : "none";
      }
      if (countLabelElem) {
        countLabelElem.textContent = `${c} sản phẩm`;
      }
      if (pageCountElem) {
        pageCountElem.textContent = `${c} sản phẩm`;
      }
    },

    syncButtons() {
      const buttons = document.querySelectorAll(".product-wishlist-btn[data-id], .product-wishlist-btn[data-product-id]");
      buttons.forEach(btn => {
        const id = btn.dataset.id || btn.dataset.productId;
        const active = this.isWishlisted(id);
        if (active) {
          btn.classList.add("active");
          btn.setAttribute("title", "Bỏ yêu thích");
          btn.setAttribute("aria-label", "Bỏ yêu thích");
        } else {
          btn.classList.remove("active");
          btn.setAttribute("title", "Lưu vào yêu thích");
          btn.setAttribute("aria-label", "Lưu vào yêu thích");
        }
      });

      // Đồng bộ nút ở trang chi tiết sản phẩm nếu có
      const detailBtn = document.getElementById("btn-wishlist-toggle");
      const detailText = document.getElementById("btn-wishlist-text");
      if (detailBtn && detailBtn.dataset.productId) {
        const active = this.isWishlisted(detailBtn.dataset.productId);
        if (active) {
          detailBtn.classList.add("active");
          if (detailText) detailText.textContent = "Đã yêu thích";
          detailBtn.setAttribute("title", "Bỏ khỏi danh sách yêu thích");
        } else {
          detailBtn.classList.remove("active");
          if (detailText) detailText.textContent = "Yêu thích";
          detailBtn.setAttribute("title", "Lưu vào danh sách yêu thích");
        }
      }
    }
  };

  window.Wishlist = Wishlist;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Wishlist.init());
  } else {
    Wishlist.init();
  }
})(window);
