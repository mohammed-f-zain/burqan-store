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

export function sortDailyStoreCardsByDistance(
  stores: DailyStoreCard[],
  repLat: number,
  repLng: number
): DailyStoreCard[] {
  return stores
    .map((s) => withDistanceFromRep(s, repLat, repLng))
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
}
