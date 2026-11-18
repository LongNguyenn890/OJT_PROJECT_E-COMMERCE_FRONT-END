// Dữ liệu cửa hàng demo. Lần đầu mở trang sẽ khởi tạo vào localStorage.
const PRODUCT_KEY = "shopease_demo_products_v1";
const CART_KEY = "shopease_demo_cart_v1";
const categories = ["Công nghệ", "Thời trang", "Đồ gia dụng", "Đồ chơi & Trẻ", "Quà tặng", "Dã ngoại"];
const categoryIcons = ["công nghệ.svg", "thời trang.svg", "đồ gia dụng.svg", "balo và túi.svg", "quà tặng.svg", "dã ngoại.svg"];
const seedProducts = [
  {id:1,name:"Bàn phím cơ TKL Red Switch Wireless",category:"Công nghệ",price:1250000,image:"https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=700&q=85",tag:"Bán chạy"},
  {id:2,name:"Tai nghe Chống Ồn Over-ear ANC Pro",category:"Công nghệ",price:2180000,image:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=85",tag:"Mới"},
  {id:3,name:"Áo thun Cotton Organic Cao Cấp",category:"Thời trang",price:290000,image:"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=85",tag:""},
  {id:4,name:"Bình giữ nhiệt Inox 304 800ml",category:"Đồ gia dụng",price:245000,image:"https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=700&q=85",tag:""},
  {id:5,name:"Balo Laptop 15.6” Kháng nước",category:"Thời trang",price:750000,image:"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=85",tag:""},
  {id:6,name:"Chuột Gaming Không dây Precision",category:"Công nghệ",price:690000,image:"https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=700&q=85",tag:"Bán chạy"},
  {id:7,name:"Đèn Bàn LED Chống cận thông minh",category:"Đồ gia dụng",price:420000,image:"https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=700&q=85",tag:""},
  {id:8,name:"Cáp sạc nhanh Type-C 100W Bọc dù",category:"Công nghệ",price:180000,image:"https://images.unsplash.com/photo-1615526675159-e248c3021d3f?auto=format&fit=crop&w=700&q=85",tag:""},
  {id:9,name:"Áo khoác nỉ Everyday",category:"Thời trang",price:520000,image:"https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=700&q=85",tag:"Mới"},
  {id:10,name:"Loa Bluetooth Mini",category:"Công nghệ",price:890000,image:"https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=700&q=85",tag:""},
  {id:11,name:"Bình hoa gốm trang trí",category:"Đồ gia dụng",price:350000,image:"https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=700&q=85",tag:""},
  {id:12,name:"Ví da tối giản",category:"Thời trang",price:640000,image:"https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=700&q=85",tag:""}
];
let products = JSON.parse(localStorage.getItem(PRODUCT_KEY) || "null") || seedProducts;
if (!localStorage.getItem(PRODUCT_KEY)) localStorage.setItem(PRODUCT_KEY, JSON.stringify(products));
let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
let selectedCategory = "Tất cả", priceRange = "all", page = 1;
const pageSize = 8;
const money = n => `${Number(n).toLocaleString("vi-VN")}₫`;
const safe = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function renderCategories() {
  document.getElementById("category-list").innerHTML = categories.map((c,i)=>`<button class="category-card" data-category="${safe(c)}"><span class="category-icon tone-${i}"><img src="../assets/images/${encodeURIComponent(categoryIcons[i])}" alt=""></span><strong>${safe(c)}</strong></button>`).join("");
  document.getElementById("category-filters").innerHTML = ["Tất cả", ...categories].map(c=>`<button class="chip ${selectedCategory===c?"active":""}" data-category="${safe(c)}">${safe(c)}</button>`).join("");
}
function visibleProducts() {
  const q = (document.getElementById("shop-search")?.value || "").trim().toLocaleLowerCase("vi");
  let list = products.filter(p => (selectedCategory === "Tất cả" || p.category === selectedCategory) && (!q || p.name.toLocaleLowerCase("vi").includes(q)));
  list = list.filter(p => priceRange === "all" || (priceRange === "under1" && p.price < 500000) || (priceRange === "500to1" && p.price >= 500000 && p.price < 1000000) || (priceRange === "1to2" && p.price >= 1000000 && p.price <= 2000000) || (priceRange === "over2" && p.price > 2000000));
  const sort = document.getElementById("sort-select").value;
  if (sort === "price-asc") list.sort((a,b)=>a.price-b.price); if (sort === "price-desc") list.sort((a,b)=>b.price-a.price); if (sort === "name") list.sort((a,b)=>a.name.localeCompare(b.name,"vi"));
  return list;
}
function renderProducts() {
  const list = visibleProducts(), pages = Math.max(1,Math.ceil(list.length/pageSize)); page = Math.min(page,pages);
  const shown = list.slice((page-1)*pageSize,page*pageSize);
  document.getElementById("product-grid").innerHTML = shown.length ? shown.map(p=>`<article class="product-card"><div class="product-photo"><img src="${safe(p.image)}" alt="${safe(p.name)}" loading="lazy">${p.tag?`<span class="product-tag">${safe(p.tag)}</span>`:""}</div><div class="product-info"><h3>${safe(p.name)}</h3><strong class="product-price">${money(p.price)}</strong><div class="product-actions"><button class="light-button" data-action="details" data-id="${p.id}"><img src="../assets/images/chi tiết.svg" alt=""> Xem chi tiết</button><button class="blue-button" data-action="cart" data-id="${p.id}"><img src="../assets/images/thêm giỏ hàng.svg" alt=""> <span class="action-label">Thêm giỏ</span></button></div></div></article>`).join("") : `<div class="no-products">Không tìm thấy sản phẩm phù hợp.</div>`;
  document.getElementById("page-summary").textContent = `Trang ${page} / ${pages}`;
  document.getElementById("pagination").innerHTML = `<button ${page===1?"disabled":""} data-page="${page-1}">‹ Trước</button>${Array.from({length:pages},(_,i)=>`<button class="${page===i+1?"active":""}" data-page="${i+1}">${i+1}</button>`).join("")}<button ${page===pages?"disabled":""} data-page="${page+1}">Tiếp ›</button>`;
}
function saveCart(){localStorage.setItem(CART_KEY,JSON.stringify(cart)); updateCartBadge();}
function updateCartBadge(){const b=document.getElementById("cart-count");if(b)b.textContent=cart.reduce((s,x)=>s+x.qty,0);}
renderCategories();
document.getElementById("category-list").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(b){selectedCategory=b.dataset.category;page=1;renderCategories();renderProducts();document.getElementById("products").scrollIntoView({behavior:"smooth"});}});
document.getElementById("category-filters").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(b){selectedCategory=b.dataset.category;page=1;renderCategories();renderProducts();}});
document.getElementById("price-filters").addEventListener("click",e=>{const b=e.target.closest("[data-price]");if(b){priceRange=b.dataset.price;page=1;document.querySelectorAll("#price-filters .chip").forEach(x=>x.classList.toggle("active",x===b));renderProducts();}});
document.getElementById("sort-select").addEventListener("change",renderProducts);
document.getElementById("shop-search").addEventListener("input",()=>{page=1;renderProducts();});
document.getElementById("search-submit").addEventListener("click",()=>{document.getElementById("products").scrollIntoView({behavior:"smooth"});});
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();document.getElementById("shop-search").focus();}});
document.getElementById("pagination").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b){page=Number(b.dataset.page);renderProducts();}});
document.getElementById("product-grid").addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b)return;const p=products.find(x=>x.id===Number(b.dataset.id));if(b.dataset.action==="cart"){const row=cart.find(x=>x.id===p.id);row?row.qty++:cart.push({id:p.id,qty:1});saveCart();const label=b.querySelector(".action-label");if(label){label.textContent="Đã thêm";setTimeout(()=>label.textContent="Thêm giỏ",900);}}else alert(`${p.name}\nGiá: ${money(p.price)}\nDanh mục: ${p.category}`);});
renderProducts();
