import ExcelJS from "exceljs";

export type FillCarSoldExportRow = {
  productName: string;
  quantity: number;
  lineTotal: number;
};

type FillCarSoldExportMeta = {
  title: string;
  repLabel: string;
  repName: string;
  dateLabel: string;
  date: string;
  ordersLabel: string;
  ordersCount: number;
  salesLabel: string;
  salesTotalFormatted: string;
  productCol: string;
  qtyCol: string;
  lineCol: string;
  sheetName: string;
  fileBaseName: string;
  dir?: "rtl" | "ltr";
};

function triggerXlsxDownload(buffer: ArrayBuffer, fileBaseName: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBaseName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function downloadFillCarSoldExcel(
  rows: FillCarSoldExportRow[],
  meta: FillCarSoldExportMeta
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(meta.sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 6 }],
  });

  sheet.addRow([meta.title]);
  sheet.addRow([meta.repLabel, meta.repName]);
  sheet.addRow([meta.dateLabel, meta.date]);
  sheet.addRow([meta.ordersLabel, meta.ordersCount]);
  sheet.addRow([meta.salesLabel, meta.salesTotalFormatted]);
  sheet.addRow([]);
  sheet.addRow([meta.productCol, meta.qtyCol, meta.lineCol]);

  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(7).font = { bold: true };

  for (const row of rows) {
    sheet.addRow([row.productName, row.quantity, Number(row.lineTotal.toFixed(4))]);
  }

  sheet.getColumn(1).width = 36;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 16;

  const buffer = await wb.xlsx.writeBuffer();
  triggerXlsxDownload(buffer, meta.fileBaseName);
}

/** Opens a print-friendly document so the user can Print / Save as PDF. */
export function printFillCarSoldPdf(rows: FillCarSoldExportRow[], meta: FillCarSoldExportMeta): void {
  const dir = meta.dir ?? "rtl";
  const bodyRows = rows
    .map(
      (r) =>
        `<tr>
          <td>${escapeHtml(r.productName)}</td>
          <td>${r.quantity}</td>
          <td>${escapeHtml(r.lineTotal.toFixed(4))}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${dir === "rtl" ? "ar" : "en"}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(meta.title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Tahoma, Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    .meta { margin: 0 0 16px; font-size: 13px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: start; }
    th { background: #f3f4f6; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(meta.title)}</h1>
  <div class="meta">
    <div><strong>${escapeHtml(meta.repLabel)}:</strong> ${escapeHtml(meta.repName)}</div>
    <div><strong>${escapeHtml(meta.dateLabel)}:</strong> ${escapeHtml(meta.date)}</div>
    <div><strong>${escapeHtml(meta.ordersLabel)}:</strong> ${meta.ordersCount}</div>
    <div><strong>${escapeHtml(meta.salesLabel)}:</strong> ${escapeHtml(meta.salesTotalFormatted)}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml(meta.productCol)}</th>
        <th>${escapeHtml(meta.qtyCol)}</th>
        <th>${escapeHtml(meta.lineCol)}</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) throw new Error("POPUP_BLOCKED");
  win.document.open();
  win.document.write(html);
  win.document.close();
}
