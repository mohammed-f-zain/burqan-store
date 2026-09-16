import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import RouteStoresMap from "./RouteStoresMap";
import { theme } from "./theme";
import type { DailyStoreCard } from "./storeTypes";
import type { MapRegion } from "./registerMapConfig";
import { dailyStoresToPins } from "./zoneMapTypes";
import { formatMarketDate } from "./formatMarketDateTime";
import { compareStoresByMode, type StoreSortMode } from "./geoDistance";

export type RouteDayLabels = {
  title: string;
  subtitle: string;
  today: (day: string, zone: string) => string;
  areasIncluded: string;
  storesCount: (n: number) => string;
  possibleCount: (n: number) => string;
  possiblePill: string;
  nearestFirst: string;
  empty: string;
  noSchedule: string;
  noZoneAreas: string;
  locating: string;
  locationDenied: string;
  loadFailed: string;
  visited: string;
  pending: string;
  lastVisit: (date: string) => string;
  lastVisitNever: string;
  searchPlaceholder: string;
  filterAll: string;
  filterPending: string;
  filterDone: string;
  noSearchResults: string;
  refreshLocation: string;
  sortByDistance?: string;
  sortByLastVisit?: string;
  expandAll?: string;
  collapseAll?: string;
  storeCount?: (n: number) => string;
  pendingCount?: (n: number) => string;
  unknownArea?: string;
  allVisited?: string;
};

type RouteMeta = {
  active: boolean;
  dayName?: string;
  routeZone?: { id: number; name: string; notes?: string | null; areas?: string[] };
  message?: string;
};

type Props = {
  stores: DailyStoreCard[];
  meta: RouteMeta | null;
  loading: boolean;
  locating: boolean;
  refreshing: boolean;
  labels: RouteDayLabels;
  onRefresh: () => void;
  onRefreshLocation: () => void;
  onSelectStore: (store: DailyStoreCard) => void;
  sortMode?: StoreSortMode;
  onSortModeChange?: (m: StoreSortMode) => void;
};

type FilterMode = "all" | "pending" | "done";
type AreaGroup = { areaName: string; stores: DailyStoreCard[] };

const ROUTE_MAP_HEIGHT = 200;

const JORDAN_REGION: MapRegion = {
  latitude: 31.25,
  longitude: 36.5,
  latitudeDelta: 4.8,
  longitudeDelta: 4.2,
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

function sortStoresInArea(stores: DailyStoreCard[], sortMode: StoreSortMode): DailyStoreCard[] {
  return [...stores].sort((a, b) => compareStoresByMode(a, b, sortMode));
}

function groupStoresByArea(
  stores: DailyStoreCard[],
  repAreaNames: string[],
  sortMode: StoreSortMode
): AreaGroup[] {
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
    stores: sortStoresInArea(byArea.get(areaName)!, sortMode),
  }));
}

function sortGroupsPendingFirst(groups: AreaGroup[]): AreaGroup[] {
  return [...groups].sort((a, b) => {
    const aPending = a.stores.some((s) => !s.visitedToday);
    const bPending = b.stores.some((s) => !s.visitedToday);
    if (aPending !== bPending) return aPending ? -1 : 1;
    return a.areaName.localeCompare(b.areaName, "ar");
  });
}

function defaultExpanded(groups: AreaGroup[]): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const g of groups) {
    const key = g.areaName || "__unknown__";
    next[key] = g.stores.some((s) => !s.visitedToday);
  }
  if (Object.values(next).every((v) => !v) && groups[0]) {
    next[groups[0].areaName || "__unknown__"] = true;
  }
  return next;
}

function areaKey(name: string): string {
  return name || "__unknown__";
}

export default function RouteDayStores(props: Props) {
  const { stores, meta, loading, locating, labels } = props;
  const [internalSortMode, setInternalSortMode] = useState<StoreSortMode>("lastVisit");
  const sortMode = props.sortMode ?? internalSortMode;
  const setSortMode = props.onSortModeChange ?? setInternalSortMode;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const repAreaNames = meta?.routeZone?.areas ?? [];
  const unknownAreaLabel = labels.unknownArea ?? "منطقة غير معروفة";
  const expandAllLabel = labels.expandAll ?? "توسيع الكل";
  const collapseAllLabel = labels.collapseAll ?? "طي الكل";
  const storeCountLabel = labels.storeCount ?? ((n: number) => `${n} محل`);
  const pendingCountLabel = labels.pendingCount ?? ((n: number) => `${n} متبقي`);

  const storePins = useMemo(() => dailyStoresToPins(stores), [stores]);

  const mapRegion = useMemo((): MapRegion => {
    if (storePins.length) {
      const lat = storePins.reduce((s, p) => s + p.lat, 0) / storePins.length;
      const lng = storePins.reduce((s, p) => s + p.lng, 0) / storePins.length;
      return { latitude: lat, longitude: lng, latitudeDelta: 0.14, longitudeDelta: 0.14 };
    }
    return JORDAN_REGION;
  }, [storePins]);

  const filteredStores = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return stores.filter((s) => {
      if (filter === "pending" && s.visitedToday) return false;
      if (filter === "done" && !s.visitedToday) return false;
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        s.ownerName.toLowerCase().includes(needle) ||
        (s.areaName ?? "").toLowerCase().includes(needle) ||
        (s.addressText ?? "").toLowerCase().includes(needle)
      );
    });
  }, [stores, search, filter]);

  const groups = useMemo(
    () => sortGroupsPendingFirst(groupStoresByArea(filteredStores, repAreaNames, sortMode)),
    [filteredStores, repAreaNames, sortMode]
  );

  useEffect(() => {
    if (!stores.length) {
      setExpanded({});
      return;
    }
    setExpanded(
      defaultExpanded(
        sortGroupsPendingFirst(groupStoresByArea(stores, repAreaNames, sortMode))
      )
    );
  }, [stores, repAreaNames, sortMode]);

  const setAllExpanded = (open: boolean) => {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[areaKey(g.areaName)] = open;
    setExpanded(next);
  };

  const visitedCount = stores.filter((s) => s.visitedToday).length;
  const possibleCount = stores.filter((s) => s.source === "prospect").length;
  const isPossible = (s: DailyStoreCard) => s.source === "prospect";

  if (loading && !meta) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={styles.muted}>{locating ? labels.locating : labels.loadFailed}</Text>
      </View>
    );
  }

  if (!meta?.active) {
    return (
      <View style={styles.card}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="calendar-outline" size={28} color={theme.accent} />
        </View>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.emptyMsg}>{meta?.message ?? labels.noSchedule}</Text>
        {meta?.dayName ? <Text style={styles.muted}>{meta.dayName}</Text> : null}
      </View>
    );
  }

  const zoneName = meta.routeZone?.name ?? "—";
  const dayName = meta.dayName ?? "";
  const listBottomPadding = 24;
  const allVisitedLabel = labels.allVisited ?? "تمت زيارة جميع المحلات";

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: listBottomPadding }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={theme.accent} />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="navigate" size={22} color="#fff" />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{labels.title}</Text>
            <Text style={styles.heroSub}>{labels.today(dayName, zoneName)}</Text>
          </View>
        </View>

        {storePins.length > 0 ? (
          <View
            style={[styles.heroMapWrap, { height: ROUTE_MAP_HEIGHT }]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
          >
            <RouteStoresMap
              mapRegion={mapRegion}
              stores={storePins}
              height={ROUTE_MAP_HEIGHT}
              interactive
            />
          </View>
        ) : null}

        <View style={styles.heroStats}>
          <Text style={styles.heroStat}>{labels.storesCount(stores.length)}</Text>
          <Text style={styles.heroStatMuted}>
            {visitedCount} {labels.visited} · {stores.length - visitedCount} {labels.pending}
            {possibleCount > 0 ? ` · ${labels.possibleCount(possibleCount)}` : ""}
          </Text>
        </View>
        <Text style={styles.nearestHint}>{labels.nearestFirst}</Text>
        <Pressable
          style={[styles.locationBtn, (locating || loading) && styles.locationBtnBusy]}
          onPress={props.onRefreshLocation}
          disabled={locating || loading}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="locate" size={17} color="#fff" />
              <Text style={styles.locationBtnText}>{labels.refreshLocation}</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={labels.searchPlaceholder}
          placeholderTextColor={theme.muted}
          textAlign="right"
        />
        <View style={styles.toolbarRow}>
          <View style={styles.toolbarMain}>
            <View style={styles.filters}>
              {(["all", "pending", "done"] as const).map((f) => (
                <Pressable
                  key={f}
                  style={[styles.filterChip, filter === f && styles.filterChipOn]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>
                    {f === "all" ? labels.filterAll : f === "pending" ? labels.filterPending : labels.filterDone}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sortRow}>
              {(
                [
                  ["distance", labels.sortByDistance ?? "المسافة"],
                  ["lastVisit", labels.sortByLastVisit ?? "آخر زيارة"],
                ] as const
              ).map(([mode, label]) => (
                <Pressable
                  key={mode}
                  style={[styles.filterChip, sortMode === mode && styles.filterChipOn]}
                  onPress={() => setSortMode(mode)}
                >
                  <Text style={[styles.filterText, sortMode === mode && styles.filterTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
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
                {groups.every((g) => expanded[areaKey(g.areaName)]) ? collapseAllLabel : expandAllLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {filteredStores.length === 0 ? (
        <Text style={styles.emptyMsg}>{search.trim() || filter !== "all" ? labels.noSearchResults : labels.empty}</Text>
      ) : (
        <>
          {stores.length > 0 && stores.every((s) => s.visitedToday) ? (
            <View style={styles.allDoneBanner}>
              <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
              <Text style={styles.allDoneText}>{allVisitedLabel}</Text>
            </View>
          ) : null}

          {groups.map((group) => {
            const key = areaKey(group.areaName);
            const isOpen = expanded[key] ?? false;
            const visited = group.stores.filter((s) => s.visitedToday).length;
            const pending = group.stores.length - visited;
            const areaProgress = group.stores.length > 0 ? visited / group.stores.length : 0;
            const areaDisplay = parseAreaName(group.areaName, unknownAreaLabel);
            const allDone = group.stores.length > 0 && pending === 0;

            return (
              <View key={key} style={styles.areaBlock}>
                <Pressable
                  style={({ pressed }) => [
                    styles.areaHeader,
                    isOpen && styles.areaHeaderOpen,
                    allDone && styles.areaHeaderDone,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
                >
                  <View style={[styles.areaIconWrap, allDone && styles.areaIconWrapDone]}>
                    <Ionicons
                      name={allDone ? "checkmark-circle" : "location"}
                      size={20}
                      color={allDone ? "#16a34a" : theme.accent}
                    />
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
                    <View style={styles.areaProgressRow}>
                      <View style={styles.areaProgressTrack}>
                        <View
                          style={[styles.areaProgressFill, { width: `${Math.round(areaProgress * 100)}%` }]}
                        />
                      </View>
                      <Text style={styles.areaMeta}>
                        {storeCountLabel(group.stores.length)}
                        {pending > 0
                          ? ` · ${pendingCountLabel(pending)}`
                          : ` · ${labels.visited}`}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={22}
                    color={allDone ? "#16a34a" : theme.accent}
                  />
                </Pressable>

                {isOpen
                  ? group.stores.map((s, idx) => (
                      <Pressable
                        key={`${s.source ?? "burqan"}-${s.id}`}
                        style={({ pressed }) => [
                          styles.storeCard,
                          s.visitedToday && styles.storeCardDone,
                          isPossible(s) && styles.storeCardPossible,
                          idx === group.stores.length - 1 && styles.storeCardLast,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => props.onSelectStore(s)}
                      >
                        <View style={[styles.rankBadge, isPossible(s) && styles.rankBadgePossible]}>
                          <Text style={[styles.rankText, isPossible(s) && styles.rankTextPossible]}>
                            {idx + 1}
                          </Text>
                        </View>
                        <View style={styles.storeBody}>
                          <View style={styles.storeTopRow}>
                            <Text style={styles.storeName} numberOfLines={1}>
                              {s.name}
                            </Text>
                            {s.distanceLabel ? (
                              <View style={styles.distBadge}>
                                <Ionicons name="location-sharp" size={12} color={theme.accentDark} />
                                <Text style={styles.distText}>{s.distanceLabel}</Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.storeMetaRow}>
                            {isPossible(s) ? (
                              <View style={styles.possiblePill}>
                                <Text style={styles.possiblePillText}>{labels.possiblePill}</Text>
                              </View>
                            ) : null}
                            <Text style={styles.storeMeta} numberOfLines={1}>
                              {s.ownerName?.trim() || s.addressText?.trim() || "—"}
                            </Text>
                          </View>
                          <Text style={styles.storeLastVisit} numberOfLines={1}>
                            {s.lastVisitedAt
                              ? labels.lastVisit(formatMarketDate(s.lastVisitedAt))
                              : s.visitedToday
                                ? labels.lastVisit(formatMarketDate(new Date()))
                                : labels.lastVisitNever}
                          </Text>
                          {s.visitedToday ? (
                            <View style={styles.donePill}>
                              <Text style={styles.donePillText}>{labels.visited}</Text>
                            </View>
                          ) : (
                            <View style={styles.pendingPill}>
                              <Text style={styles.pendingPillText}>{labels.pending}</Text>
                            </View>
                          )}
                        </View>
                        <Ionicons name="chevron-back" size={20} color={theme.muted} />
                      </Pressable>
                    ))
                  : null}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.xl,
    padding: 20,
    marginTop: 12,
    alignItems: "center",
    ...theme.shadow.card,
  },
  headerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { color: theme.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyMsg: { color: theme.muted, fontSize: 15, textAlign: "center", marginTop: 12, lineHeight: 22 },
  muted: { color: theme.muted, fontSize: 13, marginTop: 8 },
  hero: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius.xl,
    padding: 16,
    marginBottom: 8,
    ...theme.shadow.card,
  },
  heroTop: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1 },
  heroTitle: { color: "#fff", fontSize: 17, fontWeight: "800", textAlign: "right" },
  heroSub: { color: "rgba(255,255,255,0.92)", fontSize: 14, fontWeight: "600", textAlign: "right", marginTop: 4 },
  heroMapWrap: {
    marginTop: 12,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  heroStats: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.25)",
  },
  heroStat: { color: "#fff", fontWeight: "800", fontSize: 14 },
  heroStatMuted: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  nearestHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    textAlign: "right",
    marginTop: 8,
    fontWeight: "600",
  },
  locationBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  locationBtnBusy: { opacity: 0.75 },
  locationBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  toolbar: { marginTop: 8, marginBottom: 8 },
  search: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.card,
    color: theme.text,
    fontSize: 15,
  },
  toolbarRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
    flexWrap: "wrap",
  },
  toolbarMain: { flex: 1, minWidth: 0, gap: 8 },
  filters: { flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" },
  sortRow: { flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: theme.line,
  },
  filterChipOn: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
  filterText: { color: theme.muted, fontWeight: "700", fontSize: 13 },
  filterTextOn: { color: theme.accentDark },
  expandToggle: { paddingVertical: 8, paddingHorizontal: 4 },
  expandToggleText: { color: theme.accent, fontSize: 13, fontWeight: "700" },
  allDoneBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.25)",
  },
  allDoneText: { color: "#16a34a", fontSize: 14, fontWeight: "700", flex: 1, textAlign: "right" },
  areaBlock: { marginBottom: 10 },
  areaHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.accentSoft,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.12)",
    ...theme.shadow.card,
  },
  areaHeaderOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  areaHeaderDone: {
    backgroundColor: "#f0fdf4",
    borderColor: "rgba(22, 163, 74, 0.2)",
  },
  areaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.card,
    alignItems: "center",
    justifyContent: "center",
  },
  areaIconWrapDone: { backgroundColor: "#dcfce7" },
  areaHeaderBody: { flex: 1, minWidth: 0 },
  areaName: { color: theme.text, fontSize: 16, fontWeight: "800", textAlign: "right" },
  areaSubtitle: { color: theme.muted, fontSize: 12, marginTop: 2, textAlign: "right" },
  areaProgressRow: { marginTop: 8, gap: 6 },
  areaProgressTrack: {
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.7)",
    overflow: "hidden",
  },
  areaProgressFill: {
    height: "100%",
    backgroundColor: theme.accent,
    borderRadius: theme.radius.pill,
  },
  areaMeta: { color: theme.muted, fontSize: 11, textAlign: "right", fontWeight: "600" },
  storeCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: theme.card,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.line,
    borderTopWidth: 0,
    gap: 10,
  },
  storeCardLast: {
    borderBottomLeftRadius: theme.radius.lg,
    borderBottomRightRadius: theme.radius.lg,
    marginBottom: 0,
    ...theme.shadow.card,
  },
  storeCardDone: { backgroundColor: "#f0fdf4", borderColor: "rgba(22, 163, 74, 0.35)" },
  storeCardPossible: { backgroundColor: "#fffbeb", borderColor: "rgba(245, 158, 11, 0.35)" },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: theme.accentDark, fontWeight: "800", fontSize: 14 },
  rankBadgePossible: { backgroundColor: "#fef3c7" },
  rankTextPossible: { color: "#b45309" },
  storeBody: { flex: 1, minWidth: 0 },
  storeTopRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  storeMetaRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  possiblePill: {
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  possiblePillText: { color: "#b45309", fontSize: 10, fontWeight: "800" },
  storeName: { flex: 1, color: theme.text, fontSize: 16, fontWeight: "800", textAlign: "right" },
  distBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  distText: { color: theme.accentDark, fontSize: 11, fontWeight: "800" },
  storeMeta: { color: theme.muted, fontSize: 13, textAlign: "right", flex: 1 },
  storeLastVisit: { color: theme.muted, fontSize: 12, marginTop: 4, textAlign: "right" },
  donePill: {
    alignSelf: "flex-end",
    marginTop: 8,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  donePillText: { color: "#16a34a", fontSize: 11, fontWeight: "800" },
  pendingPill: {
    alignSelf: "flex-end",
    marginTop: 8,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  pendingPillText: { color: theme.muted, fontSize: 11, fontWeight: "700" },
  pressed: { opacity: 0.88 },
});
