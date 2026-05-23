import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { productImageUrl } from "./productImage";
import { theme } from "./theme";
import type { Product } from "./ProductDetailModal";

type Props = {
  item: Product;
  width: number;
  currency: string;
  noImage: string;
  /** When false, hide van stock badge (catalog-only view). */
  showStock?: boolean;
  onPress: () => void;
};

const IMAGE_ASPECT = 1;

export default function ProductGridCard(props: Props) {
  const uri = productImageUrl(props.item.image_url);
  const imageHeight = Math.round(props.width * IMAGE_ASPECT);

  return (
    <Pressable
      style={[styles.card, { width: props.width }]}
      onPress={props.onPress}
      accessibilityRole="button"
    >
      <View style={[styles.imageWrap, { width: props.width, height: imageHeight }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>{props.noImage}</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {props.item.name}
        </Text>
        <View style={styles.footerRow}>
          <Text style={styles.price}>
            {props.item.price} {props.currency}
          </Text>
          {props.showStock !== false ? (
            <View style={styles.stockBadge}>
              <Text style={styles.stockText}>{props.item.quantity}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    marginBottom: 12,
    ...theme.shadow.card,
  },
  imageWrap: {
    overflow: "hidden",
    backgroundColor: "#f8fafc",
  },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  placeholderText: { color: theme.muted, fontSize: 11, fontWeight: "600" },
  body: { padding: 12 },
  name: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 20,
    minHeight: 40,
  },
  footerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  price: { color: theme.accent, fontSize: 15, fontWeight: "800" },
  stockBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  stockText: { color: theme.accentDark, fontSize: 13, fontWeight: "800" },
});
