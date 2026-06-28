import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { theme } from "./theme";
import type { ProspectCard } from "./storeTypes";

export type PossibleClientsLabels = {
  title: string;
  hint: string;
  empty: string;
  add: string;
  linkQr: string;
  visited: string;
  pending: string;
  searchPlaceholder: string;
  pill: string;
};

type Props = {
  prospects: ProspectCard[];
  loading: boolean;
  labels: PossibleClientsLabels;
  onAdd: () => void;
  onLinkQr: (prospect: ProspectCard) => void;
};

export default function PossibleClientsSection(props: Props) {
  const { prospects, loading, labels, onAdd, onLinkQr } = props;
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prospects;
    return prospects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.ownerName.toLowerCase().includes(q) ||
        (p.areaName ?? "").toLowerCase().includes(q)
    );
  }, [prospects, search]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={styles.headText}>
          <Text style={styles.title}>{labels.title}</Text>
          <Text style={styles.hint}>{labels.hint}</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>{labels.add}</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder={labels.searchPlaceholder}
        placeholderTextColor={theme.muted}
        textAlign="right"
      />

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>{labels.empty}</Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((p) => (
            <View key={p.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{labels.pill}</Text>
                </View>
                {p.visitedToday ? (
                  <View style={styles.visitedPill}>
                    <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                    <Text style={styles.visitedText}>{labels.visited}</Text>
                  </View>
                ) : (
                  <Text style={styles.pendingText}>{labels.pending}</Text>
                )}
              </View>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>
                {p.ownerName} · {p.phone}
              </Text>
              {p.areaName ? <Text style={styles.area}>{p.areaName}</Text> : null}
              {p.addressText ? <Text style={styles.address}>{p.addressText}</Text> : null}
              <Pressable style={styles.linkBtn} onPress={() => onLinkQr(p)}>
                <Ionicons name="qr-code-outline" size={18} color={theme.accentDark} />
                <Text style={styles.linkBtnText}>{labels.linkQr}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.xl,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.line,
    ...theme.shadow.card,
  },
  headRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  headText: { flex: 1 },
  title: { color: theme.text, fontSize: 17, fontWeight: "800", textAlign: "right" },
  hint: { color: theme.muted, fontSize: 12, marginTop: 4, textAlign: "right", lineHeight: 18 },
  addBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
  },
  addBtnText: { color: theme.onAccent, fontWeight: "800", fontSize: 13 },
  search: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#f8fafc",
    color: theme.text,
    marginBottom: 12,
  },
  loadingRow: { paddingVertical: 20, alignItems: "center" },
  empty: { color: theme.muted, textAlign: "center", paddingVertical: 16 },
  list: { gap: 10 },
  card: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: theme.radius.lg,
    padding: 14,
    backgroundColor: "#fafafa",
  },
  cardTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pill: {
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  pillText: { color: "#b45309", fontSize: 11, fontWeight: "800" },
  visitedPill: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  visitedText: { color: "#16a34a", fontSize: 12, fontWeight: "700" },
  pendingText: { color: theme.muted, fontSize: 12, fontWeight: "600" },
  name: { color: theme.text, fontSize: 16, fontWeight: "800", textAlign: "right" },
  meta: { color: theme.muted, fontSize: 13, marginTop: 4, textAlign: "right" },
  area: { color: theme.accentDark, fontSize: 12, marginTop: 4, textAlign: "right", fontWeight: "600" },
  address: { color: theme.muted, fontSize: 12, marginTop: 4, textAlign: "right" },
  linkBtn: {
    marginTop: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.accent,
    backgroundColor: theme.accentSoft,
  },
  linkBtnText: { color: theme.accentDark, fontWeight: "800", fontSize: 14 },
});
