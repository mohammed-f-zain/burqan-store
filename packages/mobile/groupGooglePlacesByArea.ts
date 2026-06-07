import type { DailyStoreCard } from "./storeTypes";
import type { GooglePlaceAreaSummary } from "./GooglePlacesByArea";

export type RawGooglePlace = {
  id: number;
  name: string;
  addressText?: string | null;
  location: { lat: number; lng: number };
  areaName?: string | null;
  areaId?: number | null;
  googleMapsUrl?: string | null;
  googlePlaceId?: string | null;
};

export function groupRawGooglePlacesByArea(raw: RawGooglePlace[]): {
  summaries: GooglePlaceAreaSummary[];
  rawByAreaId: Record<number, RawGooglePlace[]>;
} {
  const groups = new Map<string, RawGooglePlace[]>();
  for (const place of raw) {
    const name = place.areaName?.trim() || "منطقة غير محددة";
    const list = groups.get(name) ?? [];
    list.push(place);
    groups.set(name, list);
  }

  const summaries: GooglePlaceAreaSummary[] = [];
  const rawByAreaId: Record<number, RawGooglePlace[]> = {};
  let areaId = 1;

  for (const [areaName, list] of [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "ar")
  )) {
    summaries.push({ areaId, areaName, count: list.length });
    rawByAreaId[areaId] = list;
    areaId += 1;
  }

  return { summaries, rawByAreaId };
}

export function groupGooglePlacesByArea(places: DailyStoreCard[]): {
  summaries: GooglePlaceAreaSummary[];
  byAreaId: Record<number, DailyStoreCard[]>;
} {
  const groups = new Map<string, DailyStoreCard[]>();
  for (const place of places) {
    const name = place.areaName?.trim() || "منطقة غير محددة";
    const list = groups.get(name) ?? [];
    list.push(place);
    groups.set(name, list);
  }

  const summaries: GooglePlaceAreaSummary[] = [];
  const byAreaId: Record<number, DailyStoreCard[]> = {};
  let areaId = 1;

  for (const [areaName, list] of [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "ar")
  )) {
    summaries.push({ areaId, areaName, count: list.length });
    byAreaId[areaId] = list;
    areaId += 1;
  }

  return { summaries, byAreaId };
}
