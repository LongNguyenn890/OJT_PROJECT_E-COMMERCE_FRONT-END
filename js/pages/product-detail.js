// JavaScript logic cho Trang chi tiết sản phẩm (Product Detail Page)
// Kết nối trực tiếp với backend FastAPI (/api/products/{id}, /api/cart/items) và cơ sở dữ liệu MySQL

const asset = (name) => `../assets/images/${encodeURIComponent(name)}`;
const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

const formatPrice = (value) => `${Number(value || 0).toLocaleString("vi-VN")}₫`;

function resolveImageUrl(path) {
  if (!path) return asset("logo_shop.svg");
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  const origin = CONFIG.API_BASE_URL.replace(/\/api\/?$/, "");
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

const detailState = {
  product: null,
  selectedQuantity: 1,
  activeImageIndex: 0,
  imagesList: [],
};

// ==========================================================
// 1. KHỞI TẠO VÀ TẢI THÔNG TIN CHI TIẾT SẢN PHẨM TỪ API
// ==========================================================
async function initProductDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = Number(params.get("id"));

  const loadingBox = document.getElementById("detail-loading-box");
  const errorBox = document.getElementById("detail-error-box");
  const contentBox = document.getElementById("detail-content");

  if (!productId || isNaN(productId)) {
    if (loadingBox) loadingBox.hidden = true;
    if (errorBox) {
      errorBox.hidden = false;
      document.getElementById("error-title").textContent = "Mã sản phẩm không hợp lệ";
      document.getElementById("error-message").textContent = "Đường dẫn không chứa thông tin mã sản phẩm hợp lệ.";
    }
    return;
  }

  try {
    // Gọi API chi tiết sản phẩm
    const product = await api.get(`/products/${productId}`);
    detailState.product = product;

    // Ẩn loading và hiển thị nội dung
    if (loadingBox) loadingBox.hidden = true;
    if (errorBox) errorBox.hidden = true;
    if (contentBox) contentBox.hidden = false;

    // Cập nhật tiêu đề trang
    document.title = `${product.name} | ShopEase`;

    // Render giao diện theo dữ liệu API
    renderProductHeaderAndBreadcrumb(product);
    renderGallery(product);
    renderProductInfo(product);
    renderDetailedTabs(product);
    renderRelatedProducts(product.related_products || []);
    renderRecentlyViewedSection(product.id);
    saveCurrentProductToRecent(product);
    setupEventListeners(product);
  } catch (error) {
    if (loadingBox) loadingBox.hidden = true;
    if (contentBox) contentBox.hidden = true;
    if (errorBox) {
      errorBox.hidden = false;
      document.getElementById("error-title").textContent = "Không thể tải sản phẩm";
      document.getElementById("error-message").textContent =
        error.message || "Sản phẩm không tồn tại, đã bị ẩn hoặc có lỗi kết nối đến máy chủ.";
    }
  }
}

// ==========================================================
// 2. RENDER BREADCRUMB VÀ TIÊU ĐỀ
// ==========================================================
function renderProductHeaderAndBreadcrumb(product) {
  const categoryName = product.category?.name || "Ngành hàng";
  const breadcrumbCat = document.getElementById("breadcrumb-category");
  const breadcrumbName = document.getElementById("breadcrumb-product-name");

  if (breadcrumbCat) {
    breadcrumbCat.textContent = categoryName;
    breadcrumbCat.href = `customer-home.html?category_id=${product.category_id || ""}`;
  }

  if (breadcrumbName) {
    breadcrumbName.textContent = product.name;
    breadcrumbName.title = product.name;
  }

  const catTag = document.getElementById("product-category-tag");
  if (catTag) catTag.textContent = categoryName;

  const titleElem = document.getElementById("product-title");
  if (titleElem) titleElem.textContent = product.name;

  const skuElem = document.getElementById("product-sku");
  if (skuElem) skuElem.textContent = product.sku || "N/A";
}

// ==========================================================
// 3. RENDER BỘ SƯU TẬP ẢNH (GALLERY & THUMBNAILS)
// ==========================================================
function renderGallery(product) {
  const images = (product.product_images && product.product_images.length > 0)
    ? product.product_images.map(img => resolveImageUrl(img.image_url))
    : [asset("logo_shop.svg")];

  detailState.imagesList = images;
  detailState.activeImageIndex = 0;

  const mainImg = document.getElementById("main-product-image");
  if (mainImg) {
    mainImg.src = images[0];
    mainImg.alt = product.name;
  }

  const thumbsContainer = document.getElementById("gallery-thumbs");
  if (!thumbsContainer) return;

  if (images.length <= 1) {
    thumbsContainer.innerHTML = "";
    return;
  }

  thumbsContainer.innerHTML = images.map((url, idx) => `
    <div class="gallery-thumb-item ${idx === 0 ? "active" : ""}" data-index="${idx}">
      <img src="${escapeHTML(url)}" alt="Ảnh thu nhỏ ${idx + 1}" loading="lazy" onerror="this.src='${asset("logo_shop.svg")}'">
    </div>
  `).join("");

  // Bắt sự kiện chọn ảnh thu nhỏ
  thumbsContainer.querySelectorAll(".gallery-thumb-item").forEach(item => {
    item.addEventListener("click", () => {
      const idx = Number(item.dataset.index);
      switchMainImage(idx);
    });
  });
}

function switchMainImage(index) {
  if (index < 0 || index >= detailState.imagesList.length) return;
  detailState.activeImageIndex = index;

  const mainImg = document.getElementById("main-product-image");
  if (mainImg) {
    mainImg.style.opacity = "0.4";
    setTimeout(() => {
      mainImg.src = detailState.imagesList[index];
      mainImg.style.opacity = "1";
    }, 150);
  }

  document.querySelectorAll(".gallery-thumb-item").forEach((thumb, idx) => {
    thumb.classList.toggle("active", idx === index);
  });
}

// ==========================================================
// 4. RENDER THÔNG TIN GIÁ, TỒN KHO VÀ ĐẶC ĐIỂM
// ==========================================================
function renderProductInfo(product) {
  const price = Number(product.price || 0);
  const promoPrice = product.promotional_price ? Number(product.promotional_price) : null;
  const hasPromo = promoPrice !== null && promoPrice < price;

  const currentPriceElem = document.getElementById("product-current-price");
  const originalPriceElem = document.getElementById("product-original-price");
  const discountPillElem = document.getElementById("product-discount-pill");
  const galleryDiscountElem = document.getElementById("gallery-discount-badge");
  const saveTipElem = document.getElementById("product-save-tip");
  const saveTextElem = document.getElementById("product-save-text");

  if (hasPromo) {
    const discountPercent = Math.round((1 - promoPrice / price) * 100);
    const savedAmount = price - promoPrice;

    if (currentPriceElem) currentPriceElem.textContent = formatPrice(promoPrice);
    if (originalPriceElem) {
      originalPriceElem.hidden = false;
      originalPriceElem.textContent = formatPrice(price);
    }
    if (discountPillElem) {
      discountPillElem.hidden = false;
      discountPillElem.textContent = `-${discountPercent}%`;
    }
    if (galleryDiscountElem) {
      galleryDiscountElem.hidden = false;
      galleryDiscountElem.textContent = `-${discountPercent}%`;
    }
    if (saveTipElem && saveTextElem) {
      saveTipElem.hidden = false;
      saveTextElem.textContent = `Tiết kiệm ${formatPrice(savedAmount)} khi mua ngay`;
    }
  } else {
    if (currentPriceElem) currentPriceElem.textContent = formatPrice(price);
    if (originalPriceElem) originalPriceElem.hidden = true;
    if (discountPillElem) discountPillElem.hidden = true;
    if (galleryDiscountElem) galleryDiscountElem.hidden = true;
    if (saveTipElem) saveTipElem.hidden = true;
  }

  // Tình trạng kho: Chỉ báo "Còn hàng" hoặc "Hết hàng" (không hiện số lượng)
  const stock = Number(product.stock_quantity || 0);
  const stockBadge = document.getElementById("stock-status-badge");
  const stockText = document.getElementById("stock-status-text");
  const galleryStockBadge = document.getElementById("gallery-stock-badge");
  const qtyInput = document.getElementById("qty-input");
  const qtyPlus = document.getElementById("qty-plus");
  const qtyMinus = document.getElementById("qty-minus");
  const btnAddToCart = document.getElementById("btn-add-to-cart");
  const btnBuyNow = document.getElementById("btn-buy-now");

  if (stock > 0) {
    if (stockBadge) {
      stockBadge.className = "stock-badge in-stock";
      if (stockText) stockText.textContent = "Còn hàng";
    }
    if (galleryStockBadge) {
      galleryStockBadge.textContent = "Còn hàng";
      galleryStockBadge.style.color = "var(--pd-green)";
    }
    if (qtyInput) {
      qtyInput.max = stock;
      qtyInput.value = 1;
      qtyInput.disabled = false;
    }
    if (qtyPlus) qtyPlus.disabled = false;
    if (qtyMinus) qtyMinus.disabled = false;
    if (btnAddToCart) btnAddToCart.disabled = false;
    if (btnBuyNow) btnBuyNow.disabled = false;
  } else {
    if (stockBadge) {
      stockBadge.className = "stock-badge out-of-stock";
      if (stockText) stockText.textContent = "Hết hàng";
    }
    if (galleryStockBadge) {
      galleryStockBadge.textContent = "Hết hàng";
      galleryStockBadge.style.color = "var(--pd-red)";
    }
    if (qtyInput) {
      qtyInput.value = 0;
      qtyInput.disabled = true;
    }
    if (qtyPlus) qtyPlus.disabled = true;
    if (qtyMinus) qtyMinus.disabled = true;
    if (btnAddToCart) {
      btnAddToCart.disabled = true;
      btnAddToCart.querySelector("span").textContent = "Tạm hết hàng";
    }
    if (btnBuyNow) {
      btnBuyNow.disabled = true;
      btnBuyNow.querySelector("span").textContent = "Hết hàng";
    }
  }

  // Tóm tắt ngắn
  const shortDescElem = document.getElementById("product-short-desc");
  if (shortDescElem) {
    shortDescElem.textContent = product.description
      ? product.description.split("\n")[0]
      : "Sản phẩm chất lượng cao, chính hãng được phân phối và bảo hành trực tiếp bởi ShopEase.";
  }
}

// ==========================================================
// 5. RENDER NỘI DUNG TABS (MÔ TẢ, THÔNG SỐ)
// ==========================================================
function renderDetailedTabs(product) {
  // Tab Mô tả chi tiết
  const descElem = document.getElementById("product-detailed-description");
  if (descElem) {
    if (product.description && product.description.trim()) {
      const paragraphs = product.description.split("\n").filter(p => p.trim());
      descElem.innerHTML = paragraphs.map(p => `<p>${escapeHTML(p)}</p>`).join("");
    } else {
      descElem.innerHTML = `
        <p><strong>${escapeHTML(product.name)}</strong> là sản phẩm được thiết kế hiện đại, đạt tiêu chuẩn chất lượng cao nhằm mang lại trải nghiệm tối ưu cho người sử dụng.</p>
        <h3>Đặc điểm nổi bật:</h3>
        <ul>
          <li>Vật liệu bền bỉ, gia công sắc nét từng chi tiết.</li>
          <li>Hiệu năng hoạt động ổn định, êm ái và tiết kiệm năng lượng.</li>
          <li>Bảo hành chính hãng toàn diện, hỗ trợ kỹ thuật 24/7.</li>
        </ul>
      `;
    }
  }

  // Tab Thông số kỹ thuật
  const specSku = document.getElementById("spec-sku");
  const specCat = document.getElementById("spec-category");
  const specStock = document.getElementById("spec-stock");

  if (specSku) specSku.textContent = product.sku || "N/A";
  if (specCat) specCat.textContent = product.category?.name || "Ngành hàng";
  // Chỉ hiện Còn hàng hoặc Hết hàng, không hiển thị số lượng tồn kho
  if (specStock) specStock.textContent = Number(product.stock_quantity || 0) > 0 ? "Còn hàng" : "Hết hàng";
}

// ==========================================================
// 6. RENDER SẢN PHẨM LIÊN QUAN / TƯƠNG TỰ
// ==========================================================
function renderRelatedProducts(related) {
  const section = document.getElementById("related-products-section");
  const grid = document.getElementById("related-products-grid");

  if (!section || !grid) return;

  if (!related || related.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  grid.innerHTML = related.slice(0, 4).map(item => {
    const hasPromo = item.promotional_price && Number(item.promotional_price) < Number(item.price);
    const primaryImg = (item.product_images && item.product_images.length > 0)
      ? resolveImageUrl(item.product_images[0].image_url)
      : asset("logo_shop.svg");
    const catName = item.category?.name || "Sản phẩm";

    return `
      <article class="product-card">
        <div class="product-photo" style="cursor: pointer;" onclick="window.location.href='product-detail.html?id=${item.id}'">
          <span class="product-tag">${escapeHTML(catName)}</span>
          <img src="${escapeHTML(primaryImg)}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.src='${asset("logo_shop.svg")}'">
        </div>
        <div class="product-info">
          <h3 title="${escapeHTML(item.name)}" style="cursor: pointer;" onclick="window.location.href='product-detail.html?id=${item.id}'">${escapeHTML(item.name)}</h3>
          <p class="product-desc" title="${escapeHTML(item.description || "")}">${escapeHTML(item.description || "Sản phẩm chính hãng.")}</p>
          <strong class="product-price">
            ${formatPrice(item.promotional_price || item.price)}
            ${hasPromo ? `<del class="product-old-price">${formatPrice(item.price)}</del>` : ""}
          </strong>
          <div class="product-actions">
            <button class="light-button" type="button" onclick="window.location.href='product-detail.html?id=${item.id}'">
              <img src="${asset("chi tiết.svg")}" alt=""> Xem chi tiết
            </button>
            <button class="blue-button" type="button" onclick="addRelatedToCart(${item.id}, this)">
              <img src="${asset("thêm giỏ hàng.svg")}" alt=""> <span class="action-label">Thêm giỏ</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

// ==========================================================
// 6.2. SẢN PHẨM ĐÃ XEM GẦN ĐÂY (LOCALSTORAGE)
// ==========================================================
function saveCurrentProductToRecent(product) {
  if (!product || !product.id) return;
  try {
    const KEY = "shopease_recently_viewed";
    let list = JSON.parse(localStorage.getItem(KEY) || "[]");
    list = list.filter(item => item.id !== product.id);
    const primaryImg = (product.product_images && product.product_images.length > 0)
      ? product.product_images[0].image_url
      : "";
    list.unshift({
      id: product.id,
      name: product.name,
      price: product.price,
      promotional_price: product.promotional_price,
      image_url: primaryImg,
      category_name: product.category?.name || "Sản phẩm",
      viewed_at: new Date().toISOString()
    });
    if (list.length > 12) list = list.slice(0, 12);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Could not save recently viewed:", e);
  }
}

function renderRecentlyViewedSection(currentProductId) {
  const section = document.getElementById("recent-viewed-section");
  const grid = document.getElementById("recent-viewed-grid");
  const clearBtn = document.getElementById("btn-clear-recent-detail");

  if (!section || !grid) return;

  try {
    const KEY = "shopease_recently_viewed";
    let list = JSON.parse(localStorage.getItem(KEY) || "[]");
    const otherProducts = list.filter(item => item.id !== currentProductId);

    if (otherProducts.length === 0) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    grid.innerHTML = otherProducts.slice(0, 4).map(item => {
      const hasPromo = item.promotional_price && Number(item.promotional_price) < Number(item.price);
      const imgUrl = resolveImageUrl(item.image_url);
      return `
        <article class="product-card">
          <div class="product-photo" style="cursor: pointer;" onclick="window.location.href='product-detail.html?id=${item.id}'">
            <span class="product-tag">${escapeHTML(item.category_name || "Sản phẩm")}</span>
            <img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.src='${asset("logo_shop.svg")}'">
          </div>
          <div class="product-info">
            <h3 title="${escapeHTML(item.name)}" style="cursor: pointer;" onclick="window.location.href='product-detail.html?id=${item.id}'">${escapeHTML(item.name)}</h3>
            <strong class="product-price">
              ${formatPrice(item.promotional_price || item.price)}
              ${hasPromo ? `<del class="product-old-price">${formatPrice(item.price)}</del>` : ""}
            </strong>
            <div class="product-actions">
              <button class="light-button" type="button" onclick="window.location.href='product-detail.html?id=${item.id}'">
                <img src="${asset("chi tiết.svg")}" alt=""> Xem chi tiết
              </button>
              <button class="blue-button" type="button" onclick="addRelatedToCart(${item.id}, this)">
                <img src="${asset("thêm giỏ hàng.svg")}" alt=""> <span class="action-label">Thêm giỏ</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    clearBtn?.addEventListener("click", () => {
      localStorage.removeItem(KEY);
      section.hidden = true;
      showToast("Đã xóa lịch sử sản phẩm đã xem", "info");
    });
  } catch (e) {
    section.hidden = true;
  }
}

// Thêm nhanh sản phẩm liên quan vào giỏ hàng
window.addRelatedToCart = async function (productId, button) {
  const token = localStorage.getItem("token");
  if (!token) {
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent(currentUrl)}`;
    return;
  }

  const originalHtml = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span>Đang thêm…</span>`;

  try {
    await api.post("/cart/items", {
      product_id: productId,
      quantity: 1,
    });
    showToast("Đã thêm sản phẩm vào giỏ hàng!", "success");
    if (typeof window.refreshCartCount === "function") {
      window.refreshCartCount();
    }
  } catch (error) {
    showToast(`Không thể thêm vào giỏ: ${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = originalHtml;
  }
};

// ==========================================================
// 7. XỬ LÝ SỰ KIỆN: TĂNG GIẢM SỐ LƯỢNG, MUA HÀNG, TABS
// ==========================================================
function setupEventListeners(product) {
  const qtyInput = document.getElementById("qty-input");
  const qtyMinus = document.getElementById("qty-minus");
  const qtyPlus = document.getElementById("qty-plus");
  const btnAddToCart = document.getElementById("btn-add-to-cart");
  const btnBuyNow = document.getElementById("btn-buy-now");
  const maxStock = Number(product.stock_quantity || 0);

  // Nút trừ số lượng
  qtyMinus?.addEventListener("click", () => {
    let current = Number(qtyInput.value) || 1;
    if (current > 1) {
      qtyInput.value = current - 1;
      detailState.selectedQuantity = current - 1;
    }
  });

  // Nút cộng số lượng
  qtyPlus?.addEventListener("click", () => {
    let current = Number(qtyInput.value) || 1;
    if (current < maxStock) {
      qtyInput.value = current + 1;
      detailState.selectedQuantity = current + 1;
    } else {
      showToast("Đã đạt số lượng tối đa có thể đặt", "warning");
    }
  });

  // Người dùng nhập trực tiếp số lượng
  qtyInput?.addEventListener("change", () => {
    let val = parseInt(qtyInput.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > maxStock) {
      val = maxStock;
      showToast("Số lượng đặt mua vượt quá giới hạn cho phép", "warning");
    }
    qtyInput.value = val;
    detailState.selectedQuantity = val;
  });

  // Nút "Thêm vào giỏ hàng"
  btnAddToCart?.addEventListener("click", async () => {
    await executeAddToCart(product.id, false);
  });

  // Nút "Mua ngay"
  btnBuyNow?.addEventListener("click", async () => {
    await executeAddToCart(product.id, true);
  });

  // Sự kiện nhấp vào ảnh chính hoặc nút phóng to để mở Pop-up Lightbox
  const mainViewport = document.getElementById("gallery-main-viewport");
  const zoomBtn = document.getElementById("gallery-zoom-btn");

  mainViewport?.addEventListener("click", (e) => {
    // Không kích hoạt khi bấm vào các badge đè lên
    if (e.target.closest(".gallery-badge")) return;
    openLightbox(detailState.activeImageIndex || 0);
  });

  zoomBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openLightbox(detailState.activeImageIndex || 0);
  });

  // Tab switching
  document.querySelectorAll(".tab-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;
      document.querySelectorAll(".tab-nav-btn").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      const targetPane = document.getElementById(targetTab);
      if (targetPane) targetPane.classList.add("active");
    });
  });

  // Khởi tạo các sự kiện cho Lightbox Popup
  setupLightboxEvents();
}

// ==========================================================
// 8. LOGIC POP-UP PHÓNG TO ẢNH (IMAGE LIGHTBOX MODAL)
// ==========================================================
let currentLightboxIndex = 0;

function openLightbox(index = 0) {
  const modal = document.getElementById("image-lightbox-modal");
  if (!modal) return;

  const images = detailState.imagesList || [];
  if (images.length === 0) return;

  currentLightboxIndex = (index >= 0 && index < images.length) ? index : 0;

  // Cập nhật tiêu đề sản phẩm trong pop-up
  const titleElem = document.getElementById("lightbox-product-title");
  if (titleElem && detailState.product) {
    titleElem.textContent = detailState.product.name;
  }

  // Render thumbnails bên trong lightbox
  renderLightboxThumbnails(images);

  // Hiển thị ảnh đang chọn
  switchLightboxImage(currentLightboxIndex);

  // Mở modal và khóa cuộn trang
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const modal = document.getElementById("image-lightbox-modal");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

function switchLightboxImage(index) {
  const images = detailState.imagesList || [];
  if (index < 0 || index >= images.length) return;

  currentLightboxIndex = index;
  const mainImg = document.getElementById("lightbox-main-img");
  const counter = document.getElementById("lightbox-counter");
  const prevBtn = document.getElementById("lightbox-prev-btn");
  const nextBtn = document.getElementById("lightbox-next-btn");

  if (mainImg) {
    mainImg.style.opacity = "0.3";
    mainImg.style.transform = "scale(0.96)";
    setTimeout(() => {
      mainImg.src = images[index];
      mainImg.style.opacity = "1";
      mainImg.style.transform = "scale(1)";
    }, 120);
  }

  if (counter) {
    counter.textContent = `Ảnh ${index + 1} / ${images.length}`;
  }

  // Cập nhật trạng thái thumbnails trong lightbox
  document.querySelectorAll(".lightbox-thumb-item").forEach((thumb, i) => {
    thumb.classList.toggle("active", i === index);
  });

  // Cập nhật trạng thái nút Prev / Next
  if (prevBtn) prevBtn.disabled = images.length <= 1;
  if (nextBtn) nextBtn.disabled = images.length <= 1;
}

function renderLightboxThumbnails(images) {
  const thumbsWrap = document.getElementById("lightbox-thumbs");
  if (!thumbsWrap) return;

  if (images.length <= 1) {
    thumbsWrap.style.display = "none";
    return;
  }

  thumbsWrap.style.display = "flex";
  thumbsWrap.innerHTML = images.map((url, idx) => `
    <div class="lightbox-thumb-item ${idx === currentLightboxIndex ? "active" : ""}" data-lb-index="${idx}">
      <img src="${escapeHTML(url)}" alt="Thu nhỏ ${idx + 1}" loading="lazy">
    </div>
  `).join("");

  thumbsWrap.querySelectorAll(".lightbox-thumb-item").forEach(item => {
    item.addEventListener("click", () => {
      const idx = Number(item.dataset.lbIndex);
      switchLightboxImage(idx);
    });
  });
}

function setupLightboxEvents() {
  const modal = document.getElementById("image-lightbox-modal");
  const backdrop = document.getElementById("lightbox-backdrop");
  const closeBtn = document.getElementById("lightbox-close-btn");
  const prevBtn = document.getElementById("lightbox-prev-btn");
  const nextBtn = document.getElementById("lightbox-next-btn");

  // Đóng modal khi bấm nền tối hoặc nút đóng
  backdrop?.addEventListener("click", closeLightbox);
  closeBtn?.addEventListener("click", closeLightbox);

  // Chuyển ảnh trước / sau
  prevBtn?.addEventListener("click", () => {
    const images = detailState.imagesList || [];
    if (images.length <= 1) return;
    const newIdx = (currentLightboxIndex - 1 + images.length) % images.length;
    switchLightboxImage(newIdx);
  });

  nextBtn?.addEventListener("click", () => {
    const images = detailState.imagesList || [];
    if (images.length <= 1) return;
    const newIdx = (currentLightboxIndex + 1) % images.length;
    switchLightboxImage(newIdx);
  });

  // Điều hướng bằng bàn phím (Phím ESC để đóng, Phím mũi tên Trái/Phải để chuyển ảnh)
  window.addEventListener("keydown", (e) => {
    if (!modal || modal.hidden) return;
    if (e.key === "Escape") {
      closeLightbox();
    } else if (e.key === "ArrowLeft") {
      prevBtn?.click();
    } else if (e.key === "ArrowRight") {
      nextBtn?.click();
    }
  });
}

// Xử lý gửi request Thêm vào giỏ hàng qua API
async function executeAddToCart(productId, isBuyNow = false) {
  const token = localStorage.getItem("token");
  if (!token) {
    sessionStorage.setItem("auth_message", "Vui lòng đăng nhập để tiến hành mua hàng.");
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent(currentUrl)}`;
    return;
  }

  const qtyInput = document.getElementById("qty-input");
  const quantity = Number(qtyInput ? qtyInput.value : 1) || 1;
  const btn = isBuyNow ? document.getElementById("btn-buy-now") : document.getElementById("btn-add-to-cart");

  const originalText = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>Đang xử lý…</span>`;
  }

  try {
    await api.post("/cart/items", {
      product_id: productId,
      quantity: quantity,
    });

    if (typeof window.refreshCartCount === "function") {
      await window.refreshCartCount();
    }

    if (isBuyNow) {
      showToast("Đã thêm vào giỏ! Đang chuyển hướng đến giỏ hàng…", "success");
      setTimeout(() => {
        window.location.href = "my_orders.html";
      }, 600);
    } else {
      showToast(`Đã thêm ${quantity} sản phẩm vào giỏ hàng thành công!`, "success");
    }
  } catch (error) {
    showToast(`Không thể thêm vào giỏ hàng: ${error.message}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// Khởi chạy khi tài liệu HTML sẵn sàng
document.addEventListener("DOMContentLoaded", () => {
  initProductDetailPage();
});
