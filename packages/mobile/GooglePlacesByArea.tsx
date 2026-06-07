import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
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

const { card, text, muted, line, radius, shadow } = theme;

export type GooglePlaceAreaSummary = {
  areaId: number;
  areaName: string;
  count: number;
};

export type GooglePlacesLabels = {
  hint: string;
  lazyHint: string;
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
  loadingArea: string;
};

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

function sortAreas(areas: GooglePlaceAreaSummary[], repAreaNames: string[]): GooglePlaceAreaSummary[] {
  return [...areas].sort((a, b) => {
    const ia = repAreaNames.indexOf(a.areaName);
    const ib = repAreaNames.indexOf(b.areaName);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.areaName.localeCompare(b.areaName, "ar");
  });
}

type Props = {
  areaSummaries: GooglePlaceAreaSummary[];
  placesByAreaId: Record<number, DailyStoreCard[]>;
  loadingAreaIds: Record<number, boolean>;
  searchResults: DailyStoreCard[] | null;
  searchLoading: boolean;
  repAreaNames: string[];
  loading: boolean;
  notReady?: boolean;
  totalCount: number;
  labels: GooglePlacesLabels;
  title: string;
  onSelectPlace: (place: DailyStoreCard) => void;
  onExpandArea: (areaId: number) => void;
  onSearch: (query: string) => void;
};

function PlaceRow({
  place,
  isLast,
  labels,
  onPress,
}: {
  place: DailyStoreCard;
  isLast: boolean;
  labels: GooglePlacesLabels;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.placeCard,
        isLast && styles.placeCardLast,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.placeDot} />
      <View style={styles.placeBody}>
        <Text style={styles.placeName} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={styles.placeMeta} numberOfLines={2}>
          {place.addressText || labels.openMaps}
        </Text>
      </View>
      <View style={styles.googlePill}>
        <Ionicons name="logo-google" size={14} color="#ea580c" />
        <Text style={styles.googlePillText}>{labels.googlePill}</Text>
      </View>
    </Pressable>
  );
}

export default function GooglePlacesByArea({
  areaSummaries,
  placesByAreaId,
  loadingAreaIds,
  searchResults,
  searchLoading,
  repAreaNames,
  loading,
  notReady = false,
  totalCount,
  labels,
  title,
  onSelectPlace,
  onExpandArea,
  onSearch,
}: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState("");
  const autoExpandedRef = useRef(false);

  const sortedAreas = useMemo(
    () => sortAreas(areaSummaries, repAreaNames),
    [areaSummaries, repAreaNames]
  );

  const isSearching = search.trim().length >= 2;

  useEffect(() => {
    const t = setTimeout(() => onSearch(search), 350);
    return () => clearTimeout(t);
  }, [search, onSearch]);

  useEffect(() => {
    if (!areaSummaries.length) {
      setExpanded({});
      autoExpandedRef.current = false;
      return;
    }
    if (autoExpandedRef.current) return;
    autoExpandedRef.current = true;
    const first = sortAreas(areaSummaries, repAreaNames)[0];
    if (!first) return;
    setExpanded((prev) => ({ ...prev, [first.areaId]: true }));
    if (!placesByAreaId[first.areaId]) onExpandArea(first.areaId);
  }, [areaSummaries, repAreaNames, onExpandArea]);

  const setAllExpanded = (open: boolean) => {
    const next: Record<number, boolean> = {};
    for (const a of sortedAreas) next[a.areaId] = open;
    setExpanded(next);
    if (open) {
      for (const a of sortedAreas) {
        if (!placesByAreaId[a.areaId]) onExpandArea(a.areaId);
      }
    }
  };

  const toggleArea = (areaId: number) => {
    const willOpen = !expanded[areaId];
    setExpanded((prev) => ({ ...prev, [areaId]: willOpen }));
    if (willOpen && !placesByAreaId[areaId]) onExpandArea(areaId);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {!loading && totalCount > 0 ? (
          <View style={styles.headerBadge}>
            <Ionicons name="logo-google" size={14} color="#ea580c" />
            <Text style={styles.headerBadgeText}>{labels.storeCount(totalCount)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.hint}>{isSearching ? labels.hint : labels.lazyHint}</Text>

      {!loading && totalCount > 0 ? (
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

          {!isSearching && sortedAreas.length > 1 ? (
            <Pressable
              style={styles.expandToggle}
              onPress={() => {
                const anyClosed = sortedAreas.some((a) => !expanded[a.areaId]);
                setAllExpanded(anyClosed);
              }}
            >
              <Text style={styles.expandToggleText}>
                {sortedAreas.every((a) => expanded[a.areaId]) ? labels.collapseAll : labels.expandAll}
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
      ) : totalCount === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="map-outline" size={40} color={muted} />
          <Text style={styles.empty}>{labels.empty}</Text>
        </View>
      ) : isSearching ? (
        searchLoading ? (
          <ActivityIndicator color="#ea580c" style={{ marginTop: 20 }} />
        ) : !searchResults?.length ? (
          <View style={styles.emptyBox}>
            <Ionicons name="search-outline" size={40} color={muted} />
            <Text style={styles.empty}>{labels.noSearchResults}</Text>
          </View>
        ) : (
          searchResults.map((p, idx) => (
            <PlaceRow
              key={`search-${p.id}`}
              place={p}
              isLast={idx === searchResults.length - 1}
              labels={labels}
              onPress={() => onSelectPlace(p)}
            />
          ))
        )
      ) : (
        sortedAreas.map((area) => {
          const isOpen = expanded[area.areaId] ?? false;
          const places = placesByAreaId[area.areaId];
          const areaLoading = loadingAreaIds[area.areaId];
          const areaDisplay = parseAreaName(area.areaName, labels.unknownArea);

          return (
            <View key={area.areaId} style={styles.areaBlock}>
              <Pressable
                style={({ pressed }) => [
                  styles.areaHeader,
                  isOpen && styles.areaHeaderOpen,
                  pressed && styles.pressed,
                ]}
                onPress={() => toggleArea(area.areaId)}
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
                  <Text style={styles.areaMeta}>{labels.storeCount(area.count)}</Text>
                </View>
                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={22} color="#ea580c" />
              </Pressable>

              {isOpen ? (
                areaLoading && !places ? (
                  <View style={styles.areaLoading}>
                    <ActivityIndicator color="#ea580c" size="small" />
                    <Text style={styles.areaLoadingText}>{labels.loadingArea}</Text>
                  </View>
                ) : places?.length ? (
                  places.map((p, idx) => (
                    <PlaceRow
                      key={`google-${p.id}`}
                      place={p}
                      isLast={idx === places.length - 1}
                      labels={labels}
                      onPress={() => onSelectPlace(p)}
                    />
                  ))
                ) : (
                  <View style={styles.areaLoading}>
                    <Text style={styles.areaLoadingText}>{labels.empty}</Text>
                  </View>
                )
              ) : null}
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
  areaLoading: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "rgba(234, 88, 12, 0.12)",
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  areaLoadingText: { color: muted, fontSize: 13 },
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
