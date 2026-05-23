import ExcelJS from "exceljs";
import QRCode from "qrcode";

export type QrExportRow = {
  id: string;
  publicToken: string;
  scanUrl: string;
  createdAt: string;
};

type ColumnLabels = {
  id: string;
  token: string;
  qr: string;
  scanUrl: string;
  created: string;
};

const QR_SIZE_PX = 96;
const ROW_HEIGHT = 76;
const QR_BATCH = 24;

function triggerDownload(buffer: ArrayBuffer, fileBaseName: string) {
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

async function renderQrPngBase64(scanUrl: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(scanUrl, {
    width: QR_SIZE_PX,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("QR render failed");
  return base64;
}

async function renderAllQrImages(items: QrExportRow[]): Promise<string[]> {
  const images: string[] = new Array(items.length);
  for (let i = 0; i < items.length; i += QR_BATCH) {
    const slice = items.slice(i, i + QR_BATCH);
    const chunk = await Promise.all(slice.map((item) => renderQrPngBase64(item.scanUrl)));
    for (let j = 0; j < chunk.length; j++) images[i + j] = chunk[j]!;
  }
  return images;
}

/** Build .xlsx with embedded QR images (one per row). */
export async function downloadQrPoolExcel(
  items: QrExportRow[],
  columns: ColumnLabels,
  sheetName: string,
  fileBaseName: string
): Promise<void> {
  const qrImages = await renderAllQrImages(items);

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: columns.id, key: "id", width: 12 },
    { header: columns.token, key: "token", width: 48 },
    { header: columns.qr, key: "qr", width: 16 },
    { header: columns.scanUrl, key: "scanUrl", width: 68 },
    { header: columns.created, key: "created", width: 22 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.height = 22;

  const qrColIndex = 3;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const rowIndex = i + 2;
    const row = sheet.getRow(rowIndex);
    row.getCell(1).value = item.id;
    row.getCell(2).value = item.publicToken;
    row.getCell(4).value = item.scanUrl;
    row.getCell(5).value = item.createdAt;
    row.height = ROW_HEIGHT;

    const imageId = wb.addImage({
      base64: qrImages[i]!,
      extension: "png",
    });
    sheet.addImage(imageId, {
      tl: { col: qrColIndex - 1 + 0.12, row: rowIndex - 1 + 0.08 },
      ext: { width: QR_SIZE_PX, height: QR_SIZE_PX },
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(buffer, fileBaseName);
}
