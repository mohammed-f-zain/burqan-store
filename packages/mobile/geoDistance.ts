import type { DailyStoreCard } from "./storeTypes";

/** Great-circle distance in meters (same formula as API). */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceM(m: number): string {
  if (m < 1000) return `${Math.round(m)} م`;
  const km = m / 1000;
  return km < 10 ? `${km.toFixed(1)} كم` : `${Math.round(km)} كم`;
}

export function withDistanceFromRep(
  store: DailyStoreCard,
  repLat: number,
  repLng: number
): DailyStoreCard {
  const distanceM = haversineMeters(repLat, repLng, store.location.lat, store.location.lng);
  return {
    ...store,
    distanceM: Math.round(distanceM),
    distanceLabel: formatDistanceM(distanceM),
  };
}

export type StoreSortMode = "distance" | "lastVisit";

/** Oldest / never visited first; then nearer; then name. */
export function lastVisitSortKey(store: DailyStoreCard): number {
  if (store.lastVisitedAt) {
    const t = new Date(store.lastVisitedAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  // Visited today without a timestamp → treat as most recent.
  if (store.visitedToday) return Number.MAX_SAFE_INTEGER;
  // Never visited → top of the list.
  return 0;
}

export function compareStoresByDistance(a: DailyStoreCard, b: DailyStoreCard): number {
  const da = a.distanceM ?? Number.POSITIVE_INFINITY;
  const db = b.distanceM ?? Number.POSITIVE_INFINITY;
  if (da !== db) return da - db;
  return a.name.localeCompare(b.name, "ar");
}

export function compareStoresByLastVisit(a: DailyStoreCard, b: DailyStoreCard): number {
  const va = lastVisitSortKey(a);
  const vb = lastVisitSortKey(b);
  if (va !== vb) return va - vb;
  return compareStoresByDistance(a, b);
}

/** @deprecated Prefer compareStoresByLastVisit — kept for older imports. */
export function compareStoresByVisitThenDistance(a: DailyStoreCard, b: DailyStoreCard): number {
  return compareStoresByLastVisit(a, b);
}

export function compareStoresByMode(
  a: DailyStoreCard,
  b: DailyStoreCard,
  mode: StoreSortMode
): number {
  return mode === "distance" ? compareStoresByDistance(a, b) : compareStoresByLastVisit(a, b);
}

/** Attach distance from GPS, then sort by mode (default: last visit). */
export function sortDailyStoreCardsByDistance(
  stores: DailyStoreCard[],
  repLat: number,
  repLng: number,
  mode: StoreSortMode = "lastVisit"
): DailyStoreCard[] {
  return stores
    .map((s) => withDistanceFromRep(s, repLat, repLng))
    .sort((a, b) => compareStoresByMode(a, b, mode));
}
