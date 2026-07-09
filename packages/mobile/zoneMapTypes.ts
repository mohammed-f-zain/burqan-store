import type { DailyStoreCard } from "./storeTypes";

export type ZoneStorePin = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  visitedToday?: boolean;
  isProspect?: boolean;
};

export function dailyStoresToPins(stores: DailyStoreCard[]): ZoneStorePin[] {
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
      isProspect: s.source === "prospect",
    }));
}
