import type { MapRegion } from "./registerMapConfig";

export type ZoneStorePin = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  visitedToday?: boolean;
};

export function regionFromStorePins(
  stores: ZoneStorePin[],
  repLat: number | null,
  repLng: number | null,
  fallback: MapRegion
): MapRegion {
  const pts: { lat: number; lng: number }[] = stores.map((s) => ({ lat: s.lat, lng: s.lng }));
  if (repLat != null && repLng != null) pts.push({ lat: repLat, lng: repLng });
  if (!pts.length) return fallback;
  const minLat = Math.min(...pts.map((p) => p.lat));
  const maxLat = Math.max(...pts.map((p) => p.lat));
  const minLng = Math.min(...pts.map((p) => p.lng));
  const maxLng = Math.max(...pts.map((p) => p.lng));
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.45, 0.05),
    longitudeDelta: Math.max((maxLng - minLng) * 1.45, 0.05),
  };
}
