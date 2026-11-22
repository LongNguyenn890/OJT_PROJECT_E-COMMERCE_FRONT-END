/**
 * Controller cho Trang Danh sách sản phẩm yêu thích (Wishlist Page)
 * Đồng bộ với Wishlist module, hỗ trợ tìm kiếm, sắp xếp, xóa từng món,
 * xóa tất cả và thêm trực tiếp vào giỏ hàng.
 */
(function () {
  "use strict";

  const state = {
    keyword: "",
    sort: "latest"
  };

  const gridElem = document.getElementById("wishlist-grid");
  const emptyElem = document.getElementById("wishlist-empty");
  const toolbarElem = document.getElementById("wishlist-toolbar");
  const actionsElem = document.getElementById("wishlist-header-actions");
  const searchInput = document.getElementById("wishlist-search");
  const sortSelect = document.getElementById("wishlist-sort");
  const btnClearAll = document.getElementById("btn-clear-wishlist");
  const btnAddAllCart = document.getElementById("btn-add-all-cart");

  function asset(path) {
    return `../assets/images/${path}`;
  }

  function resolveImageUrl(url) {
    if (!url) return asset("logo_shop.svg");
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
      return url;
    }
    const cleanUrl = url.replace(/^\/?(static\/|media\/)?/, "");
    const base = (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL)
      ? CONFIG.API_BASE_URL.replace(/\/api\/?$/, "")
      : "";
    return `${base}/static/${cleanUrl}`;
  }

  function formatPrice(val) {
    if (typeof window.formatPrice === "function") return window.formatPrice(val);
    const num = Number(val) || 0;
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  }

  function escapeHTML(str) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(str);
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function filterAndSortItems(items) {
    let result = [...items];

    // Lọc theo từ khóa tìm kiếm
    if (state.keyword) {
      const q = state.keyword.toLowerCase();
      result = result.filter(item => {
        const nameMatch = (item.name || "").toLowerCase().includes(q);
        const catMatch = (item.category_name || "").toLowerCase().includes(q);
        const descMatch = (item.short_description || "").toLowerCase().includes(q);
        return nameMatch || catMatch || descMatch;
      });
    }

    // Sắp xếp
    if (state.sort === "price-asc") {
      result.sort((a, b) => {
        const pa = (a.promotional_price !== null && a.promotional_price !== undefined) ? Number(a.promotional_price) : Number(a.price);
        const pb = (b.promotional_price !== null && b.promotional_price !== undefined) ? Number(b.promotional_price) : Number(b.price);
        return pa - pb;
      });
    } else if (state.sort === "price-desc") {
      result.sort((a, b) => {
        const pa = (a.promotional_price !== null && a.promotional_price !== undefined) ? Number(a.promotional_price) : Number(a.price);
        const pb = (b.promotional_price !== null && b.promotional_price !== undefined) ? Number(b.promotional_price) : Number(b.price);
        return pb - pa;
      });
    } else if (state.sort === "name") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));
    } else {
      // Mới lưu gần nhất (mặc định)
      result.sort((a, b) => {
        const ta = a.added_at ? new Date(a.added_at).getTime() : 0;
        const tb = b.added_at ? new Date(b.added_at).getTime() : 0;
        return tb - ta;
      });
    }

    return result;
  }

  function renderWishlist() {
    if (typeof Wishlist === "undefined") return;
    const allItems = Wishlist.getItems();
    Wishlist.updateBadges();

    // Trường hợp hoàn toàn không có sản phẩm nào được lưu
    if (allItems.length === 0) {
      if (gridElem) {
        gridElem.innerHTML = "";
        gridElem.hidden = true;
        gridElem.style.display = "none";
      }
      if (emptyElem) {
        emptyElem.hidden = false;
        emptyElem.style.display = "flex";
      }
      if (toolbarElem) {
        toolbarElem.hidden = true;
        toolbarElem.style.display = "none";
      }
      if (actionsElem) {
        actionsElem.hidden = true;
        actionsElem.style.display = "none";
      }
      return;
    }

    if (emptyElem) {
      emptyElem.hidden = true;
      emptyElem.style.display = "none";
    }
    if (gridElem) {
      gridElem.hidden = false;
      gridElem.style.display = "grid";
    }
    if (toolbarElem) {
      toolbarElem.hidden = false;
      toolbarElem.style.display = "flex";
    }
    if (actionsElem) {
      actionsElem.hidden = false;
      actionsElem.style.display = "flex";
    }

    const filteredItems = filterAndSortItems(allItems);

    if (filteredItems.length === 0) {
      gridElem.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px 16px; text-align: center; background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" style="margin-bottom: 8px;">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #1e293b;">Không tìm thấy sản phẩm nào khớp với "${escapeHTML(state.keyword)}"</p>
          <small>Vui lòng thử tìm kiếm bằng từ khóa hoặc ngành hàng khác</small>
        </div>
      `;
      return;
    }

    gridElem.innerHTML = filteredItems.map(item => {
      const hasPromo = item.promotional_price !== null &&
                       item.promotional_price !== undefined &&
                       Number(item.promotional_price) >= 0 &&
                       Number(item.promotional_price) < Number(item.price);
      const displayPrice = hasPromo ? Number(item.promotional_price) : Number(item.price);
      const img = resolveImageUrl(item.image_url);
      const catName = item.category_name || "Sản phẩm";
      const shortDesc = item.short_description || "Sản phẩm chất lượng cao chính hãng.";

      return `
        <article class="wishlist-card" data-id="${item.id}">
          <div class="wishlist-card-photo" onclick="if (!event.target.closest('.wishlist-remove-btn')) window.location.href='product-detail.html?id=${item.id}'">
            <span class="wishlist-card-tag">${escapeHTML(catName)}</span>
            <button type="button" class="wishlist-remove-btn" data-action="remove" data-id="${item.id}" aria-label="Bỏ khỏi yêu thích" title="Bỏ khỏi danh sách yêu thích">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <img src="${escapeHTML(img)}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.src='${asset("logo_shop.svg")}'">
          </div>
          <div class="wishlist-card-body">
            <h3 class="wishlist-card-title" title="${escapeHTML(item.name)}" onclick="window.location.href='product-detail.html?id=${item.id}'">
              ${escapeHTML(item.name)}
            </h3>
            <p class="wishlist-card-desc" title="${escapeHTML(shortDesc)}">
              ${escapeHTML(shortDesc)}
            </p>
            <div class="wishlist-card-price-box">
              <strong class="wishlist-price-current">${formatPrice(displayPrice)}</strong>
              ${hasPromo ? `<del class="wishlist-price-old">${formatPrice(item.price)}</del>` : ""}
            </div>
            <div class="wishlist-card-actions">
              <a href="product-detail.html?id=${item.id}" class="wl-btn-details">
                <img src="${asset("chi tiết.svg")}" alt="" style="width: 14px; height: 14px;">
                <span>Chi tiết</span>
              </a>
              <button type="button" class="wl-btn-cart" data-action="cart" data-id="${item.id}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="8" cy="21" r="1"></circle>
                  <circle cx="19" cy="21" r="1"></circle>
                  <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
                </svg>
                <span>Thêm giỏ</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  // Thêm một sản phẩm vào giỏ hàng
  async function handleAddToCart(productId, button) {
    const token = localStorage.getItem("token");
    if (!token) {
      if (typeof showToast === "function") {
        showToast("Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!", "info");
      }
      setTimeout(() => {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }, 700);
      return;
    }

    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span>Đang thêm…</span>`;

    try {
      if (typeof api !== "undefined" && api.post) {
        await api.post("/cart/items", { product_id: Number(productId), quantity: 1 });
      }
      if (typeof showToast === "function") {
        showToast("Đã thêm sản phẩm vào giỏ hàng!", "success");
      }
      if (typeof window.refreshCartCount === "function") {
        await window.refreshCartCount();
      }
    } catch (err) {
      if (typeof showToast === "function") {
        showToast(`Thêm vào giỏ thất bại: ${err.message || err}`, "error");
      }
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  }

  // Thêm tất cả sản phẩm đang có vào giỏ hàng
  async function handleAddAllToCart() {
    if (typeof Wishlist === "undefined") return;
    const items = Wishlist.getItems();
    if (items.length === 0) return;

    const token = localStorage.getItem("token");
    if (!token) {
      if (typeof showToast === "function") {
        showToast("Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!", "info");
      }
      setTimeout(() => {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }, 700);
      return;
    }

    if (!btnAddAllCart) return;
    const originalText = btnAddAllCart.innerHTML;
    btnAddAllCart.disabled = true;
    btnAddAllCart.innerHTML = `<span>Đang thêm toàn bộ (${items.length})…</span>`;

    let successCount = 0;
    try {
      for (const item of items) {
        try {
          if (typeof api !== "undefined" && api.post) {
            await api.post("/cart/items", { product_id: Number(item.id), quantity: 1 });
            successCount++;
          }
        } catch (_) {}
      }

      if (successCount > 0) {
        if (typeof showToast === "function") {
          showToast(`Đã thêm thành công ${successCount} sản phẩm vào giỏ hàng!`, "success");
        }
        if (typeof window.refreshCartCount === "function") {
          await window.refreshCartCount();
        }
      } else {
        if (typeof showToast === "function") {
          showToast("Không thể thêm sản phẩm vào giỏ hàng, vui lòng thử lại!", "error");
        }
      }
    } finally {
      btnAddAllCart.disabled = false;
      btnAddAllCart.innerHTML = originalText;
    }
  }

  // Xóa toàn bộ danh sách yêu thích
  function handleClearAll() {
    if (typeof Wishlist === "undefined") return;
    const items = Wishlist.getItems();
    if (items.length === 0) return;

    if (typeof showConfirmModal === "function") {
      showConfirmModal({
        title: "Xác nhận xóa danh sách yêu thích",
        message: `Bạn có chắc chắn muốn xóa toàn bộ ${items.length} sản phẩm khỏi danh sách yêu thích không?`,
        confirmText: "Xóa tất cả",
        cancelText: "Hủy bỏ",
        type: "danger",
        onConfirm: () => {
          Wishlist.clear();
          renderWishlist();
        }
      });
    } else if (confirm(`Bạn có chắc chắn muốn xóa tất cả ${items.length} sản phẩm yêu thích không?`)) {
      Wishlist.clear();
      renderWishlist();
    }
  }

  function initWishlistPage() {
    renderWishlist();

    // Sự kiện trên Grid sản phẩm
    gridElem?.addEventListener("click", (e) => {
      const removeBtn = e.target.closest('[data-action="remove"]');
      if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(removeBtn.dataset.id);
        if (typeof Wishlist !== "undefined") {
          Wishlist.remove(id);
          renderWishlist();
        }
        return;
      }

      const cartBtn = e.target.closest('[data-action="cart"]');
      if (cartBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(cartBtn.dataset.id);
        handleAddToCart(id, cartBtn);
        return;
      }
    });

    // Thêm tất cả vào giỏ
    btnAddAllCart?.addEventListener("click", handleAddAllToCart);

    // Xóa tất cả
    btnClearAll?.addEventListener("click", handleClearAll);

    // Tìm kiếm
    let debounceTimer = null;
    searchInput?.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.keyword = (e.target.value || "").trim();
        renderWishlist();
      }, 200);
    });

    // Sắp xếp
    sortSelect?.addEventListener("change", (e) => {
      state.sort = e.target.value;
      renderWishlist();
    });

    // Lắng nghe cập nhật từ Wishlist
    window.addEventListener("wishlist:updated", () => {
      renderWishlist();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWishlistPage);
  } else {
    initWishlistPage();
  }
})();
