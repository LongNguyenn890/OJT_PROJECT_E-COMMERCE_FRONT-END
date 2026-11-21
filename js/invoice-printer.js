/**
 * ShopEase - Module In Hoá Đơn Bán Hàng (Print Invoice Utility)
 * Hỗ trợ in hoá đơn chuẩn bằng window.print() cho cả:
 *   1. Đơn bán tại quầy (POS - Tiền mặt / Chuyển khoản)
 *   2. Đơn đặt hàng trực tuyến (Online Orders - COD / Chuyển khoản)
 */

(function () {
  // Inject style cho hoá đơn in và xem trước
  const invoiceStyles = document.createElement("style");
  invoiceStyles.id = "shopease-invoice-styles";
  invoiceStyles.innerHTML = `
    /* Khung hiển thị hoá đơn trên màn hình khi preview */
    .invoice-preview-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(4px);
      z-index: 99999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .invoice-preview-modal-overlay.show {
      display: flex;
    }
    .invoice-preview-modal-box {
      background: #ffffff;
      border-radius: 12px;
      max-width: 520px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      animation: invFadeIn 0.2s ease-out;
    }
    @keyframes invFadeIn {
      from { opacity: 0; transform: scale(0.96) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .invoice-preview-header {
      padding: 14px 18px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .invoice-preview-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .invoice-preview-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      background: #f1f5f9;
    }
    .invoice-preview-footer {
      padding: 14px 18px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }

    /* Giấy hoá đơn chuẩn POS K80 / A5 */
    .invoice-paper {
      background: #ffffff;
      color: #0f172a;
      width: 100%;
      max-width: 440px;
      margin: 0 auto;
      padding: 24px 20px;
      border-radius: 4px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.45;
    }

    .inv-brand-center {
      text-align: center;
      margin-bottom: 14px;
    }
    .inv-brand-logo {
      width: 48px;
      height: 48px;
      margin-bottom: 4px;
      display: inline-block;
    }
    .inv-store-name {
      font-size: 20px;
      font-weight: 800;
      color: #1e40af;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 0 0 2px 0;
    }
    .inv-store-tagline {
      font-size: 11.5px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .inv-store-info {
      font-size: 11.5px;
      color: #475569;
      line-height: 1.4;
    }

    .inv-divider {
      border: none;
      border-top: 1px dashed #cbd5e1;
      margin: 14px 0;
    }
    .inv-double-divider {
      border: none;
      border-top: 2px dashed #94a3b8;
      margin: 14px 0;
    }

    .inv-heading-title {
      text-align: center;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      margin: 8px 0 2px 0;
      letter-spacing: 0.5px;
    }
    .inv-badge-type {
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      color: #1e40af;
      background: #eff6ff;
      padding: 2px 8px;
      border-radius: 9999px;
      display: inline-block;
      margin: 0 auto 12px auto;
      border: 1px solid #bfdbfe;
    }

    .inv-meta-grid {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 12px;
      color: #334155;
    }
    .inv-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .inv-meta-label {
      color: #64748b;
      flex-shrink: 0;
    }
    .inv-meta-val {
      font-weight: 600;
      text-align: right;
      color: #0f172a;
      word-break: break-word;
    }

    /* Bảng sản phẩm trong hoá đơn */
    .inv-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 12px;
    }
    .inv-table th {
      border-top: 1px solid #0f172a;
      border-bottom: 1px solid #0f172a;
      padding: 6px 2px;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      color: #0f172a;
    }
    .inv-table td {
      padding: 7px 2px;
      border-bottom: 1px dashed #e2e8f0;
      vertical-align: top;
    }
    .inv-table tr:last-child td {
      border-bottom: 1px solid #0f172a;
    }
    .inv-col-name {
      text-align: left;
    }
    .inv-col-qty {
      text-align: center;
      width: 40px;
      white-space: nowrap;
    }
    .inv-col-price {
      text-align: right;
      width: 75px;
      white-space: nowrap;
    }
    .inv-col-subtotal {
      text-align: right;
      width: 85px;
      font-weight: 700;
      white-space: nowrap;
    }

    /* Tổng tiền */
    .inv-calc-box {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 12.5px;
      margin-top: 6px;
    }
    .inv-calc-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .inv-grand-total {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      border-top: 1px solid #0f172a;
      border-bottom: 1px solid #0f172a;
      padding: 8px 0;
      margin: 6px 0;
    }

    .inv-footer-center {
      text-align: center;
      margin-top: 18px;
      font-size: 11.5px;
      color: #475569;
    }
    .inv-thank-you {
      font-weight: 700;
      font-size: 12.5px;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .inv-barcode-box {
      margin-top: 10px;
      font-family: 'Liberation Mono', monospace;
      letter-spacing: 2px;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }

    /* ==========================================================
       CSS IN BẰNG WINDOW.PRINT()
       Ẩn toàn bộ trang web và chỉ in duy nhất tờ hoá đơn
       ========================================================== */
    @media print {
      body * {
        visibility: hidden !important;
      }
      .invoice-preview-modal-overlay,
      .invoice-preview-modal-overlay * {
        visibility: hidden !important;
      }
      #shopease-direct-print-area,
      #shopease-direct-print-area * {
        visibility: visible !important;
      }
      #shopease-direct-print-area {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        box-shadow: none !important;
        border: none !important;
        display: block !important;
      }
      .invoice-paper {
        max-width: 80mm !important; /* Chuẩn in nhiệt K80 */
        width: 80mm !important;
        margin: 0 auto !important;
        padding: 4mm 2mm !important;
        box-shadow: none !important;
        border: none !important;
      }
      @page {
        size: auto;
        margin: 4mm;
      }
    }
  `;
  document.head.appendChild(invoiceStyles);

  // Helper định dạng tiền và ngày
  function fmtMoney(amount) {
    if (typeof formatMoney === "function") return formatMoney(amount);
    return Number(amount || 0).toLocaleString("vi-VN") + " ₫";
  }

  function fmtDateTime(dt) {
    if (!dt) return "";
    if (typeof formatDateTime === "function") return formatDateTime(dt);
    const d = new Date(dt);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " " + d.toLocaleDateString("vi-VN");
  }

  /**
   * Tạo HTML nội dung hoá đơn dựa trên dữ liệu đơn hàng
   */
  function buildInvoiceHtml(order) {
    const isPos = String(order.order_code || "").startsWith("POS") ||
                  String(order.shipping_address || "").includes("tại quầy") ||
                  String(order.note || "").includes("POS");

    const code = order.order_code || `DH-${String(order.id).padStart(4, "0")}`;
    const dateStr = fmtDateTime(order.created_at || new Date());
    const cashierName = order.cashier_name || (typeof Auth !== "undefined" && Auth.getUser() ? (Auth.getUser().full_name || Auth.getUser().email) : "Nhân viên ShopEase");

    const receiverName = order.receiver_name || (isPos ? "Khách lẻ tại quầy" : "Khách hàng");
    const receiverPhone = order.receiver_phone || "—";
    const shippingAddress = order.shipping_address || (isPos ? "Mua trực tiếp tại quầy" : "Chưa cập nhật");

    const subtotal = order.subtotal_amount || (order.total_amount - (order.shipping_fee || 0));
    const shippingFee = order.shipping_fee || 0;
    const totalAmount = order.total_amount || 0;

    const pm = String(order.payment_method || "").toUpperCase();
    const isBank = pm.includes("BANK") || pm.includes("CHUYỂN KHOẢN");
    const paymentLabel = isBank ? "Chuyển khoản ngân hàng" : (isPos ? "Tiền mặt (Tại quầy)" : "COD khi nhận hàng");

    const cashReceived = order.cash_received !== undefined ? order.cash_received : totalAmount;
    const cashChange = order.cash_change !== undefined ? order.cash_change : Math.max(0, cashReceived - totalAmount);

    const items = order.items || [];
    const itemsRowsHtml = items.map((it, idx) => {
      const name = it.product_name || `Sản phẩm #${it.product_id}`;
      const qty = it.quantity || 1;
      const unitPrice = it.unit_price || 0;
      const rowSubtotal = it.subtotal || (unitPrice * qty);

      return `
        <tr>
          <td class="inv-col-name">
            <strong>${idx + 1}. ${escapeHtml(name)}</strong>
            ${it.sku ? `<div style="font-size: 10px; color: #64748b;">SKU: ${escapeHtml(it.sku)}</div>` : ""}
          </td>
          <td class="inv-col-qty">${qty}</td>
          <td class="inv-col-price">${fmtMoney(unitPrice)}</td>
          <td class="inv-col-subtotal">${fmtMoney(rowSubtotal)}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="invoice-paper" id="shopease-printable-invoice-content">
        <!-- Thương hiệu cửa hàng -->
        <div class="inv-brand-center">
          <img src="../assets/images/logo_shop.svg" class="inv-brand-logo" alt="ShopEase" onerror="this.style.display='none';">
          <h1 class="inv-store-name">SHOPEASE STORE</h1>
          <div class="inv-store-tagline">Hệ thống bán lẻ & Thương mại điện tử chất lượng cao</div>
          <div class="inv-store-info">
            <div>📍 Số 18 Phạm Hùng, Mỹ Đình, Hà Nội</div>
            <div>📞 Hotline: 1900 6868 | Website: shopease.vn</div>
          </div>
        </div>

        <hr class="inv-double-divider">

        <div style="text-align: center;">
          <h2 class="inv-heading-title">HOÁ ĐƠN BÁN HÀNG</h2>
          <span class="inv-badge-type">${isPos ? "ĐƠN BÁN TẠI QUẦY (POS)" : "ĐƠN ĐẶT TRỰC TUYẾN (ONLINE)"}</span>
        </div>

        <!-- Thông tin hoá đơn -->
        <div class="inv-meta-grid">
          <div class="inv-meta-row">
            <span class="inv-meta-label">Số hoá đơn / Mã đơn:</span>
            <span class="inv-meta-val" style="font-family: 'Liberation Mono', monospace; font-size: 13px;">#${escapeHtml(code)}</span>
          </div>
          <div class="inv-meta-row">
            <span class="inv-meta-label">Thời gian:</span>
            <span class="inv-meta-val">${escapeHtml(dateStr)}</span>
          </div>
          <div class="inv-meta-row">
            <span class="inv-meta-label">Thu ngân / Nhân viên:</span>
            <span class="inv-meta-val">${escapeHtml(cashierName)}</span>
          </div>
          <div class="inv-meta-row">
            <span class="inv-meta-label">Khách hàng:</span>
            <span class="inv-meta-val">${escapeHtml(receiverName)} (${escapeHtml(receiverPhone)})</span>
          </div>
          ${!isPos ? `
          <div class="inv-meta-row">
            <span class="inv-meta-label">Địa chỉ nhận hàng:</span>
            <span class="inv-meta-val">${escapeHtml(shippingAddress)}</span>
          </div>
          ` : ""}
          ${order.note ? `
          <div class="inv-meta-row">
            <span class="inv-meta-label">Ghi chú:</span>
            <span class="inv-meta-val" style="font-style: italic;">"${escapeHtml(order.note)}"</span>
          </div>
          ` : ""}
        </div>

        <!-- Bảng sản phẩm -->
        <table class="inv-table">
          <thead>
            <tr>
              <th class="inv-col-name">Tên mặt hàng</th>
              <th class="inv-col-qty">SL</th>
              <th class="inv-col-price">Đ.Giá</th>
              <th class="inv-col-subtotal">T.Tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>

        <!-- Tính tiền -->
        <div class="inv-calc-box">
          <div class="inv-calc-row">
            <span>Tiền hàng tạm tính (${items.length} món):</span>
            <span style="font-weight: 600;">${fmtMoney(subtotal)}</span>
          </div>
          ${shippingFee > 0 ? `
          <div class="inv-calc-row">
            <span>Phí vận chuyển:</span>
            <span style="font-weight: 600;">${fmtMoney(shippingFee)}</span>
          </div>
          ` : (!isPos ? `
          <div class="inv-calc-row">
            <span>Phí vận chuyển:</span>
            <span style="font-weight: 600; color: #16a34a;">Miễn phí</span>
          </div>
          ` : "")}
          <div class="inv-calc-row inv-grand-total">
            <span>TỔNG CỘNG:</span>
            <span>${fmtMoney(totalAmount)}</span>
          </div>
          <div class="inv-calc-row">
            <span>Hình thức thanh toán:</span>
            <span style="font-weight: 600;">${escapeHtml(paymentLabel)}</span>
          </div>
          ${isPos && !isBank ? `
          <div class="inv-calc-row" style="margin-top: 4px;">
            <span>Tiền khách đưa:</span>
            <span style="font-weight: 600;">${fmtMoney(cashReceived)}</span>
          </div>
          <div class="inv-calc-row">
            <span>Tiền trả lại khách:</span>
            <span style="font-weight: 700; color: #0284c7;">${fmtMoney(cashChange)}</span>
          </div>
          ` : ""}
        </div>

        <hr class="inv-divider">

        <!-- Lời cảm ơn & Chân hoá đơn -->
        <div class="inv-footer-center">
          <div class="inv-thank-you">CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!</div>
          <div>Quý khách vui lòng kiểm tra hoá đơn và hàng hoá trước khi rời quầy.</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Hỗ trợ đổi trả trong vòng 7 ngày đối với sản phẩm còn nguyên tem mác.</div>
          <div class="inv-barcode-box">
            ||||| | |||| ||| |||||| |||| ||
            <div style="font-size: 10px; color: #64748b; font-weight: normal; margin-top: 2px;">${escapeHtml(code)}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Tạo container in trực tiếp trên DOM nếu chưa có
   */
  function ensurePrintContainer() {
    let container = document.getElementById("shopease-direct-print-area");
    if (!container) {
      container = document.createElement("div");
      container.id = "shopease-direct-print-area";
      container.style.display = "none";
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Tạo modal xem trước hoá đơn nếu chưa có
   */
  function ensurePreviewModal() {
    let modal = document.getElementById("shopease-invoice-preview-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "shopease-invoice-preview-modal";
      modal.className = "invoice-preview-modal-overlay";
      modal.innerHTML = `
        <div class="invoice-preview-modal-box">
          <div class="invoice-preview-header">
            <h3 class="invoice-preview-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              <span>Xem trước Hoá đơn bán hàng</span>
            </h3>
            <button type="button" class="btn-modal-close" id="btn-close-invoice-preview">&times;</button>
          </div>
          <div class="invoice-preview-body" id="invoice-preview-body-content">
            <!-- Nội dung hoá đơn preview -->
          </div>
          <div class="invoice-preview-footer">
            <button type="button" class="btn-admin-action secondary" id="btn-cancel-invoice-preview">Đóng</button>
            <button type="button" class="btn-admin-primary" id="btn-execute-invoice-print" style="padding: 9px 20px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              <span>In hoá đơn (window.print)</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const closeModal = () => modal.classList.remove("show");
      modal.querySelector("#btn-close-invoice-preview").addEventListener("click", closeModal);
      modal.querySelector("#btn-cancel-invoice-preview").addEventListener("click", closeModal);
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
      });

      modal.querySelector("#btn-execute-invoice-print").addEventListener("click", () => {
        window.print();
      });
    }
    return modal;
  }

  /**
   * Hàm gọi in hoá đơn chính (dùng được cho cả đơn online và tại quầy)
   * @param {Object|Number|String} orderOrId - Đối tượng đơn hàng hoặc ID đơn hàng
   * @param {Boolean} showPreviewFirst - Có hiện popup xem trước trước khi in không (mặc định: false = in ngay)
   */
  window.printOrderInvoice = async function (orderOrId, showPreviewFirst = false) {
    let order = orderOrId;

    // Nếu truyền vào là ID thì gọi API để lấy chi tiết đơn hàng
    if (typeof orderOrId === "number" || typeof orderOrId === "string") {
      try {
        if (typeof showToast === "function") {
          showToast("Đang chuẩn bị hoá đơn in...", "info");
        }
        order = await api.get(`/orders/${orderOrId}`);
      } catch (err) {
        console.error("[Invoice Printer] Lỗi tải đơn hàng để in:", err);
        if (typeof showToast === "function") {
          showToast(`Không thể tải thông tin hoá đơn: ${err.message || "Lỗi máy chủ"}`, "error");
        }
        return;
      }
    }

    if (!order) {
      if (typeof showToast === "function") showToast("Không có thông tin đơn hàng để in hoá đơn.", "warning");
      return;
    }

    const htmlContent = buildInvoiceHtml(order);

    // 1. Cập nhật vào khu vực in trực tiếp của trang
    const printContainer = ensurePrintContainer();
    printContainer.innerHTML = htmlContent;

    // 2. Nếu muốn xem trước trước khi in
    if (showPreviewFirst) {
      const modal = ensurePreviewModal();
      const bodyContent = modal.querySelector("#invoice-preview-body-content");
      if (bodyContent) bodyContent.innerHTML = htmlContent;
      modal.classList.add("show");
      return;
    }

    // 3. Thực hiện in trực tiếp qua window.print()
    setTimeout(() => {
      window.print();
    }, 150);
  };
})();
