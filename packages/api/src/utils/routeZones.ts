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

/** YYYY-MM-DD in Asia/Amman. */
export async function ammanDateString(): Promise<string> {
  const { rows } = await query<{ d: string }>(
    `SELECT to_char((NOW() AT TIME ZONE 'Asia/Amman')::date, 'YYYY-MM-DD') AS d`
  );
  return rows[0]?.d ?? new Date().toISOString().slice(0, 10);
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
  workDate?: string;
  source?: "override" | "weekly";
  routeZone: {
    id: number;
    name: string;
    notes: string | null;
    areaIds: number[];
    areaNames: string[];
  };
  expandedAreaIds: number[];
};

async function buildRoutePayload(
  routeZoneId: number,
  zoneName: string,
  zoneNotes: string | null,
  dayOfWeek: number,
  workDate?: string,
  source?: "override" | "weekly"
): Promise<RepRouteZoneToday> {
  const areaIds = await getRouteZoneAreaIds(routeZoneId);
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
    workDate,
    source,
    routeZone: {
      id: routeZoneId,
      name: zoneName,
      notes: zoneNotes,
      areaIds,
      areaNames,
    },
    expandedAreaIds,
  };
}

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

  return buildRoutePayload(row.route_zone_id, row.zone_name, row.zone_notes, dayOfWeek, undefined, "weekly");
}

/**
 * Resolve route for a calendar date (Asia/Amman YYYY-MM-DD):
 * 1) date override (NULL zone = explicit off)
 * 2) else weekday template
 */
export async function getRepRouteZoneForDate(
  repId: number,
  yyyyMmDd: string
): Promise<RepRouteZoneToday | null> {
  const { rows: meta } = await query<{ dow: number }>(
    `SELECT EXTRACT(DOW FROM $1::date)::int AS dow`,
    [yyyyMmDd]
  );
  const dayOfWeek = meta[0]?.dow ?? 0;

  const { rows: overrideRows } = await query<{
    route_zone_id: number | null;
    zone_name: string | null;
    zone_notes: string | null;
    is_active: boolean | null;
  }>(
    `SELECT o.route_zone_id, rz.name AS zone_name, rz.notes AS zone_notes, rz.is_active
     FROM rep_route_date_overrides o
     LEFT JOIN route_zones rz ON rz.id = o.route_zone_id
     WHERE o.representative_id = $1 AND o.work_date = $2::date`,
    [repId, yyyyMmDd]
  );

  if (overrideRows[0]) {
    const o = overrideRows[0];
    if (o.route_zone_id == null) return null; // explicit off
    if (!o.is_active || !o.zone_name) return null;
    return buildRoutePayload(
      o.route_zone_id,
      o.zone_name,
      o.zone_notes,
      dayOfWeek,
      yyyyMmDd,
      "override"
    );
  }

  const weekly = await getRepRouteZoneForDay(repId, dayOfWeek);
  if (!weekly) return null;
  return { ...weekly, workDate: yyyyMmDd, source: "weekly" };
}

export function sortStoresByDistance<
  T extends { location_lat: number; location_lng: number }
>(stores: T[], repLat: number, repLng: number): (T & { distance_m: number })[] {
  const rLat = Number(repLat);
  const rLng = Number(repLng);
  return stores
    .map((s) => {
      const sLat = Number(s.location_lat);
      const sLng = Number(s.location_lng);
      const distance_m =
        Number.isFinite(rLat) &&
        Number.isFinite(rLng) &&
        Number.isFinite(sLat) &&
        Number.isFinite(sLng)
          ? haversineMeters(rLat, rLng, sLat, sLng)
          : Number.POSITIVE_INFINITY;
      return { ...s, distance_m };
    })
    .sort((a, b) => a.distance_m - b.distance_m);
}

export async function getRepTodayWorkAreaIds(repId: number): Promise<{
  dayOfWeek: number;
  dayName: string;
  workDate: string;
  route: RepRouteZoneToday | null;
  expandedAreaIds: number[];
}> {
  const workDate = await ammanDateString();
  const { rows: meta } = await query<{ dow: number }>(
    `SELECT EXTRACT(DOW FROM $1::date)::int AS dow`,
    [workDate]
  );
  const dayOfWeek = meta[0]?.dow ?? (await ammanDayOfWeek());
  const route = await getRepRouteZoneForDate(repId, workDate);
  return {
    dayOfWeek,
    dayName: arabicWeekdayName(dayOfWeek),
    workDate,
    route,
    expandedAreaIds: route?.expandedAreaIds ?? [],
  };
}

export function formatDistanceM(m: number): string {
  if (m < 1000) return `${Math.round(m)} م`;
  const km = m / 1000;
  return km < 10 ? `${km.toFixed(1)} كم` : `${Math.round(km)} كم`;
}

/** SQL fragment: zone visible to rep when unassigned or explicitly linked. */
export function routeZoneVisibleToRepSql(zoneIdCol: string, repIdParam: string): string {
  return `(
    NOT EXISTS (SELECT 1 FROM route_zone_representatives rzr WHERE rzr.route_zone_id = ${zoneIdCol})
    OR EXISTS (
      SELECT 1 FROM route_zone_representatives rzr
      WHERE rzr.route_zone_id = ${zoneIdCol} AND rzr.representative_id = ${repIdParam}
    )
  )`;
}
