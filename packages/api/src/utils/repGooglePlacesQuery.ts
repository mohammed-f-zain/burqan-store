import { query } from "../db/pool.js";
import { AREA_DISPLAY_NAME_SQL, REP_GOOGLE_PLACES_LIMIT } from "./googlePlaceAreaSql.js";

export type GooglePlaceRow = {
  id: number;
  place_id: string;
  name: string;
  address_text: string | null;
  location_lat: number;
  location_lng: number;
  area_id: number | null;
  area_name: string;
  google_maps_url: string | null;
};

export type GooglePlaceAreaSummary = {
  areaId: number;
  areaName: string;
  count: number;
};

const BASE_WHERE = `g.matched_store_id IS NULL AND g.area_id = ANY($1::int[])`;

const SELECT_FIELDS = `g.id, g.place_id, g.name, g.address_text, g.location_lat, g.location_lng,
  g.area_id, g.google_maps_url,
  COALESCE(${AREA_DISPLAY_NAME_SQL}, 'منطقة غير محددة') AS area_name`;

export function mapGooglePlaceDto(p: GooglePlaceRow) {
  return {
    id: p.id,
    source: "google" as const,
    name: p.name,
    addressText: p.address_text,
    location: { lat: p.location_lat, lng: p.location_lng },
    areaName: p.area_name,
    areaId: p.area_id,
    googleMapsUrl: p.google_maps_url,
    googlePlaceId: p.place_id,
  };
}

export async function countGooglePlacesForRep(areaFilterIds: number[]): Promise<number> {
  const { rows } = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM google_map_places g WHERE ${BASE_WHERE}`,
    [areaFilterIds]
  );
  return rows[0]?.total ?? 0;
}

export async function fetchGooglePlacesSummary(
  areaFilterIds: number[]
): Promise<GooglePlaceAreaSummary[]> {
  const { rows } = await query<{ area_id: number; area_name: string; place_count: number }>(
    `SELECT g.area_id, COALESCE(${AREA_DISPLAY_NAME_SQL}, 'منطقة غير محددة') AS area_name,
            COUNT(*)::int AS place_count
     FROM google_map_places g
     LEFT JOIN areas a ON a.id = g.area_id
     WHERE ${BASE_WHERE}
     GROUP BY g.area_id, a.map_label, a.name
     ORDER BY area_name ASC`,
    [areaFilterIds]
  );
  return rows
    .filter((r) => r.area_id != null)
    .map((r) => ({
      areaId: r.area_id,
      areaName: r.area_name,
      count: r.place_count,
    }));
}

export async function fetchGooglePlacesForArea(
  areaFilterIds: number[],
  areaId: number
): Promise<GooglePlaceRow[]> {
  if (!areaFilterIds.includes(areaId)) return [];
  const { rows } = await query<GooglePlaceRow>(
    `SELECT ${SELECT_FIELDS}
     FROM google_map_places g
     LEFT JOIN areas a ON a.id = g.area_id
     WHERE ${BASE_WHERE} AND g.area_id = $2
     ORDER BY g.name ASC
     LIMIT 800`,
    [areaFilterIds, areaId]
  );
  return rows;
}

export async function searchGooglePlacesForRep(
  areaFilterIds: number[],
  q: string,
  limit = 200
): Promise<GooglePlaceRow[]> {
  const needle = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const { rows } = await query<GooglePlaceRow>(
    `SELECT ${SELECT_FIELDS}
     FROM google_map_places g
     LEFT JOIN areas a ON a.id = g.area_id
     WHERE ${BASE_WHERE}
       AND (g.name ILIKE $2 OR COALESCE(g.address_text, '') ILIKE $2)
     ORDER BY g.name ASC
     LIMIT $3`,
    [areaFilterIds, needle, limit]
  );
  return rows;
}

export async function fetchAllGooglePlacesForRep(
  areaFilterIds: number[]
): Promise<{ total: number; places: GooglePlaceRow[] }> {
  const [total, places] = await Promise.all([
    countGooglePlacesForRep(areaFilterIds),
    query<GooglePlaceRow>(
      `SELECT ${SELECT_FIELDS}
       FROM google_map_places g
       LEFT JOIN areas a ON a.id = g.area_id
       WHERE ${BASE_WHERE}
       ORDER BY area_name ASC, g.name ASC
       LIMIT $2`,
      [areaFilterIds, REP_GOOGLE_PLACES_LIMIT]
    ).then((r) => r.rows),
  ]);
  return { total, places };
}
