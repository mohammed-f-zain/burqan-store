import * as Print from "expo-print";

import { formatReceiptHtml, type ReceiptData } from "./receiptFormat";

/** Opens system print dialog (works with many Bluetooth thermal printers on Android). */
export async function printOrderReceipt(data: ReceiptData): Promise<void> {
  const html = formatReceiptHtml(data);
  await Print.printAsync({ html });
}
