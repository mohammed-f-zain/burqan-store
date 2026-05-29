import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ComponentProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isTabletDevice, tabletContentMaxWidth } from "./deviceLayout";
import { productImageUrl } from "./productImage";
import { theme } from "./theme";

export type Product = {
  id: number;
  name: string;
  price: string;
  designation?: string | null;
  unit_label?: string | null;
  carton_spec?: string | null;
  dimensions_cm?: string | null;
  carton_weight_kg?: string | null;
  image_url?: string | null;
  quantity: number;
};

type Labels = {
  close: string;
  priceLabel: string;
  unit: string;
  stock: string;
  vanStock: string;
  description: string;
  productCode: string;
  specsTitle: string;
  cartonSpec: string;
  dimensions: string;
  cartonWeight: string;
  notSpecified: string;
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

function displayValue(value: string | null | undefined, fallback: string): string {
  const t = value?.trim();
  return t ? t : fallback;
}

function formatCartonWeight(value: string | null | undefined, fallback: string): string {
  const t = value?.trim();
  if (!t) return fallback;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return t;
  return `${n} كغ`;
}

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function SpecRow({
  icon,
  label,
  value,
  last,
}: {
  icon: IoniconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.specRow, !last && styles.specRowBorder]}>
      <View style={styles.specIconWrap}>
        <Ionicons name={icon} size={18} color={theme.accent} />
      </View>
      <View style={styles.specText}>
        <Text style={styles.specLabel}>{label}</Text>
        <Text style={styles.specValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProductDetailModal(props: Props) {
  const { product, visible, cartQty, atMax, labels, viewOnly } = props;
  const { width: winW, height: winH } = useWindowDimensions();
  const isTablet = isTabletDevice();
  const contentMax = isTablet ? tabletContentMaxWidth(winW, winH) : undefined;
  const heroHeight = isTablet ? 320 : 260;

  if (!product) return null;

  const uri = productImageUrl(product.image_url);
  const dash = labels.notSpecified;

  const specRows: { icon: IoniconName; label: string; value: string }[] = [
    { icon: "barcode-outline", label: labels.productCode, value: `#${product.id}` },
    { icon: "cube-outline", label: labels.unit, value: displayValue(product.unit_label, dash) },
    { icon: "archive-outline", label: labels.cartonSpec, value: displayValue(product.carton_spec, dash) },
    { icon: "resize-outline", label: labels.dimensions, value: displayValue(product.dimensions_cm, dash) },
    {
      icon: "scale-outline",
      label: labels.cartonWeight,
      value: formatCartonWeight(product.carton_weight_kg, dash),
    },
  ];

  const designation = product.designation?.trim();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={[styles.topBar, contentMax ? { alignSelf: "center", maxWidth: contentMax, width: "100%" } : null]}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {product.name}
          </Text>
          <Pressable onPress={props.onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.accent} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            contentMax ? { maxWidth: contentMax, width: "100%", alignSelf: "center" } : null,
            { paddingBottom: viewOnly ? 32 : 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.heroWrap, { height: heroHeight }]}>
            {uri ? (
              <Image source={{ uri }} style={styles.heroImage} resizeMode="contain" />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Ionicons name="image-outline" size={48} color={theme.muted} />
                <Text style={styles.heroPlaceholderText}>{labels.noImage}</Text>
              </View>
            )}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.name}>{product.name}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.priceBlock}>
                <Text style={styles.priceLabel}>{labels.priceLabel}</Text>
                <Text style={styles.price}>
                  {product.price} {labels.currency}
                </Text>
              </View>
              <View style={[styles.stockChip, product.quantity === 0 && styles.stockChipEmpty]}>
                <Ionicons
                  name="car-outline"
                  size={16}
                  color={product.quantity > 0 ? theme.accentDark : theme.muted}
                />
                <Text style={[styles.stockChipText, product.quantity === 0 && styles.stockChipTextEmpty]}>
                  {labels.vanStock}: {product.quantity}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.specsCard}>
            <Text style={styles.sectionTitle}>{labels.specsTitle}</Text>
            {specRows.map((row, i) => (
              <SpecRow
                key={row.label}
                icon={row.icon}
                label={row.label}
                value={row.value}
                last={i === specRows.length - 1 && !designation}
              />
            ))}
            {designation ? (
              <View style={[styles.descBlock, specRows.length > 0 && styles.descBlockBorder]}>
                <View style={styles.specIconWrap}>
                  <Ionicons name="document-text-outline" size={18} color={theme.accent} />
                </View>
                <View style={styles.specText}>
                  <Text style={styles.specLabel}>{labels.description}</Text>
                  <Text style={styles.descBody}>{designation}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {!viewOnly ? (
          <View
            style={[
              styles.footer,
              contentMax ? { alignSelf: "center", maxWidth: contentMax, width: "100%" } : null,
            ]}
          >
            <Text style={styles.footerHint}>{labels.inCart}</Text>
            <View style={styles.qtyRow}>
              <Pressable style={styles.qtyBtn} onPress={props.onMinus}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <View style={styles.qtyCenter}>
                <Text style={styles.qtyNum}>{cartQty}</Text>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    backgroundColor: theme.card,
  },
  topTitle: {
    flex: 1,
    color: theme.text,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 12 },
  heroWrap: {
    backgroundColor: "#f8fafc",
    marginHorizontal: 16,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.line,
  },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  heroPlaceholderText: { color: theme.muted, fontWeight: "600", fontSize: 14 },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: theme.card,
    borderRadius: theme.radius.xl,
    padding: 18,
    ...theme.shadow.card,
  },
  name: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 28,
  },
  summaryRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 12,
    flexWrap: "wrap",
  },
  priceBlock: { alignItems: "flex-end" },
  priceLabel: { color: theme.muted, fontSize: 12, fontWeight: "600", marginBottom: 4 },
  price: { color: theme.accent, fontSize: 26, fontWeight: "800" },
  stockChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accentSoft,
  },
  stockChipEmpty: { backgroundColor: "#f1f5f9" },
  stockChipText: { color: theme.accentDark, fontSize: 14, fontWeight: "800" },
  stockChipTextEmpty: { color: theme.muted },
  specsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: theme.card,
    borderRadius: theme.radius.xl,
    paddingVertical: 6,
    paddingHorizontal: 4,
    ...theme.shadow.card,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  specRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  specRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  specIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  specText: { flex: 1, minWidth: 0 },
  specLabel: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
    marginBottom: 4,
  },
  specValue: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 22,
  },
  descBlock: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  descBlockBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.line,
  },
  descBody: {
    color: theme.text,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "right",
    fontWeight: "500",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.card,
  },
  footerHint: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 },
  qtyBtn: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  qtyBtnText: { color: theme.text, fontSize: 26, fontWeight: "700" },
  qtyBtnDisabled: { opacity: 0.35 },
  qtyCenter: {
    alignItems: "center",
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: "#f8fafc",
  },
  qtyNum: { color: theme.text, fontWeight: "800", fontSize: 26 },
});
