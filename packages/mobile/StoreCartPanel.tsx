import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Product } from "./ProductDetailModal";
import { theme } from "./theme";

export type CartLine = { product: Product; qty: number };

type Labels = {
  cartTitle: string;
  cartEmpty: string;
  payment: string;
  cash: string;
  deferredPay: string;
  submitOrder: string;
  total: string;
  currency: string;
  qty: string;
};

type Props = {
  lines: CartLine[];
  paymentType: "cash" | "deferred";
  deferredEnabled: boolean;
  totalAmount: number;
  labels: Labels;
  onPaymentChange: (type: "cash" | "deferred") => void;
  onSubmit: () => void;
};

function lineTotal(product: Product, qty: number): number {
  return (parseFloat(product.price) || 0) * qty;
}

export default function StoreCartPanel(props: Props) {
  const { lines, paymentType, deferredEnabled, totalAmount, labels, onPaymentChange, onSubmit } = props;

  if (lines.length === 0) {
    return <Text style={styles.empty}>{labels.cartEmpty}</Text>;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.cartTitle}>{labels.cartTitle}</Text>
      {lines.map(({ product, qty }) => (
        <View key={product.id} style={styles.line}>
          <View style={styles.lineMain}>
            <Text style={styles.lineName} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={styles.lineMeta}>
              {labels.qty} {qty} × {product.price} {labels.currency}
            </Text>
          </View>
          <Text style={styles.lineAmount}>
            {lineTotal(product, qty).toFixed(2)} {labels.currency}
          </Text>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{labels.total}</Text>
        <Text style={styles.totalValue}>
          {totalAmount.toFixed(2)} {labels.currency}
        </Text>
      </View>

      <Text style={styles.paymentLabel}>{labels.payment}</Text>
      <View style={styles.segmented}>
        <Pressable
          style={[styles.segment, paymentType === "cash" && styles.segmentOn]}
          onPress={() => onPaymentChange("cash")}
        >
          <Text style={[styles.segmentText, paymentType === "cash" && styles.segmentTextOn]}>{labels.cash}</Text>
        </Pressable>
        {deferredEnabled ? (
          <Pressable
            style={[styles.segment, paymentType === "deferred" && styles.segmentOn]}
            onPress={() => onPaymentChange("deferred")}
          >
            <Text style={[styles.segmentText, paymentType === "deferred" && styles.segmentTextOn]}>
              {labels.deferredPay}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable style={styles.submit} onPress={onSubmit}>
        <Text style={styles.submitText}>{labels.submitOrder}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    padding: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: theme.line,
  },
  empty: { color: theme.muted, textAlign: "center", marginTop: 16, fontWeight: "600" },
  cartTitle: { fontSize: 15, fontWeight: "800", color: theme.text, textAlign: "right", marginBottom: 10 },
  line: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  lineMain: { flex: 1, minWidth: 0 },
  lineName: { fontSize: 14, fontWeight: "700", color: theme.text, textAlign: "right" },
  lineMeta: { fontSize: 12, color: theme.muted, marginTop: 2, textAlign: "right" },
  lineAmount: { fontSize: 14, fontWeight: "800", color: theme.accentDark },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
  },
  totalLabel: { fontSize: 15, fontWeight: "700", color: theme.muted },
  totalValue: { fontSize: 18, fontWeight: "800", color: theme.text },
  paymentLabel: { color: theme.muted, fontSize: 12, fontWeight: "600", textAlign: "right", marginTop: 14 },
  segmented: {
    flexDirection: "row-reverse",
    backgroundColor: "#e2e8f0",
    borderRadius: theme.radius.md,
    padding: 4,
    marginTop: 8,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.sm, alignItems: "center" },
  segmentOn: { backgroundColor: theme.card },
  segmentText: { color: theme.muted, fontWeight: "700", fontSize: 14 },
  segmentTextOn: { color: theme.accent },
  submit: {
    marginTop: 14,
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: theme.radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.accent2,
  },
  submitText: { color: theme.onAccent, fontWeight: "800", fontSize: 16 },
});
