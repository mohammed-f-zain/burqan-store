import { query } from "../db/pool.js";
import { areaBboxParams, EXCLUDE_GRID_AREA_SQL, GOVERNORATE_COVERAGE_ACTIVE_SQL } from "./areaQuery.js";
import { HttpError } from "./errors.js";
import { pickAreaFromGps } from "./geoPick.js";
import { isGoogleGeocodeEnabled, reverseGeocode } from "./googleGeocode.js";
import { pickFromVoronoi } from "./jordanVoronoi.js";
import { loadVoronoiAreaRows } from "./loadVoronoiAreaRows.js";
import { GOVERNORATE_AREA_SUFFIX, matchAreaFromGoogle } from "./matchAreaFromGoogle.js";

const NEARBY_AREA_RADIUS_KM = 36;
const GOOGLE_MATCH_MAX_CANDIDATES = 120;

export type AreaGeo = {
  id: number;
  name: string;
  map_label?: string | null;
  governorate: string | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: string | number;
};

export type ResolvedArea = {
  areaId: number;
  areaName: string;
  governorate: string | null;
  /** How the area was chosen (for debugging / future UI). */
  source?: "google" | "gps";
};

async function resolveWithGoogleThenCircles(
  lat: number,
  lng: number,
  rows: AreaGeo[]
): Promise<ResolvedArea> {
  const gpsPick = pickAreaFromGps(lat, lng, rows);

  // GPS inside a main neighborhood wins — avoids Google mis-labeling (e.g. Hashimi vs Tabarbour).
  if (gpsPick.insideMainNeighborhood) {
    return { ...gpsPick, source: "gps" };
  }

  if (rows.length <= GOOGLE_MATCH_MAX_CANDIDATES && isGoogleGeocodeEnabled()) {
    try {
      const geocode = await reverseGeocode(lat, lng);
      if (geocode) {
        const matched = matchAreaFromGoogle(geocode, rows, lat, lng);
        if (matched) return { ...matched, source: "google" };
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[geo] Google geocode failed, using GPS circles:", e);
    }
  }

  return { ...gpsPick, source: "gps" };
}

/** Pick best area among rep assignments for a GPS point. */
export async function resolveAreaIdForRep(
  lat: number,
  lng: number,
  repAreaIds: number[]
): Promise<ResolvedArea> {
  if (!repAreaIds.length) throw new HttpError(403, "لا مناطق مخصصة لك");

  const { rows } = await query<AreaGeo>(
    `SELECT id, name, governorate, center_lat, center_lng, radius_km FROM areas WHERE id = ANY($1::int[])`,
    [repAreaIds]
  );
  if (!rows.length) throw new HttpError(403, "لا مناطق مخصصة لك");

  return resolveWithGoogleThenCircles(lat, lng, rows);
}

async function loadAreasNearPoint(lat: number, lng: number, radiusKm: number): Promise<AreaGeo[]> {
  const box = areaBboxParams(lat, lng, radiusKm);
  const { rows } = await query<AreaGeo>(
    `SELECT id, name, governorate, center_lat, center_lng, radius_km
     FROM areas
     WHERE center_lat IS NOT NULL AND center_lng IS NOT NULL
       AND ${EXCLUDE_GRID_AREA_SQL}
       AND ${GOVERNORATE_COVERAGE_ACTIVE_SQL}
       AND center_lat BETWEEN $1 AND $2
       AND center_lng BETWEEN $3 AND $4
     ORDER BY id ASC`,
    [box.minLat, box.maxLat, box.minLng, box.maxLng]
  );
  return rows;
}

/** Pick area from all Jordan areas in DB (store registration). */
export async function resolveAreaIdFromAllAreas(lat: number, lng: number): Promise<ResolvedArea> {
  let rows = await loadAreasNearPoint(lat, lng, NEARBY_AREA_RADIUS_KM);
  if (!rows.length) {
    rows = await loadAreasNearPoint(lat, lng, 90);
  }
  if (!rows.length) {
    const { rows: fallback } = await query<AreaGeo>(
      `SELECT id, name, governorate, center_lat, center_lng, radius_km
       FROM areas
       WHERE center_lat IS NOT NULL AND center_lng IS NOT NULL
         AND ${EXCLUDE_GRID_AREA_SQL}
         AND ${GOVERNORATE_COVERAGE_ACTIVE_SQL}
         AND name LIKE '%' || $1
       ORDER BY id ASC`,
      [GOVERNORATE_AREA_SUFFIX]
    );
    rows = fallback;
  }
  if (!rows.length) {
    throw new HttpError(500, "لم تُعرَّف المناطق على الخادم — شغّل seed:jordan-areas");
  }

  return resolveWithGoogleThenCircles(lat, lng, rows);
}

/**
 * Whether GPS falls in today's route zone using the same full-Jordan Voronoi
 * as the blue zone map. Nearby-subset / Google resolution can disagree with
 * those cells (common in sparse governorates like عجلون).
 */
export async function gpsInExpandedRouteZone(
  lat: number,
  lng: number,
  expandedAreaIds: number[]
): Promise<boolean> {
  if (!expandedAreaIds.length) return false;
  const rows = await loadVoronoiAreaRows();
  const pick = pickFromVoronoi(lat, lng, rows);
  return Boolean(pick && expandedAreaIds.includes(pick.areaId));
}

/** Prefer today's route zone; fall back to all Jordan when no schedule. */
export async function resolveAreaForRepRoute(
  lat: number,
  lng: number,
  expandedAreaIds: number[]
): Promise<ResolvedArea & { assignedToRep: boolean }> {
  const resolved = await resolveAreaIdFromAllAreas(lat, lng);

  if (!expandedAreaIds.length) {
    return { ...resolved, assignedToRep: false };
  }

  const assignedToRep =
    expandedAreaIds.includes(resolved.areaId) ||
    (await gpsInExpandedRouteZone(lat, lng, expandedAreaIds));

  return { ...resolved, assignedToRep };
}
