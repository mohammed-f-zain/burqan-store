import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import RouteStoresMap from "./RouteStoresMap";
import type { ZoneStorePin } from "./zoneMapTypes";
import { theme } from "./theme";
import type { DailyStoreCard } from "./storeTypes";

const { card, text, muted, line, accent, accentSoft, accentSoftCyan, radius, shadow } = theme;

export type DailyStoresLabels = {
  hint: string;
  empty: string;
  allVisited: string;
  count: (visited: number, total: number) => string;
  visited: string;
  pending: string;
  unknownArea: string;
  storeCount: (n: number) => string;
  pendingCount: (n: number) => string;
  searchPlaceholder: string;
  filterAll: string;
  filterPending: string;
  filterDone: string;
  expandAll: string;
  collapseAll: string;
  noSearchResults: string;
  visitQr: string;
  nearestFirst?: string;
  refreshLocation?: string;
};

type AreaGroup = { areaName: string; stores: DailyStoreCard[] };
type FilterMode = "all" | "pending" | "done";

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

function sortZoneStores(stores: DailyStoreCard[], nearestFirst: boolean): DailyStoreCard[] {
  return [...stores].sort((x, y) => {
    if (nearestFirst && x.distanceM != null && y.distanceM != null) {
      return x.distanceM - y.distanceM;
    }
    if (x.visitedToday !== y.visitedToday) return x.visitedToday ? 1 : -1;
    return x.name.localeCompare(y.name, "ar");
  });
}

function groupStoresByZone(
  stores: DailyStoreCard[],
  zoneName: string,
  nearestFirst: boolean
): AreaGroup[] {
  return [{ areaName: zoneName, stores: sortZoneStores(stores, nearestFirst) }];
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
    stores: [...byArea.get(areaName)!].sort((x, y) => {
      if (x.visitedToday !== y.visitedToday) return x.visitedToday ? 1 : -1;
      return x.name.localeCompare(y.name, "ar");
    }),
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

function toStorePins(stores: DailyStoreCard[]): ZoneStorePin[] {
  return stores
    .filter(
      (s) =>
        Number.isFinite(s.location.lat) &&
        Number.isFinite(s.location.lng) &&
        (Math.abs(s.location.lat) > 0.0001 || Math.abs(s.location.lng) > 0.0001)
    )
    .map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.location.lat,
      lng: s.location.lng,
      visitedToday: s.visitedToday,
    }));
}

function matchesSearch(store: DailyStoreCard, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    store.name.toLowerCase().includes(needle) ||
    store.ownerName.toLowerCase().includes(needle) ||
    (store.areaName?.toLowerCase().includes(needle) ?? false) ||
    (store.addressText?.toLowerCase().includes(needle) ?? false)
  );
}

type Props = {
  stores: DailyStoreCard[];
  repAreaNames: string[];
  loading: boolean;
  labels: DailyStoresLabels;
  title: string;
  zoneName?: string | null;
  dayName?: string | null;
  nearestFirst?: boolean;
  locating?: boolean;
  onRefreshLocation?: () => void;
  onSelectStore: (store: DailyStoreCard) => void;
};

export default function DailyStoresByArea({
  stores,
  repAreaNames,
  loading,
  labels,
  title,
  zoneName,
  dayName,
  nearestFirst = false,
  locating = false,
  onRefreshLocation,
  onSelectStore,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");

  const isZoneMode = Boolean(zoneName?.trim());
  const storePins = useMemo(() => toStorePins(stores), [stores]);
  const zoneStoreScrollMaxH = Math.min(440, Math.round(windowHeight * 0.42));

  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      if (!matchesSearch(s, search)) return false;
      if (filter === "pending") return !s.visitedToday;
      if (filter === "done") return !!s.visitedToday;
      return true;
    });
  }, [stores, search, filter]);

  const groups = useMemo(() => {
    if (zoneName?.trim()) {
      return groupStoresByZone(filteredStores, zoneName.trim(), nearestFirst);
    }
    return sortGroupsPendingFirst(groupStoresByArea(filteredStores, repAreaNames));
  }, [filteredStores, repAreaNames, zoneName, nearestFirst]);

  useEffect(() => {
    if (!stores.length) {
      setExpanded({});
      return;
    }
    const baseGroups = zoneName?.trim()
      ? groupStoresByZone(stores, zoneName.trim(), nearestFirst)
      : sortGroupsPendingFirst(groupStoresByArea(stores, repAreaNames));
    setExpanded(defaultExpanded(baseGroups));
  }, [stores, repAreaNames, zoneName, nearestFirst]);

  const areaKey = (name: string) => name || "__unknown__";

  const totalVisited = stores.filter((s) => s.visitedToday).length;
  const totalPending = stores.length - totalVisited;
  const progress = stores.length > 0 ? totalVisited / stores.length : 0;

  const setAllExpanded = (open: boolean) => {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[areaKey(g.areaName)] = open;
    setExpanded(next);
  };

  const searchAndFilters = !loading && stores.length > 0 ? (
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

      <View style={styles.toolbar}>
        <View style={styles.filterRow}>
          {(
            [
              ["all", labels.filterAll],
              ["pending", labels.filterPending],
              ["done", labels.filterDone],
            ] as const
          ).map(([mode, label]) => (
            <Pressable
              key={mode}
              style={[styles.filterChip, filter === mode && styles.filterChipActive]}
              onPress={() => setFilter(mode)}
            >
              <Text style={[styles.filterChipText, filter === mode && styles.filterChipTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {!isZoneMode && groups.length > 1 ? (
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
      </View>
    </>
  ) : null;

  if (isZoneMode && !loading && stores.length > 0) {
    const zoneDisplay = parseAreaName(zoneName!.trim(), labels.unknownArea);
    const allDone = stores.length > 0 && stores.every((s) => s.visitedToday);

    return (
      <View style={styles.section}>
        <View style={styles.zoneStickyHeader}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{labels.count(totalVisited, stores.length)}</Text>
            </View>
          </View>

          <View style={styles.zoneHeaderTitleRow}>
            <View style={styles.areaIconWrap}>
              <Ionicons name="navigate" size={20} color={accent} />
            </View>
            <View style={styles.areaHeaderBody}>
              <Text style={styles.areaName} numberOfLines={2}>
                {zoneDisplay.title}
              </Text>
              {dayName ? (
                <Text style={styles.areaSubtitle} numberOfLines={1}>
                  {dayName}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressTitle}>{labels.count(totalVisited, stores.length)}</Text>
              {totalPending > 0 ? (
                <Text style={styles.progressPending}>{labels.pendingCount(totalPending)}</Text>
              ) : null}
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>

          {storePins.length > 0 ? <RouteStoresMap stores={storePins} height={180} interactive /> : null}

          {nearestFirst && labels.nearestFirst ? (
            <View style={styles.nearestRow}>
              <Text style={styles.nearestHint}>{labels.nearestFirst}</Text>
              {onRefreshLocation && labels.refreshLocation ? (
                <Pressable
                  style={[styles.locationBtn, locating && styles.locationBtnBusy]}
                  onPress={onRefreshLocation}
                  disabled={locating || loading}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color={accent} />
                  ) : (
                    <>
                      <Ionicons name="locate" size={16} color={accent} />
                      <Text style={styles.locationBtnText}>{labels.refreshLocation}</Text>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {searchAndFilters}
        </View>

        {allDone ? (
          <View style={styles.allDoneBanner}>
            <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
            <Text style={styles.allDone}>{labels.allVisited}</Text>
          </View>
        ) : null}

        {filteredStores.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="search-outline" size={40} color={muted} />
            <Text style={styles.empty}>{labels.noSearchResults}</Text>
          </View>
        ) : (
          <ScrollView
            style={[styles.zoneStoreScroll, { maxHeight: zoneStoreScrollMaxH }]}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {sortZoneStores(filteredStores, nearestFirst).map((s, idx) => (
              <StoreRow
                key={s.id}
                store={s}
                isLast={idx === filteredStores.length - 1}
                rank={nearestFirst ? idx + 1 : undefined}
                visitedLabel={labels.visited}
                visitQrLabel={labels.visitQr}
                onPress={() => onSelectStore(s)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {!loading && stores.length > 0 ? (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{labels.count(totalVisited, stores.length)}</Text>
          </View>
        ) : null}
      </View>

      {!loading && stores.length > 0 ? (
        <View style={styles.progressBlock}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressTitle}>{labels.count(totalVisited, stores.length)}</Text>
            {totalPending > 0 ? (
              <Text style={styles.progressPending}>{labels.pendingCount(totalPending)}</Text>
            ) : null}
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>{labels.hint}</Text>
      )}

      {!loading && stores.length > 0 && nearestFirst && labels.nearestFirst ? (
        <View style={styles.nearestRow}>
          <Text style={styles.nearestHint}>{labels.nearestFirst}</Text>
          {onRefreshLocation && labels.refreshLocation ? (
            <Pressable
              style={[styles.locationBtn, locating && styles.locationBtnBusy]}
              onPress={onRefreshLocation}
              disabled={locating || loading}
            >
              {locating ? (
                <ActivityIndicator size="small" color={accent} />
              ) : (
                <>
                  <Ionicons name="locate" size={16} color={accent} />
                  <Text style={styles.locationBtnText}>{labels.refreshLocation}</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : onRefreshLocation && labels.refreshLocation ? (
        <Pressable
          style={[styles.locationBtnStandalone, locating && styles.locationBtnBusy]}
          onPress={onRefreshLocation}
          disabled={locating || loading}
        >
          {locating ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <>
              <Ionicons name="locate" size={16} color={accent} />
              <Text style={styles.locationBtnText}>{labels.refreshLocation}</Text>
            </>
          )}
        </Pressable>
      ) : null}

      {!loading && stores.length > 0 ? (
        searchAndFilters
      ) : null}

      {loading ? (
        <ActivityIndicator color={accent} style={{ marginTop: 20 }} />
      ) : stores.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="storefront-outline" size={40} color={muted} />
          <Text style={styles.empty}>{labels.empty}</Text>
        </View>
      ) : filteredStores.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="search-outline" size={40} color={muted} />
          <Text style={styles.empty}>{labels.noSearchResults}</Text>
        </View>
      ) : (
        <>
          {stores.length > 0 && stores.every((s) => s.visitedToday) ? (
            <View style={styles.allDoneBanner}>
              <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
              <Text style={styles.allDone}>{labels.allVisited}</Text>
            </View>
          ) : null}

          {groups.map((group) => {
            const key = areaKey(group.areaName);
            const isOpen = expanded[key] ?? false;
            const visited = group.stores.filter((s) => s.visitedToday).length;
            const pending = group.stores.length - visited;
            const areaProgress = group.stores.length > 0 ? visited / group.stores.length : 0;
            const isZoneGroup = Boolean(zoneName?.trim() && group.areaName === zoneName.trim());
            const areaDisplay = isZoneGroup
              ? { title: group.areaName, subtitle: dayName ?? undefined }
              : parseAreaName(group.areaName, labels.unknownArea);
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
                      name={allDone ? "checkmark-circle" : isZoneGroup ? "navigate" : "location"}
                      size={20}
                      color={allDone ? "#16a34a" : accent}
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
                        <View style={[styles.areaProgressFill, { width: `${Math.round(areaProgress * 100)}%` }]} />
                      </View>
                      <Text style={styles.areaMeta}>
                        {labels.storeCount(group.stores.length)}
                        {pending > 0 ? ` · ${labels.pendingCount(pending)}` : ` · ${labels.visited}`}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={22}
                    color={allDone ? "#16a34a" : accent}
                  />
                </Pressable>

                {isOpen
                  ? group.stores.map((s, idx) => (
                      <StoreRow
                        key={s.id}
                        store={s}
                        isLast={idx === group.stores.length - 1}
                        rank={nearestFirst && isZoneGroup ? idx + 1 : undefined}
                        visitedLabel={labels.visited}
                        visitQrLabel={labels.visitQr}
                        onPress={() => onSelectStore(s)}
                      />
                    ))
                  : null}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

function StoreRow({
  store,
  isLast,
  rank,
  visitedLabel,
  visitQrLabel,
  onPress,
}: {
  store: DailyStoreCard;
  isLast: boolean;
  rank?: number;
  visitedLabel: string;
  visitQrLabel: string;
  onPress: () => void;
}) {
  const done = !!store.visitedToday;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.storeCard,
        done && styles.storeCardVisited,
        isLast && styles.storeCardLast,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      {rank != null ? (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
      ) : (
        <View
          style={[
            styles.storeStatusDot,
            done ? styles.storeStatusDone : styles.storeStatusPending,
          ]}
        />
      )}
      <View style={styles.storeBody}>
        <View style={styles.storeTopRow}>
          <Text style={styles.storeName} numberOfLines={1}>
            {store.name}
          </Text>
          {store.distanceLabel ? (
            <View style={styles.distBadge}>
              <Ionicons name="location-sharp" size={11} color={accent} />
              <Text style={styles.distText}>{store.distanceLabel}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.storeMeta} numberOfLines={1}>
          {store.ownerName}
        </Text>
        {done && store.visitNote ? (
          <Text style={styles.storeNote} numberOfLines={2}>
            {store.visitNote}
          </Text>
        ) : null}
      </View>
      {done ? (
        <View style={styles.visitedPill}>
          <Ionicons name="checkmark" size={14} color="#16a34a" />
          <Text style={styles.visitedPillText}>{visitedLabel}</Text>
        </View>
      ) : (
        <View style={styles.visitPill}>
          <Text style={styles.visitPillText}>{visitQrLabel}</Text>
          <Ionicons name="chevron-back" size={16} color={accent} />
        </View>
      )}
    </Pressable>
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
    backgroundColor: accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  headerBadgeText: { color: accent, fontSize: 12, fontWeight: "800" },
  hint: { color: muted, fontSize: 13, marginTop: 8, textAlign: "right", lineHeight: 20 },
  nearestHint: {
    color: accent,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
  },
  nearestRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  locationBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.25)",
  },
  locationBtnStandalone: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-end",
    marginTop: 10,
    backgroundColor: accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.25)",
  },
  locationBtnBusy: { opacity: 0.7 },
  locationBtnText: { color: accent, fontSize: 12, fontWeight: "800" },
  progressBlock: { marginTop: 14 },
  progressLabels: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressTitle: { color: text, fontSize: 14, fontWeight: "700" },
  progressPending: { color: "#b45309", fontSize: 13, fontWeight: "700" },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#16a34a",
    borderRadius: radius.pill,
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
  toolbar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
    flexWrap: "wrap",
  },
  filterRow: { flexDirection: "row-reverse", gap: 8, flex: 1, flexWrap: "wrap" },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: line,
  },
  filterChipActive: {
    backgroundColor: accentSoft,
    borderColor: "rgba(37, 99, 235, 0.35)",
  },
  filterChipText: { color: muted, fontSize: 13, fontWeight: "700" },
  filterChipTextActive: { color: accent },
  expandToggle: { paddingVertical: 6, paddingHorizontal: 4 },
  expandToggleText: { color: accent, fontSize: 13, fontWeight: "700" },
  emptyBox: { alignItems: "center", marginTop: 28, marginBottom: 8, gap: 10 },
  empty: { color: muted, fontSize: 15, fontWeight: "600", textAlign: "center" },
  allDoneBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: radius.md,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.25)",
  },
  allDone: { color: "#16a34a", fontSize: 14, fontWeight: "700", flex: 1, textAlign: "right" },
  areaBlock: { marginTop: 12 },
  areaHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: accentSoft,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.12)",
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
    backgroundColor: card,
    alignItems: "center",
    justifyContent: "center",
  },
  areaIconWrapDone: { backgroundColor: "#dcfce7" },
  areaHeaderBody: { flex: 1, minWidth: 0 },
  areaName: { color: text, fontSize: 16, fontWeight: "800", textAlign: "right" },
  areaSubtitle: { color: muted, fontSize: 12, marginTop: 2, textAlign: "right" },
  areaProgressRow: { marginTop: 8, gap: 6 },
  areaProgressTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.7)",
    overflow: "hidden",
  },
  areaProgressFill: {
    height: "100%",
    backgroundColor: accent,
    borderRadius: radius.pill,
  },
  areaMeta: { color: muted, fontSize: 11, textAlign: "right", fontWeight: "600" },
  storeCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: line,
    borderTopWidth: 0,
  },
  storeCardLast: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  storeCardVisited: {
    backgroundColor: "#fafafa",
    borderColor: "rgba(22, 163, 74, 0.2)",
  },
  storeStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  storeStatusPending: { backgroundColor: "#f59e0b" },
  storeStatusDone: { backgroundColor: "#16a34a" },
  storeBody: { flex: 1, minWidth: 0 },
  storeTopRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  storeName: { color: text, fontSize: 15, fontWeight: "800", textAlign: "right", flex: 1 },
  distBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    backgroundColor: accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  distText: { color: accent, fontSize: 11, fontWeight: "800" },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: accent, fontSize: 12, fontWeight: "800" },
  storeMeta: { color: muted, fontSize: 13, marginTop: 3, textAlign: "right" },
  storeNote: { color: muted, fontSize: 12, marginTop: 6, textAlign: "right", fontStyle: "italic" },
  visitedPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  visitedPillText: { color: "#16a34a", fontSize: 11, fontWeight: "800" },
  visitPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 2,
    backgroundColor: accentSoftCyan,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  visitPillText: { color: accent, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.88 },
  zoneStickyHeader: {
    backgroundColor: accentSoft,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.12)",
  },
  zoneHeaderTitleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  zoneStoreScroll: {
    marginTop: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line,
    backgroundColor: "#f8fafc",
  },
});
