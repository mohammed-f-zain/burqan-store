import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { theme } from "./theme";
import type { DailyStoreCard } from "./storeTypes";

const { card, text, muted, line, accent, radius, shadow } = theme;

export type GooglePlacesLabels = {
  hint: string;
  empty: string;
  notReady: string;
  truncated: (shown: number, total: number) => string;
  unknownArea: string;
  storeCount: (n: number) => string;
  searchPlaceholder: string;
  expandAll: string;
  collapseAll: string;
  noSearchResults: string;
  googlePill: string;
  openMaps: string;
};

type AreaGroup = { areaName: string; stores: DailyStoreCard[] };

const GOVERNORATES = new Set([
  "عمان",
  "إربد",
  "الزرقاء",
  "المفرق",
  "العقبة",
  "الكرك",
  "معان",
  "الطفيلة",
  "مادبا",
  "جرش",
  "عجلون",
  "البلقاء",
]);

function parseAreaName(raw: string, unknownLabel: string): { title: string; subtitle?: string } {
  const t = raw.trim();
  if (!t) return { title: unknownLabel };
  if (t.includes("شبكة")) return { title: t.replace(/\s*—\s*شبكة\s*\d+/, "").trim() || t, subtitle: "منطقة قديمة" };
  const dash = t.indexOf(" — ");
  if (dash > 0) {
    const left = t.slice(0, dash).trim();
    const right = t.slice(dash + 3).trim();
    if (GOVERNORATES.has(left)) return { title: right, subtitle: left };
  }
  return { title: t };
}

function groupStoresByArea(stores: DailyStoreCard[], repAreaNames: string[]): AreaGroup[] {
  const byArea = new Map<string, DailyStoreCard[]>();
  for (const s of stores) {
    const key = s.areaName?.trim() || "";
    if (!byArea.has(key)) byArea.set(key, []);
    byArea.get(key)!.push(s);
  }

  const keys = [...byArea.keys()];
  keys.sort((a, b) => {
    const ia = repAreaNames.indexOf(a);
    const ib = repAreaNames.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b, "ar");
  });

  return keys.map((areaName) => ({
    areaName,
    stores: [...byArea.get(areaName)!].sort((x, y) => x.name.localeCompare(y.name, "ar")),
  }));
}

function defaultExpanded(groups: AreaGroup[]): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const g of groups) {
    next[g.areaName || "__unknown__"] = true;
  }
  if (groups[0] && Object.keys(next).length === 0) {
    next[groups[0].areaName || "__unknown__"] = true;
  }
  return next;
}

function matchesSearch(store: DailyStoreCard, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    store.name.toLowerCase().includes(needle) ||
    (store.areaName?.toLowerCase().includes(needle) ?? false) ||
    (store.addressText?.toLowerCase().includes(needle) ?? false)
  );
}

type Props = {
  places: DailyStoreCard[];
  repAreaNames: string[];
  loading: boolean;
  notReady?: boolean;
  truncated?: boolean;
  totalCount?: number;
  labels: GooglePlacesLabels;
  title: string;
  onSelectPlace: (place: DailyStoreCard) => void;
};

export default function GooglePlacesByArea({
  places,
  repAreaNames,
  loading,
  notReady = false,
  truncated = false,
  totalCount = 0,
  labels,
  title,
  onSelectPlace,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  const filteredPlaces = useMemo(
    () => places.filter((p) => matchesSearch(p, search)),
    [places, search]
  );

  const groups = useMemo(
    () => groupStoresByArea(filteredPlaces, repAreaNames),
    [filteredPlaces, repAreaNames]
  );

  useEffect(() => {
    if (!places.length) {
      setExpanded({});
      return;
    }
    setExpanded(defaultExpanded(groupStoresByArea(places, repAreaNames)));
  }, [places, repAreaNames]);

  const areaKey = (name: string) => name || "__unknown__";

  const setAllExpanded = (open: boolean) => {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[areaKey(g.areaName)] = open;
    setExpanded(next);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {!loading && places.length > 0 ? (
          <View style={styles.headerBadge}>
            <Ionicons name="logo-google" size={14} color="#ea580c" />
            <Text style={styles.headerBadgeText}>{labels.storeCount(places.length)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.hint}>{labels.hint}</Text>
      {!loading && truncated && totalCount > places.length ? (
        <Text style={styles.truncatedHint}>
          {labels.truncated(places.length, totalCount)}
        </Text>
      ) : null}

      {!loading && places.length > 0 ? (
        <>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={labels.searchPlaceholder}
              placeholderTextColor={muted}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>

          {groups.length > 1 ? (
            <Pressable
              style={styles.expandToggle}
              onPress={() => {
                const anyClosed = groups.some((g) => !expanded[areaKey(g.areaName)]);
                setAllExpanded(anyClosed);
              }}
            >
              <Text style={styles.expandToggleText}>
                {groups.every((g) => expanded[areaKey(g.areaName)]) ? labels.collapseAll : labels.expandAll}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {loading ? (
        <ActivityIndicator color="#ea580c" style={{ marginTop: 20 }} />
      ) : notReady ? (
        <View style={styles.emptyBox}>
          <Ionicons name="cloud-offline-outline" size={40} color={muted} />
          <Text style={styles.empty}>{labels.notReady}</Text>
        </View>
      ) : places.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="map-outline" size={40} color={muted} />
          <Text style={styles.empty}>{labels.empty}</Text>
        </View>
      ) : filteredPlaces.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="search-outline" size={40} color={muted} />
          <Text style={styles.empty}>{labels.noSearchResults}</Text>
        </View>
      ) : (
        groups.map((group) => {
          const key = areaKey(group.areaName);
          const isOpen = expanded[key] ?? false;
          const areaDisplay = parseAreaName(group.areaName, labels.unknownArea);

          return (
            <View key={key} style={styles.areaBlock}>
              <Pressable
                style={({ pressed }) => [
                  styles.areaHeader,
                  isOpen && styles.areaHeaderOpen,
                  pressed && styles.pressed,
                ]}
                onPress={() => setExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
              >
                <View style={styles.areaIconWrap}>
                  <Ionicons name="location" size={20} color="#ea580c" />
                </View>
                <View style={styles.areaHeaderBody}>
                  <Text style={styles.areaName} numberOfLines={2}>
                    {areaDisplay.title}
                  </Text>
                  {areaDisplay.subtitle ? (
                    <Text style={styles.areaSubtitle} numberOfLines={1}>
                      {areaDisplay.subtitle}
                    </Text>
                  ) : null}
                  <Text style={styles.areaMeta}>{labels.storeCount(group.stores.length)}</Text>
                </View>
                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={22} color="#ea580c" />
              </Pressable>

              {isOpen
                ? group.stores.map((s, idx) => (
                    <Pressable
                      key={`google-${s.id}`}
                      style={({ pressed }) => [
                        styles.placeCard,
                        idx === group.stores.length - 1 && styles.placeCardLast,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => onSelectPlace(s)}
                    >
                      <View style={styles.placeDot} />
                      <View style={styles.placeBody}>
                        <Text style={styles.placeName} numberOfLines={1}>
                          {s.name}
                        </Text>
                        <Text style={styles.placeMeta} numberOfLines={2}>
                          {s.addressText || labels.openMaps}
                        </Text>
                      </View>
                      <View style={styles.googlePill}>
                        <Ionicons name="logo-google" size={14} color="#ea580c" />
                        <Text style={styles.googlePillText}>{labels.googlePill}</Text>
                      </View>
                    </Pressable>
                  ))
                : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
    backgroundColor: card,
    borderRadius: radius.xl,
    padding: 16,
    ...shadow.card,
  },
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: { color: text, fontSize: 18, fontWeight: "800", textAlign: "right", flex: 1 },
  headerBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffedd5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  headerBadgeText: { color: "#ea580c", fontSize: 12, fontWeight: "800" },
  hint: { color: muted, fontSize: 13, marginTop: 8, textAlign: "right", lineHeight: 20 },
  truncatedHint: {
    color: "#b45309",
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
    fontWeight: "700",
  },
  searchWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 14,
    backgroundColor: "#f8fafc",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line,
    paddingHorizontal: 12,
  },
  searchIcon: { marginLeft: 4 },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: text,
    textAlign: "right",
  },
  expandToggle: { alignSelf: "flex-end", paddingVertical: 10, paddingHorizontal: 4 },
  expandToggleText: { color: "#ea580c", fontSize: 13, fontWeight: "700" },
  emptyBox: { alignItems: "center", marginTop: 28, marginBottom: 8, gap: 10 },
  empty: { color: muted, fontSize: 15, fontWeight: "600", textAlign: "center", lineHeight: 22 },
  areaBlock: { marginTop: 12 },
  areaHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff7ed",
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.15)",
  },
  areaHeaderOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  areaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: card,
    alignItems: "center",
    justifyContent: "center",
  },
  areaHeaderBody: { flex: 1, minWidth: 0 },
  areaName: { color: text, fontSize: 16, fontWeight: "800", textAlign: "right" },
  areaSubtitle: { color: muted, fontSize: 12, marginTop: 2, textAlign: "right" },
  areaMeta: { color: muted, fontSize: 11, marginTop: 6, textAlign: "right", fontWeight: "600" },
  placeCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff7ed",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.12)",
    borderTopWidth: 0,
  },
  placeCardLast: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  placeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ea580c",
  },
  placeBody: { flex: 1, minWidth: 0 },
  placeName: { color: text, fontSize: 15, fontWeight: "800", textAlign: "right" },
  placeMeta: { color: muted, fontSize: 13, marginTop: 3, textAlign: "right" },
  googlePill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffedd5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  googlePillText: { color: "#ea580c", fontSize: 11, fontWeight: "800" },
  pressed: { opacity: 0.88 },
});
