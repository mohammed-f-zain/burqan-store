import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { productImageUrl } from "./productImage";
import { theme } from "./theme";

export type Product = {
  id: number;
  name: string;
  price: string;
  designation?: string | null;
  unit_label?: string | null;
  image_url?: string | null;
  quantity: number;
};

type Labels = {
  close: string;
  priceLabel: string;
  unit: string;
  stock: string;
  description: string;
  noImage: string;
  currency: string;
  inCart: string;
};

type Props = {
  visible: boolean;
  product: Product | null;
  viewOnly?: boolean;
  cartQty: number;
  atMax: boolean;
  labels: Labels;
  onClose: () => void;
  onMinus: () => void;
  onPlus: () => void;
};

export default function ProductDetailModal(props: Props) {
  const { product, visible, cartQty, atMax, labels, viewOnly } = props;
  if (!product) return null;

  const uri = productImageUrl(product.image_url);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Pressable onPress={props.onClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeBtnText}>{labels.close}</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.heroWrap}>
            {uri ? (
              <Image source={{ uri }} style={styles.heroImage} resizeMode="contain" />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Text style={styles.heroPlaceholderText}>{labels.noImage}</Text>
              </View>
            )}
          </View>

          <View style={styles.bodyCard}>
            <Text style={styles.name}>{product.name}</Text>

            <View style={styles.chipRow}>
              <Text style={styles.price}>
                {product.price} {labels.currency}
              </Text>
              <View style={styles.stockChip}>
                <Text style={styles.stockChipText}>
                  {labels.stock} {product.quantity}
                </Text>
              </View>
            </View>

            {product.unit_label ? (
              <Text style={styles.meta}>
                {labels.unit}: {product.unit_label}
              </Text>
            ) : null}

            {product.designation ? (
              <>
                <Text style={styles.descTitle}>{labels.description}</Text>
                <Text style={styles.descBody}>{product.designation}</Text>
              </>
            ) : null}
          </View>
        </ScrollView>

        {!viewOnly ? (
          <View style={styles.footer}>
            <View style={styles.qtyRow}>
              <Pressable style={styles.qtyBtn} onPress={props.onMinus}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <View style={styles.qtyCenter}>
                <Text style={styles.qtyNum}>{cartQty}</Text>
                {cartQty > 0 ? <Text style={styles.inCart}>{labels.inCart}</Text> : null}
              </View>
              <Pressable style={styles.qtyBtn} onPress={props.onPlus} disabled={atMax}>
                <Text style={[styles.qtyBtnText, atMax && styles.qtyBtnDisabled]}>+</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  topBar: {
    flexDirection: "row-reverse",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accentSoft,
  },
  closeBtnText: { color: theme.accent, fontWeight: "800", fontSize: 15 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  heroWrap: {
    height: 280,
    backgroundColor: "#f8fafc",
    marginHorizontal: 16,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
  },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroPlaceholderText: { color: theme.muted, fontWeight: "600" },
  bodyCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: theme.card,
    borderRadius: theme.radius.xl,
    padding: 20,
    ...theme.shadow.card,
  },
  name: { color: theme.text, fontSize: 22, fontWeight: "800", textAlign: "right", lineHeight: 30 },
  chipRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    flexWrap: "wrap",
    gap: 10,
  },
  price: { color: theme.accent, fontSize: 22, fontWeight: "800" },
  stockChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accentSoft,
  },
  stockChipText: { color: theme.accentDark, fontSize: 14, fontWeight: "700" },
  meta: { color: theme.muted, fontSize: 15, marginTop: 12, textAlign: "right" },
  descTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 18,
    marginBottom: 6,
  },
  descBody: { color: theme.text, fontSize: 16, lineHeight: 26, textAlign: "right" },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.card,
  },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  qtyBtn: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { color: theme.text, fontSize: 26, fontWeight: "700" },
  qtyBtnDisabled: { opacity: 0.35 },
  qtyCenter: { alignItems: "center", minWidth: 64 },
  qtyNum: { color: theme.text, fontWeight: "800", fontSize: 24 },
  inCart: { color: theme.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
});
