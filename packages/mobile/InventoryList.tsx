import { useCallback, type ReactElement } from "react";
import { FlatList, StyleSheet, Text, type ListRenderItem } from "react-native";

import type { Product } from "./ProductDetailModal";
import { theme } from "./theme";

type ProductCardProps = {
  item: Product;
  mode: "stock";
};

type Props = {
  items: Product[];
  emptyLabel: string;
  renderCard: (props: ProductCardProps) => ReactElement;
};

export default function InventoryList({ items, emptyLabel, renderCard }: Props) {
  const renderItem: ListRenderItem<Product> = useCallback(
    ({ item }) => renderCard({ item, mode: "stock" }),
    [renderCard]
  );

  if (items.length === 0) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      initialNumToRender={12}
      maxToRenderPerBatch={16}
      windowSize={8}
      removeClippedSubviews
      showsVerticalScrollIndicator
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingBottom: 16, flexGrow: 1 },
  empty: {
    color: theme.muted,
    fontSize: 15,
    textAlign: "center",
    marginTop: 24,
    fontWeight: "600",
  },
});
