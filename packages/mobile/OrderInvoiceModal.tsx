import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { ReceiptData } from "./receiptFormat";
import { printOrderReceipt } from "./printReceipt";
import { theme } from "./theme";

type Labels = {
  title: string;
  orderNo: string;
  payment: string;
  product: string;
  qty: string;
  unitPrice: string;
  lineTotal: string;
  total: string;
  print: string;
  close: string;
  printFailed: string;
  currency: string;
};

type Props = {
  visible: boolean;
  receipt: ReceiptData | null;
  labels: Labels;
  onClose: () => void;
  onNotice: (msg: string, kind?: "error" | "info" | "success") => void;
};

function money(n: number, currency: string): string {
  return `${n.toFixed(2)} ${currency}`;
}

export default function OrderInvoiceModal(props: Props) {
  const { visible, receipt, labels, onClose, onNotice } = props;
  if (!receipt) return null;

  async function onPrint() {
    try {
      await printOrderReceipt(receipt!);
    } catch {
      onNotice(labels.printFailed, "error");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{labels.title}</Text>
          <Text style={styles.storeName}>{receipt.storeName}</Text>
          <Text style={styles.meta}>
            {labels.orderNo} #{receipt.orderId} · {receipt.paymentLabel}
          </Text>
          <Text style={styles.meta}>{receipt.createdAt.toLocaleString("ar-JO")}</Text>

          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colName]}>{labels.product}</Text>
            <Text style={[styles.th, styles.colQty]}>{labels.qty}</Text>
            <Text style={[styles.th, styles.colPrice]}>{labels.lineTotal}</Text>
          </View>
          <ScrollView style={styles.linesScroll} bounces={false}>
            {receipt.lines.map((line, i) => (
              <View key={`${line.productName}-${i}`} style={styles.lineRow}>
                <Text style={[styles.td, styles.colName]} numberOfLines={2}>
                  {line.productName}
                </Text>
                <Text style={[styles.td, styles.colQty]}>{line.quantity}</Text>
                <Text style={[styles.td, styles.colPrice]}>{money(line.lineTotal, labels.currency)}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{labels.total}</Text>
            <Text style={styles.totalValue}>{money(receipt.totalAmount, labels.currency)}</Text>
          </View>

          <Pressable style={styles.primary} onPress={() => void onPrint()}>
            <Text style={styles.primaryText}>{labels.print}</Text>
          </Pressable>
          <Pressable style={styles.ghost} onPress={onClose}>
            <Text style={styles.ghostText}>{labels.close}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "88%",
  },
  title: { fontSize: 18, fontWeight: "800", color: theme.text, textAlign: "center", marginBottom: 4 },
  storeName: { fontSize: 16, fontWeight: "700", color: theme.text, textAlign: "right" },
  meta: { color: theme.muted, fontSize: 13, textAlign: "right", marginTop: 4 },
  tableHead: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    paddingBottom: 8,
    marginTop: 16,
  },
  th: { fontSize: 12, fontWeight: "700", color: theme.muted },
  linesScroll: { maxHeight: 220, marginTop: 4 },
  lineRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  td: { color: theme.text, fontSize: 14 },
  colName: { flex: 1, textAlign: "right", paddingLeft: 8 },
  colQty: { width: 36, textAlign: "center", fontWeight: "700" },
  colPrice: { width: 72, textAlign: "left", fontWeight: "700" },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: theme.text,
  },
  totalLabel: { fontSize: 16, fontWeight: "800", color: theme.text },
  totalValue: { fontSize: 18, fontWeight: "800", color: theme.accentDark },
  primary: {
    marginTop: 16,
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: theme.radius.md,
    alignItems: "center",
  },
  primaryText: { color: theme.onAccent, fontWeight: "800", fontSize: 16 },
  ghost: { marginTop: 10, paddingVertical: 12, alignItems: "center" },
  ghostText: { color: theme.muted, fontWeight: "700", fontSize: 15 },
});
