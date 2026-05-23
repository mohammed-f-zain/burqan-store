import * as XLSX from "xlsx";

export type QrExportRow = {
  id: string;
  publicToken: string;
  scanUrl: string;
  createdAt: string;
};

type ColumnLabels = {
  id: string;
  token: string;
  scanUrl: string;
  created: string;
};

export function downloadQrPoolExcel(
  items: QrExportRow[],
  columns: ColumnLabels,
  sheetName: string,
  fileBaseName: string
): void {
  const rows = items.map((item) => ({
    [columns.id]: item.id,
    [columns.token]: item.publicToken,
    [columns.scanUrl]: item.scanUrl,
    [columns.created]: item.createdAt,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 10 }, { wch: 52 }, { wch: 72 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${fileBaseName}.xlsx`);
}
