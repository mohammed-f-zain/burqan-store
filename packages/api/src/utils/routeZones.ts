import { query } from "../db/pool.js";
import { expandRepAreaIds } from "./expandRepAreaIds.js";
import { haversineMeters } from "./geoDistance.js";

/** Weekday index in Asia/Amman: 0 = Sunday … 6 = Saturday. */
export async function ammanDayOfWeek(): Promise<number> {
  const { rows } = await query<{ dow: number }>(
    `SELECT EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Asia/Amman'))::int AS dow`
  );
  return rows[0]?.dow ?? new Date().getDay();
}

export const ARABIC_WEEKDAY_NAMES = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

export function arabicWeekdayName(dayOfWeek: number): string {
  return ARABIC_WEEKDAY_NAMES[dayOfWeek] ?? String(dayOfWeek);
}

export async function getRouteZoneAreaIds(routeZoneId: number): Promise<number[]> {
  const { rows } = await query<{ area_id: number }>(
    `SELECT area_id FROM route_zone_areas WHERE route_zone_id = $1`,
    [routeZoneId]
  );
  return rows.map((r) => r.area_id);
}

export async function expandRouteZoneAreaIds(routeZoneId: number): Promise<number[]> {
  const ids = await getRouteZoneAreaIds(routeZoneId);
  if (!ids.length) return [];
  return expandRepAreaIds(ids);
}

export type RepRouteZoneToday = {
  dayOfWeek: number;
  dayName: string;
  routeZone: {
    id: number;
    name: string;
    notes: string | null;
    areaIds: number[];
    areaNames: string[];
  };
  expandedAreaIds: number[];
};

export async function getRepRouteZoneForDay(
  repId: number,
  dayOfWeek: number
): Promise<RepRouteZoneToday | null> {
  const { rows } = await query<{
    route_zone_id: number;
    zone_name: string;
    zone_notes: string | null;
    is_active: boolean;
  }>(
    `SELECT rs.route_zone_id, rz.name AS zone_name, rz.notes AS zone_notes, rz.is_active
     FROM rep_route_schedule rs
     JOIN route_zones rz ON rz.id = rs.route_zone_id
     WHERE rs.representative_id = $1 AND rs.day_of_week = $2`,
    [repId, dayOfWeek]
  );
  const row = rows[0];
  if (!row || !row.is_active) return null;

  const areaIds = await getRouteZoneAreaIds(row.route_zone_id);
  const expandedAreaIds = areaIds.length ? await expandRepAreaIds(areaIds) : [];

  let areaNames: string[] = [];
  if (areaIds.length) {
    const { rows: areaRows } = await query<{ name: string }>(
      `SELECT name FROM areas WHERE id = ANY($1::int[]) ORDER BY name ASC`,
      [areaIds]
    );
    areaNames = areaRows.map((a) => a.name);
  }

  return {
    dayOfWeek,
    dayName: arabicWeekdayName(dayOfWeek),
    routeZone: {
      id: row.route_zone_id,
      name: row.zone_name,
      notes: row.zone_notes,
      areaIds,
      areaNames,
    },
    expandedAreaIds,
  };
}

export function sortStoresByDistance<
  T extends { location_lat: number; location_lng: number }
>(stores: T[], repLat: number, repLng: number): (T & { distance_m: number })[] {
  return stores
    .map((s) => ({
      ...s,
      distance_m: haversineMeters(repLat, repLng, s.location_lat, s.location_lng),
    }))
    .sort((a, b) => a.distance_m - b.distance_m);
}

export async function getRepTodayWorkAreaIds(repId: number): Promise<{
  dayOfWeek: number;
  dayName: string;
  route: RepRouteZoneToday | null;
  expandedAreaIds: number[];
}> {
  const dayOfWeek = await ammanDayOfWeek();
  const route = await getRepRouteZoneForDay(repId, dayOfWeek);
  return {
    dayOfWeek,
    dayName: arabicWeekdayName(dayOfWeek),
    route,
    expandedAreaIds: route?.expandedAreaIds ?? [],
  };
}

export function formatDistanceM(m: number): string {
  if (m < 1000) return `${Math.round(m)} م`;
  const km = m / 1000;
  return km < 10 ? `${km.toFixed(1)} كم` : `${Math.round(km)} كم`;
}
