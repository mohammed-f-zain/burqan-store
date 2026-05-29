import { useCallback } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";

import ProductGridCard from "./ProductGridCard";
import type { Product } from "./ProductDetailModal";
import { theme } from "./theme";

type Props = {
  products: Product[];
  columns: number;
  cardWidth: number;
  gap: number;
  currency: string;
  noImage: string;
  emptyLabel: string;
  refreshing: boolean;
  onRefresh: () => void;
  onSelect: (item: Product) => void;
};

export default function ProductCatalogGrid({
  products,
  columns,
  cardWidth,
  gap,
  currency,
  noImage,
  emptyLabel,
  refreshing,
  onRefresh,
  onSelect,
}: Props) {
  const renderItem: ListRenderItem<Product> = useCallback(
    ({ item }) => (
      <View style={[styles.cell, { width: cardWidth, marginBottom: gap }]}>
        <ProductGridCard
          item={item}
          width={cardWidth}
          currency={currency}
          noImage={noImage}
          showStock
          embedded
          onPress={() => onSelect(item)}
        />
      </View>
    ),
    [cardWidth, currency, gap, noImage, onSelect]
  );

  if (products.length === 0) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }

  return (
    <FlatList
      data={products}
      key={columns}
      keyExtractor={(item) => String(item.id)}
      numColumns={columns}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: gap }]}
      columnWrapperStyle={columns > 1 ? [styles.row, { gap, marginBottom: 0 }] : undefined}
      showsVerticalScrollIndicator
      initialNumToRender={columns * 4}
      maxToRenderPerBatch={columns * 6}
      windowSize={7}
      removeClippedSubviews
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { flexGrow: 1 },
  row: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  cell: {},
  empty: {
    color: theme.muted,
    fontSize: 15,
    textAlign: "center",
    marginTop: 24,
    fontWeight: "600",
  },
});
