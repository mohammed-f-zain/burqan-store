import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CartLine } from "./StoreCartPanel";
import { isTabletDevice } from "./deviceLayout";
import { theme } from "./theme";

type Labels = {
  title: string;
  subtitle: string;
  store: string;
  product: string;
  qty: string;
  lineTotal: string;
  total: string;
  payment: string;
  cash: string;
  deferredPay: string;
  currency: string;
  cancel: string;
  confirm: string;
};

type Props = {
  visible: boolean;
  storeName: string;
  lines: CartLine[];
  paymentType: "cash" | "deferred";
  totalAmount: number;
  busy?: boolean;
  labels: Labels;
  onCancel: () => void;
  onConfirm: () => void;
};

function lineTotal(product: CartLine["product"], qty: number): number {
  return (parseFloat(product.price) || 0) * qty;
}

function money(n: number, currency: string): string {
  return `${n.toFixed(2)} ${currency}`;
}

export default function OrderConfirmModal(props: Props) {
  const { visible, storeName, lines, paymentType, totalAmount, busy, labels } = props;
  const insets = useSafeAreaInsets();
  const isTablet = isTabletDevice();
  const bottomPad = Math.max(insets.bottom, isTablet ? 32 : 16) + 12;

  if (!lines.length) return null;

  const paymentLabel = paymentType === "deferred" ? labels.deferredPay : labels.cash;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={props.onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={busy ? undefined : props.onCancel} />
        <View style={[styles.sheet, { paddingBottom: bottomPad }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{labels.title}</Text>
          <Text style={styles.subtitle}>{labels.subtitle}</Text>
          <Text style={styles.storeLabel}>{labels.store}</Text>
          <Text style={styles.storeName}>{storeName}</Text>

          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colName]}>{labels.product}</Text>
            <Text style={[styles.th, styles.colQty]}>{labels.qty}</Text>
            <Text style={[styles.th, styles.colPrice]}>{labels.lineTotal}</Text>
          </View>
          <ScrollView style={styles.linesScroll} bounces={false}>
            {lines.map(({ product, qty }) => (
              <View key={product.id} style={styles.lineRow}>
                <Text style={[styles.td, styles.colName]} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={[styles.td, styles.colQty]}>{qty}</Text>
                <Text style={[styles.td, styles.colPrice]}>
                  {money(lineTotal(product, qty), labels.currency)}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>{labels.payment}</Text>
            <View style={styles.paymentPill}>
              <Text style={styles.paymentPillText}>{paymentLabel}</Text>
            </View>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{labels.total}</Text>
            <Text style={styles.totalValue}>{money(totalAmount, labels.currency)}</Text>
          </View>

          <Pressable
            style={[styles.confirmBtn, busy && styles.btnDisabled]}
            onPress={props.onConfirm}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={styles.confirmText}>{labels.confirm}</Text>
            )}
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={props.onCancel} disabled={busy}>
            <Text style={styles.cancelText}>{labels.cancel}</Text>
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
  backdropTouch: { flex: 1 },
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
  title: { fontSize: 20, fontWeight: "900", color: theme.text, textAlign: "center" },
  subtitle: { color: theme.muted, fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20 },
  storeLabel: { color: theme.muted, fontSize: 12, fontWeight: "700", textAlign: "right", marginTop: 16 },
  storeName: { color: theme.text, fontSize: 16, fontWeight: "800", textAlign: "right", marginTop: 4 },
  tableHead: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    paddingBottom: 8,
    marginTop: 14,
  },
  th: { fontSize: 12, fontWeight: "800", color: theme.muted },
  linesScroll: { maxHeight: 240, marginTop: 4 },
  lineRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  td: { color: theme.text, fontSize: 14 },
  colName: { flex: 1, textAlign: "right", paddingLeft: 8, fontWeight: "600" },
  colQty: { width: 40, textAlign: "center", fontWeight: "800" },
  colPrice: { width: 76, textAlign: "left", fontWeight: "800", color: theme.accentDark },
  paymentRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  paymentLabel: { color: theme.muted, fontSize: 14, fontWeight: "700" },
  paymentPill: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  paymentPillText: { color: theme.accentDark, fontWeight: "800", fontSize: 13 },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: theme.text,
  },
  totalLabel: { fontSize: 16, fontWeight: "800", color: theme.text },
  totalValue: { fontSize: 20, fontWeight: "900", color: theme.accentDark },
  confirmBtn: {
    marginTop: 18,
    backgroundColor: theme.accent,
    paddingVertical: 17,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.accent2,
  },
  confirmText: { color: theme.onAccent, fontWeight: "900", fontSize: 17 },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: { color: theme.muted, fontWeight: "700", fontSize: 15 },
  btnDisabled: { opacity: 0.75 },
});
