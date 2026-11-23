/* ==========================================================
   SHOPEASE - THỐNG KÊ & BÁO CÁO (reports.js)
   Cấu trúc:
     1. Cấu hình + icon + tiện ích
     2. Dữ liệu mẫu (sản phẩm) và bộ sinh báo cáo theo kỳ
     3. Render: KPI, biểu đồ cột, donut, bảng Top sản phẩm
     4. Bộ lọc kỳ báo cáo + sự kiện
   Khi nối backend: thay hàm buildReport() và PRODUCTS bằng API.
   ========================================================== */
(() => {
  'use strict';

  /* ---------- 1. CẤU HÌNH + TIỆN ÍCH ---------- */

  // Ngày "hôm nay" của báo cáo. Thiết kế dùng 28/03/2026 -> đổi thành new Date() khi chạy thật.
  const REF_DATE = new Date(2026, 2, 28);
  const DAY = 86400000;
  const PAGE_SIZE = 5;

  const ICONS = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
    banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
    trendUp: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    trendDown: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
    truck: '<path d="M10 17h4V5H2v12h3M14 9h4l4 4v4h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>'
  };
  const icon = (n, s = 16) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const hydrateIcons = () => document.querySelectorAll('[data-icon]').forEach((el) => { if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon); });

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const removeAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

  const fmtDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const fmtISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const daysBetween = (a, b) => Math.round((b - a) / DAY) + 1;
  const sameDay = (a, b) => fmtISO(a) === fmtISO(b);

  const fmtNum = (n) => Math.round(n).toLocaleString('vi-VN');
  const fmtMoney = (n) => fmtNum(n) + ' đ';
  const fmtShort = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M đ' : Math.round(v / 1e3) + 'K đ');
  const fmtAxis = (t) => (t === 0 ? '0' : t >= 1e6 ? +(t / 1e6).toFixed(2) + 'M' : +(t / 1e3).toFixed(1) + 'K');

  const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const hash = (str) => [...str].reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 7);

  function toast(title, message = '', type = 'success') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<div class="toast-body"><b>${esc(title)}</b>${message ? `<span>${esc(message)}</span>` : ''}</div>`;
    $('#toast-container').appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-show'));
    setTimeout(() => { el.classList.remove('toast-show'); el.classList.add('toast-leave'); setTimeout(() => el.remove(), 350); }, 3200);
  }

  /* ---------- 2. DỮ LIỆU MẪU ---------- */

  // Trạng thái đơn hàng (thứ tự = thứ tự hiển thị trong donut)
  const STATUSES = [
    { key: 'done', label: 'Hoàn thành (hạch toán)', color: 'var(--st-done)', pct: 73.7 },
    { key: 'ship', label: 'Đang giao (chờ đối soát)', color: 'var(--st-ship)', pct: 13.2 },
    { key: 'conf', label: 'Đã xác nhận (đang đóng gói)', color: 'var(--st-conf)', pct: 7.0 },
    { key: 'pend', label: 'Chờ xác nhận', color: 'var(--st-pend)', pct: 3.2 },
    { key: 'canc', label: 'Đã hủy', color: 'var(--st-canc)', pct: 2.9 }
  ];

  const CATEGORIES = ['Thời trang nam', 'Thời trang nữ', 'Đồ công nghệ', 'Gia dụng', 'Phụ kiện', 'Mỹ phẩm'];
  const EMOJI = { 'Thời trang nam': '👕', 'Thời trang nữ': '👗', 'Đồ công nghệ': '🔌', 'Gia dụng': '🍳', 'Phụ kiện': '👜', 'Mỹ phẩm': '💄' };

  // 5 sản phẩm Top đúng theo thiết kế. Có ảnh thật thì thêm trường image: 'assets/...jpg'
  const FIXED = [
    { code: 'SP-COT-092', name: 'Áo thun Cotton Organic', attr: 'Màu: Đen, Trắng • Size: M, L', cat: 'Thời trang nam', price: 290000, qty: 128, stock: 3, emoji: '👕' },
    { code: 'SP-KEY-711', name: 'Bàn phím cơ Không dây TKL', attr: 'Switch: Red Linear • Bluetooth 5.2', cat: 'Đồ công nghệ', price: 1250000, qty: 76, stock: 2, emoji: '⌨️' },
    { code: 'SP-BTL-104', name: 'Bình giữ nhiệt Inox 800ml', attr: 'Inox 316 an toàn • Giữ nhiệt 24h', cat: 'Gia dụng', price: 245000, qty: 64, stock: 8, emoji: '🍶' },
    { code: 'SP-BAG-302', name: 'Balo Laptop 15.6" Kháng nước', attr: 'Vải Oxford trượt nước • Ngăn chống sốc', cat: 'Phụ kiện', price: 750000, qty: 45, stock: 42, emoji: '🎒' },
    { code: 'SP-AUD-501', name: 'Tai nghe Chống ồn Over-ear', attr: 'ANC chủ động • Pin 40 giờ sạc nhanh', cat: 'Đồ công nghệ', price: 2180000, qty: 32, stock: 5, emoji: '🎧' }
  ];

  // 43 sản phẩm còn lại (tổng 48 SKU) - [tên, thuộc tính, giá]
  const GEN = {
    'Thời trang nam': [
      ['Quần jeans Slim-fit', 'Xanh đậm • Size 29-34', 520000], ['Áo sơ mi Oxford', 'Trắng • Size M-XL', 390000],
      ['Áo khoác Bomber', 'Đen • Chống gió nhẹ', 690000], ['Quần kaki Chinos', 'Be • Co giãn 4 chiều', 450000],
      ['Áo polo Pique', 'Navy • Size M-XL', 320000], ['Quần short Thể thao', 'Xám • Thoáng khí', 210000],
      ['Áo hoodie Nỉ bông', 'Xám tro • Form rộng', 480000], ['Giày sneaker Canvas', 'Trắng • Size 39-43', 560000]
    ],
    'Thời trang nữ': [
      ['Váy midi Hoa nhí', 'Kem • Size S-L', 420000], ['Áo kiểu Voan', 'Hồng • Size S-M', 280000],
      ['Chân váy Chữ A', 'Đen • Lưng cao', 310000], ['Áo len Cổ lọ', 'Be • Len mềm', 380000],
      ['Quần culottes', 'Nâu • Ống rộng', 360000], ['Đầm suông Linen', 'Xanh mint • Thoáng mát', 520000],
      ['Áo khoác Cardigan', 'Xám • Mỏng nhẹ', 340000], ['Áo thun Baby tee', 'Trắng • Cotton 100%', 190000]
    ],
    'Đồ công nghệ': [
      ['Chuột không dây Silent', 'Đen • 2.4GHz • Pin 12 tháng', 350000], ['Sạc nhanh GaN 65W', '2 cổng USB-C', 690000],
      ['Loa Bluetooth Mini', 'Chống nước IPX7', 890000], ['Webcam Full HD 1080p', 'Mic kép • Autofocus', 780000],
      ['Pin dự phòng 20.000mAh', 'Sạc nhanh 22.5W', 560000], ['Cáp USB-C bện dù 2m', 'Bền • 100W', 150000],
      ['Hub USB-C 7 cổng', 'HDMI 4K • Thẻ SD', 920000], ['Đèn bàn LED Thông minh', '3 chế độ • Cảm ứng', 430000]
    ],
    'Gia dụng': [
      ['Ly giữ nhiệt 500ml', 'Inox 304 • Giữ nhiệt 12h', 189000], ['Nồi chiên không dầu 5L', 'Điều khiển cảm ứng', 1590000],
      ['Bộ dao bếp 5 món', 'Thép không gỉ', 650000], ['Máy xay sinh tố Mini', '350W • 2 cối', 790000],
      ['Ấm đun siêu tốc 1.8L', 'Inox • Tự ngắt', 360000], ['Hộp cơm văn phòng', 'Chia ngăn • Dùng lò vi sóng', 170000],
      ['Chảo chống dính 28cm', 'Đáy từ • Chống dính', 330000], ['Máy hút bụi Cầm tay', 'Pin 40 phút', 1890000]
    ],
    'Phụ kiện': [
      ['Ví da Nam Bi-fold', 'Nâu • Da bò thật', 420000], ['Thắt lưng Da cao cấp', 'Đen • Khóa tự động', 380000],
      ['Kính râm Chống UV400', 'Gọng kim loại', 290000], ['Mũ lưỡi trai Cotton', 'Đen • Free size', 150000],
      ['Ốp lưng iPhone Trong suốt', 'Chống sốc', 120000], ['Dây đeo Đồng hồ Silicone', '22mm • Nhiều màu', 160000]
    ],
    'Mỹ phẩm': [
      ['Kem chống nắng SPF50+', '50ml • Không cồn', 260000], ['Sữa rửa mặt Dịu nhẹ', '150ml • pH 5.5', 180000],
      ['Serum Vitamin C 10%', '30ml • Sáng da', 390000], ['Son dưỡng Có màu', 'Hồng đào • 4g', 140000],
      ['Mặt nạ Đất sét', '100g • Kiểm soát dầu', 210000]
    ]
  };

  function buildProducts() {
    const r = rng(39);
    const gen = [];
    Object.entries(GEN).forEach(([cat, list]) => list.forEach(([name, attr, price]) => gen.push({ name, attr, cat, price, emoji: EMOJI[cat] })));

    // xáo trộn có seed rồi gán số lượng giảm dần (≤ 31 để luôn thấp hơn 5 sản phẩm Top)
    for (let i = gen.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [gen[i], gen[j]] = [gen[j], gen[i]]; }
    gen.forEach((g, i) => {
      g.qty = Math.max(4, Math.round(30 - i * 0.6 + (r() * 2 - 1)));
      const v = r();
      g.stock = v < 0.12 ? Math.floor(r() * 4) : v < 0.35 ? 4 + Math.floor(r() * 7) : 11 + Math.floor(r() * 50);
      const key = removeAccents(g.name.split(' ')[1] || g.name).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
      g.code = `SP-${key}-${100 + Math.floor(r() * 899)}`;
    });
    return [...FIXED, ...gen].sort((a, b) => b.qty - a.qty);
  }
  const PRODUCTS = buildProducts(); // 48 SKU

  /* ----- Bộ sinh báo cáo theo kỳ ----- */

  // Phân bổ đơn theo tỷ lệ trạng thái (phương pháp phần dư lớn nhất để tổng luôn đúng)
  function splitOrders(total) {
    const raw = STATUSES.map((s) => (total * s.pct) / 100);
    const out = raw.map(Math.floor);
    let left = total - out.reduce((a, b) => a + b, 0);
    raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) out[i]++; });
    return out;
  }

  function labelRange(a, b) {
    return a.getMonth() === b.getMonth()
      ? `${pad(a.getDate())}-${pad(b.getDate())}/${pad(a.getMonth() + 1)}`
      : `${pad(a.getDate())}/${pad(a.getMonth() + 1)}-${pad(b.getDate())}/${pad(b.getMonth() + 1)}`;
  }

  // Chia doanh thu thành các cột: theo giờ (1 ngày), theo ngày (≤ 7 ngày), theo tuần (dài hơn)
  function buildBars(start, n, total, r) {
    let parts, weights;
    if (n === 1) {
      parts = ['00-06h', '06-12h', '12-18h', '18-24h'].map((label) => ({ label }));
      weights = [0.08, 0.3, 0.34, 0.28];
    } else if (n <= 7) {
      parts = Array.from({ length: n }, (_, i) => { const d = addDays(start, i); return { label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` }; });
      weights = parts.map(() => 0.7 + r() * 0.6);
    } else {
      const base = Math.floor(n / 4), extra = n % 4;
      let cursor = 0;
      parts = Array.from({ length: 4 }, (_, i) => {
        const size = base + (i < extra ? 1 : 0);
        const a = addDays(start, cursor), b = addDays(start, cursor + size - 1);
        cursor += size;
        return { label: labelRange(a, b), size };
      });
      weights = parts.map((p) => p.size * (0.75 + r() * 0.5));
    }
    const sum = weights.reduce((a, b) => a + b, 0);
    const values = weights.map((w) => Math.round((total * w) / sum / 1000) * 1000);
    values[values.length - 1] += total - values.reduce((a, b) => a + b, 0);
    const peak = values.indexOf(Math.max(...values));
    return parts.map((p, i) => ({ label: p.label, value: values[i], peak: i === peak }));
  }

  /** Dữ liệu báo cáo đúng như ảnh thiết kế (Tháng 3/2026) */
  function monthReport(start, end) {
    return {
      n: 28, revenue: 148650000, orders: 342, counts: [252, 45, 24, 11, 10], items: 518,
      deltas: { rev: 18.4, ord: 12.5, aov: 5.2 },
      compare: 'so với kỳ trước (T2/2026)',
      peakLabel: 'Tuần đỉnh doanh số', ordersWord: `tháng ${start.getMonth() + 1}/${start.getFullYear()}`,
      bars: [
        { label: '01-07/03', value: 28.4e6 }, { label: '08-14/03', value: 34.2e6 },
        { label: '15-21/03', value: 44.8e6, peak: true }, { label: '22-28/03', value: 41.2e6 }
      ],
      start, end
    };
  }

  /** Báo cáo cho một khoảng ngày bất kỳ (dữ liệu mô phỏng, ổn định theo khoảng ngày) */
  function buildReport(key, start, end) {
    if (key === 'month') return monthReport(start, end);

    const n = daysBetween(start, end);
    const r = rng(hash(`${fmtISO(start)}|${n}`));
    const revenue = Math.round(((148650000 / 28) * n * (0.88 + r() * 0.24)) / 1000) * 1000;
    const orders = Math.max(4, Math.round((342 / 28) * n * (0.88 + r() * 0.24)));
    const counts = splitOrders(orders);
    const items = Math.round((orders * 518 / 342) * (0.95 + r() * 0.1));
    const delta = () => Math.round((r() * 28 - 6) * 10) / 10;

    let compare = 'so với kỳ trước';
    if (key === 'lastMonth') compare = `so với kỳ trước (T${start.getMonth() === 0 ? 12 : start.getMonth()}/${start.getMonth() === 0 ? start.getFullYear() - 1 : start.getFullYear()})`;

    const bars = buildBars(start, n, revenue, r);
    bars.forEach((b) => { if (b.peak) b.label += ''; });
    return {
      n, revenue, orders, counts, items,
      deltas: { rev: delta(), ord: delta(), aov: delta() },
      compare, peakLabel: n <= 7 ? 'Mốc đỉnh doanh số' : 'Tuần đỉnh doanh số',
      ordersWord: 'kỳ báo cáo', bars, start, end
    };
  }

  /* ---------- 3. TRẠNG THÁI + RENDER ---------- */

  const monthRange = (ref) => ({ start: new Date(ref.getFullYear(), ref.getMonth(), 1), end: ref });
  const RANGES = {
    today: () => ({ start: REF_DATE, end: REF_DATE }),
    week: () => ({ start: addDays(REF_DATE, -6), end: REF_DATE }),
    month: () => monthRange(REF_DATE),
    lastMonth: () => ({ start: new Date(REF_DATE.getFullYear(), REF_DATE.getMonth() - 1, 1), end: new Date(REF_DATE.getFullYear(), REF_DATE.getMonth(), 0) })
  };

  const state = {
    applied: { key: 'month', ...RANGES.month() },   // kỳ đang hiển thị
    pending: { key: 'month', ...RANGES.month() },   // kỳ đang chọn (chưa bấm Áp dụng)
    category: 'all',
    page: 1,
    report: null,
    rows: []
  };

  const deltaHtml = (v) => `<span class="delta ${v >= 0 ? 'up' : 'down'}">${icon(v >= 0 ? 'trendUp' : 'trendDown', 14)} ${v >= 0 ? '+' : ''}${v.toFixed(1)}%</span>`;

  function renderKpis(rep) {
    const done = rep.counts[0];
    const cancelRate = (rep.counts[4] / rep.orders) * 100;
    const aov = done ? rep.revenue / done : 0;
    // Số SKU phát sinh giao dịch = số sản phẩm có lượng bán > 0 trong kỳ
    const sku = PRODUCTS.filter((p) => scaledQty(p, rep) > 0).length;

    $('#kpi-revenue').textContent = fmtNum(rep.revenue);
    $('#kpi-orders').textContent = fmtNum(rep.orders);
    $('#kpi-items').textContent = fmtNum(rep.items);
    $('#kpi-aov').textContent = fmtNum(aov);

    $('#kpi-revenue-foot').innerHTML = `${deltaHtml(rep.deltas.rev)}<span>${rep.compare}</span>`;
    $('#kpi-orders-foot').innerHTML = `${deltaHtml(rep.deltas.ord)}<span>${cancelRate <= 5 ? 'tỷ lệ hủy thấp' : 'tỷ lệ hủy'}: ${cancelRate.toFixed(1)}%</span>`;
    $('#kpi-items-foot').innerHTML = `<span class="sku">${icon('truck', 15)} ${sku} SKU</span><span>đã phát sinh giao dịch</span>`;
    $('#kpi-aov-foot').innerHTML = `${deltaHtml(rep.deltas.aov)}<span>so với ngưỡng</span>`;
  }

  /** Chọn bước chia đẹp cho trục Y: 4 khoảng, vd 0 - 12.5M - 25M - 37.5M - 50M */
  function niceScale(max) {
    const raw = (max * 1.08) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 1.25, 2, 2.5, 5, 10].find((m) => m * mag >= raw) * mag;
    return { step, top: step * 4 };
  }

  function renderBars(rep) {
    const { bars } = rep;
    const { step, top } = niceScale(Math.max(...bars.map((b) => b.value)));
    const ticks = [0, 1, 2, 3, 4].map((i) => i * step);

    $('#bar-chart').innerHTML = `
      <div class="plot">
        ${ticks.map((t) => `<div class="gl" style="bottom:${(t / top) * 100}%"><span>${fmtAxis(t)}</span></div>`).join('')}
        <div class="bars">
          ${bars.map((b) => `
            <div class="bar-col" title="${esc(b.label)}: ${fmtMoney(b.value)}">
              <div class="bar ${b.peak ? 'peak' : ''}" data-h="${(b.value / top) * 100}">
                <span class="bar-val">${fmtShort(b.value)}${b.peak ? ' ★' : ''}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div class="xlabels">${bars.map((b) => `<span class="${b.peak ? 'peak' : ''}">${esc(b.label)}${b.peak ? ' (Đỉnh)' : ''}</span>`).join('')}</div>`;

    // Hiệu ứng "mọc" cột
    requestAnimationFrame(() => requestAnimationFrame(() => $$('#bar-chart .bar').forEach((el) => { el.style.height = el.dataset.h + '%'; })));

    $('#chart-sub').textContent = `Biểu đồ tổng hợp doanh số phát sinh thực nhận từ ${pad(rep.start.getDate())}/${pad(rep.start.getMonth() + 1)} đến ${pad(rep.end.getDate())}/${pad(rep.end.getMonth() + 1)}/${rep.end.getFullYear()}`;
    $('#peak-legend').textContent = rep.peakLabel;
    $('#chart-total').textContent = `Tổng: ${fmtMoney(rep.revenue)}`;
  }

  function renderDonut(rep) {
    const R = 86, C = 2 * Math.PI * R, GAP = 2;
    let offset = 0;
    const segs = STATUSES.map((s, i) => {
      const len = (rep.counts[i] / rep.orders) * C;
      const dash = Math.max(0, len - GAP);
      const html = len > 0
        ? `<circle cx="110" cy="110" r="${R}" stroke="${s.color}" stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-offset}"><title>${s.label}: ${rep.counts[i]} đơn</title></circle>`
        : '';
      offset += len;
      return html;
    }).join('');
    $('#donut').innerHTML = segs;

    $('#donut-total').textContent = fmtNum(rep.orders);
    $('#donut-sub').textContent = `Phân bổ ${fmtNum(rep.orders)} đơn hàng trong ${rep.ordersWord}`;
    $('#status-list').innerHTML = STATUSES.map((s, i) => `
      <li class="${s.key === 'canc' ? 'is-cancel' : ''}">
        <i class="dot" style="background:${s.color}"></i>
        <span class="name">${s.label}</span>
        <span class="count">${rep.counts[i]} đơn</span>
        <span class="pct">${((rep.counts[i] / rep.orders) * 100).toFixed(1)}%</span>
      </li>`).join('');
  }

  /* ----- Bảng Top sản phẩm ----- */

  // Quy đổi số lượng bán theo quy mô đơn hàng của kỳ (kỳ Tháng này = nguyên bản)
  const scaledQty = (p, rep) => Math.round(p.qty * (rep.orders / 342));

  function computeRows() {
    const rep = state.report;
    state.rows = PRODUCTS
      .map((p) => ({ ...p, sold: scaledQty(p, rep) }))
      .filter((p) => p.sold > 0 && (state.category === 'all' || p.cat === state.category))
      .map((p) => ({ ...p, revenue: p.sold * p.price }))
      .sort((a, b) => b.sold - a.sold);
  }

  const stockClass = (n) => (n <= 3 ? 'low' : n <= 10 ? 'mid' : 'ok');

  function renderTable() {
    computeRows();
    const total = state.rows.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * PAGE_SIZE;
    const slice = state.rows.slice(start, start + PAGE_SIZE);

    $('#top-body').innerHTML = slice.length ? slice.map((p, i) => {
      const rank = start + i + 1;
      return `
      <tr>
        <td><span class="rank ${rank <= 2 ? 'r' + rank : ''}">${rank}</span></td>
        <td><span class="sku-code">${esc(p.code)}</span></td>
        <td>
          <div class="prod-cell">
            <span class="thumb">${p.image ? `<img src="${esc(p.image)}" alt="" />` : p.emoji}</span>
            <div><div class="prod-name">${esc(p.name)}</div><div class="prod-attr">${esc(p.attr)}</div></div>
          </div>
        </td>
        <td><span class="cat-chip">${esc(p.cat)}</span></td>
        <td class="text-right"><span class="qty">${fmtNum(p.sold)}<small>cái</small></span></td>
        <td class="text-right"><span class="rev">${fmtMoney(p.revenue)}</span></td>
        <td class="text-center"><span class="stock ${stockClass(p.stock)}" title="${p.stock <= 3 ? 'Sắp hết hàng - cần nhập thêm' : ''}">${p.stock} cái</span></td>
        <td class="text-center"><button class="icon-btn" data-view="${esc(p.code)}" aria-label="Xem chi tiết">${icon('eye', 18)}</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="8" class="table-empty">Không có sản phẩm nào phát sinh doanh thu trong kỳ này.</td></tr>`;

    const from = total ? start + 1 : 0, to = Math.min(start + PAGE_SIZE, total);
    $('#top-info').innerHTML = `Hiển thị <b>${from} - ${to}</b> trên tổng số <b>${total}</b> sản phẩm phát sinh doanh thu kỳ này`;
    renderPager(pages);
  }

  function renderPager(pages) {
    const cur = state.page;
    const set = [...new Set([1, pages, cur - 1, cur, cur + 1].filter((p) => p >= 1 && p <= pages))].sort((a, b) => a - b);
    let html = `<button data-page="${cur - 1}" ${cur === 1 ? 'disabled' : ''}>Trang trước</button>`;
    set.forEach((p, i) => {
      if (i && p - set[i - 1] > 1) html += '<span class="gap">…</span>';
      html += `<button data-page="${p}" class="${p === cur ? 'active' : ''}">${p}</button>`;
    });
    html += `<button data-page="${cur + 1}" ${cur === pages ? 'disabled' : ''}>Trang sau</button>`;
    $('#pager').innerHTML = html;
  }

  function showProduct(code) {
    const p = state.rows.find((x) => x.code === code);
    if (!p) return;
    $('#product-modal-body').innerHTML = `
      <div class="prod-cell" style="margin-bottom:18px">
        <span class="thumb">${p.image ? `<img src="${esc(p.image)}" alt="" />` : p.emoji}</span>
        <div><div class="prod-name">${esc(p.name)}</div><div class="prod-attr">${esc(p.attr)}</div></div>
      </div>
      <div class="detail-grid">
        <div><small>Mã SP</small><b>${esc(p.code)}</b></div>
        <div><small>Danh mục</small><b>${esc(p.cat)}</b></div>
        <div><small>Đơn giá</small><b>${fmtMoney(p.price)}</b></div>
        <div><small>Số lượng bán trong kỳ</small><b>${fmtNum(p.sold)} cái</b></div>
        <div><small>Doanh thu đóng góp</small><b class="text-success">${fmtMoney(p.revenue)}</b></div>
        <div><small>Tồn kho còn lại</small><span class="stock ${stockClass(p.stock)}">${p.stock} cái</span></div>
        ${p.stock <= 3 ? '<div class="full text-error"><b>⚠ Tồn kho thấp - nên nhập thêm hàng.</b></div>' : ''}
      </div>`;
    $('#product-modal').classList.remove('hidden');
  }

  /* ---------- 4. KỲ BÁO CÁO + SỰ KIỆN ---------- */

  function renderAll() {
    state.report = buildReport(state.applied.key, state.applied.start, state.applied.end);
    renderKpis(state.report);
    renderBars(state.report);
    renderDonut(state.report);
    renderTable();
  }

  function syncFilterUi() {
    $$('#period-pills button').forEach((b) => b.classList.toggle('active', b.dataset.period === state.pending.key));
    $('#date-from').value = fmtISO(state.pending.start);
    $('#date-to').value = fmtISO(state.pending.end);
  }

  function initCategories() {
    $('#cat-filter').innerHTML = `<option value="all">Tất cả danh mục hàng hóa</option>` +
      CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  function bindEvents() {
    // Chọn nhanh kỳ báo cáo
    $('#period-pills').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-period]');
      if (!btn) return;
      state.pending = { key: btn.dataset.period, ...RANGES[btn.dataset.period]() };
      syncFilterUi();
    });

    // Tự chọn khoảng ngày
    ['#date-from', '#date-to'].forEach((sel) => $(sel).addEventListener('change', () => {
      const a = $('#date-from').value, b = $('#date-to').value;
      if (!a || !b) return;
      state.pending = { key: 'custom', start: parseISO(a), end: parseISO(b) };
      $$('#period-pills button').forEach((x) => x.classList.remove('active'));
    }));

    // Áp dụng bộ lọc
    $('#btn-apply').addEventListener('click', () => {
      let { key, start, end } = state.pending;
      if (start > end) { toast('Khoảng ngày không hợp lệ', 'Ngày bắt đầu phải trước ngày kết thúc.', 'error'); return; }
      if (end > REF_DATE) { toast('Khoảng ngày không hợp lệ', `Dữ liệu chỉ đến hết ngày ${fmtDate(REF_DATE)}.`, 'warning'); return; }
      // Nếu khoảng ngày tự chọn trùng một kỳ có sẵn thì dùng luôn kỳ đó
      if (key === 'custom') {
        key = Object.keys(RANGES).find((k) => { const r = RANGES[k](); return sameDay(r.start, start) && sameDay(r.end, end); }) || 'custom';
      }
      state.applied = { key, start, end };
      state.pending = { key, start, end };
      state.page = 1;
      syncFilterUi();
      renderAll();
      toast('Đã áp dụng bộ lọc', `Kỳ báo cáo: ${fmtDate(start)} - ${fmtDate(end)}`, 'info');
    });

    // Lọc danh mục
    $('#cat-filter').addEventListener('change', (e) => { state.category = e.target.value; state.page = 1; renderTable(); });

    // Phân trang + xem chi tiết
    $('#pager').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-page]');
      if (!b || b.disabled) return;
      state.page = +b.dataset.page;
      renderTable();
    });
    $('#top-body').addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]');
      if (b) showProduct(b.dataset.view);
    });

    // Modal
    const modal = $('#product-modal');
    $$('[data-close-modal]').forEach((b) => b.addEventListener('click', () => modal.classList.add('hidden')));
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') modal.classList.add('hidden');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('.topbar-search input').focus(); }
    });
  }

  /* ---------- Khởi tạo ---------- */
  hydrateIcons();
  $('#pill-month').textContent = `Tháng này (Tháng ${REF_DATE.getMonth() + 1}/${REF_DATE.getFullYear()})`;
  $('#date-to').max = fmtISO(REF_DATE);
  initCategories();
  syncFilterUi();
  bindEvents();
  renderAll();
})();