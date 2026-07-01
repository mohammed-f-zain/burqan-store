import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ReceiptData } from "./receiptFormat";
import { isTabletDevice } from "./deviceLayout";
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
  const insets = useSafeAreaInsets();
  const isTablet = isTabletDevice();
  const bottomPad = Math.max(insets.bottom, isTablet ? 36 : 16) + 16;

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
        <View style={[styles.sheet, { paddingBottom: bottomPad }]}>
          <View style={styles.handle} />
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

          <Pressable style={styles.printBtn} onPress={() => void onPrint()}>
            <Text style={styles.printText}>{labels.print}</Text>
          </Pressable>
          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneText}>{labels.close}</Text>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.line,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "900", color: theme.text, textAlign: "center", marginBottom: 4 },
  storeName: { fontSize: 16, fontWeight: "800", color: theme.text, textAlign: "right" },
  meta: { color: theme.muted, fontSize: 13, textAlign: "right", marginTop: 4 },
  tableHead: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    paddingBottom: 8,
    marginTop: 16,
  },
  th: { fontSize: 12, fontWeight: "800", color: theme.muted },
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
  colQty: { width: 36, textAlign: "center", fontWeight: "800" },
  colPrice: { width: 72, textAlign: "left", fontWeight: "800" },
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
  totalValue: { fontSize: 18, fontWeight: "900", color: theme.accentDark },
  printBtn: {
    marginTop: 16,
    backgroundColor: "#f1f5f9",
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.line,
  },
  printText: { color: theme.text, fontWeight: "800", fontSize: 15 },
  doneBtn: {
    marginTop: 12,
    backgroundColor: theme.accent,
    paddingVertical: 18,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.accent2,
    ...theme.shadow.card,
  },
  doneText: { color: theme.onAccent, fontWeight: "900", fontSize: 18 },
});
