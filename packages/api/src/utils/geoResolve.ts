import { query } from "../db/pool.js";
import { areaBboxParams, EXCLUDE_GRID_AREA_SQL, GOVERNORATE_COVERAGE_ACTIVE_SQL } from "./areaQuery.js";
import { HttpError } from "./errors.js";
import { pickFromCircles } from "./geoPick.js";
import { isGoogleGeocodeEnabled, reverseGeocode } from "./googleGeocode.js";
import { GOVERNORATE_AREA_SUFFIX, matchAreaFromGoogle } from "./matchAreaFromGoogle.js";

const NEARBY_AREA_RADIUS_KM = 36;
const GOOGLE_MATCH_MAX_CANDIDATES = 120;

export type AreaGeo = {
  id: number;
  name: string;
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
  const gpsPick = pickFromCircles(lat, lng, rows);

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
