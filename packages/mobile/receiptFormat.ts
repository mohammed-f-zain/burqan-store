export type ReceiptLine = {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ReceiptData = {
  orderId: string;
  storeName: string;
  paymentLabel: string;
  currency: string;
  lines: ReceiptLine[];
  totalAmount: number;
  createdAt: Date;
};

function money(n: number, currency: string): string {
  return `${n.toFixed(2)} ${currency}`;
}

/** Plain text for thermal / share — no logo, narrow layout. */
export function formatReceiptPlain(data: ReceiptData): string {
  const sep = "------------------------------";
  const rows = data.lines.map(
    (l) =>
      `${l.productName}\n  ${l.quantity} x ${money(l.unitPrice, data.currency)} = ${money(l.lineTotal, data.currency)}`
  );
  return [
    data.storeName,
    `طلب #${data.orderId}`,
    data.paymentLabel,
    data.createdAt.toLocaleString("ar-JO"),
    sep,
    ...rows,
    sep,
    `المجموع: ${money(data.totalAmount, data.currency)}`,
    "",
  ].join("\n");
}

/** Minimal HTML for expo-print (thermal-friendly, no images). */
export function formatReceiptHtml(data: ReceiptData): string {
  const rows = data.lines
    .map(
      (l) =>
        `<tr>
          <td style="text-align:right;padding:4px 0">${escapeHtml(l.productName)}</td>
          <td style="text-align:center;padding:4px 4px">${l.quantity}</td>
          <td style="text-align:left;padding:4px 0;white-space:nowrap">${money(l.unitPrice, data.currency)}</td>
          <td style="text-align:left;padding:4px 0;white-space:nowrap;font-weight:bold">${money(l.lineTotal, data.currency)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 4mm; }
    body { font-family: monospace, 'Courier New', sans-serif; font-size: 11px; color: #000; margin: 0; padding: 4px; }
    h1 { font-size: 14px; margin: 0 0 4px; font-weight: bold; }
    .meta { font-size: 10px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 10px; border-bottom: 1px dashed #000; padding-bottom: 4px; }
    .total { margin-top: 8px; padding-top: 6px; border-top: 2px solid #000; font-size: 13px; font-weight: bold; text-align: left; }
  </style>
</head>
<body>
  <h1>${escapeHtml(data.storeName)}</h1>
  <div class="meta">طلب #${escapeHtml(data.orderId)} · ${escapeHtml(data.paymentLabel)}<br/>${escapeHtml(data.createdAt.toLocaleString("ar-JO"))}</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:right">المنتج</th>
        <th style="text-align:center">كم</th>
        <th style="text-align:left">سعر</th>
        <th style="text-align:left">مجموع</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">المجموع: ${money(data.totalAmount, data.currency)}</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
