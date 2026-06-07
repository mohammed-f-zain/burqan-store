/**
 * Re-resolve area_id (Voronoi) and fix Google Maps URLs for all google_map_places rows.
 */
import { query, pool } from "../db/pool.js";
import { clearVoronoiAreaCache, resolveAreaIdFromVoronoi } from "../utils/resolveAreaIdFromVoronoi.js";

function mapsUrlForPlace(name: string, placeId: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`;
}

async function main() {
  clearVoronoiAreaCache();
  const { rows } = await query<{
    id: number;
    place_id: string;
    name: string;
    location_lat: number;
    location_lng: number;
  }>(`SELECT id, place_id, name, location_lat, location_lng FROM google_map_places ORDER BY id ASC`);

  let updated = 0;
  for (const row of rows) {
    try {
      const resolved = await resolveAreaIdFromVoronoi(row.location_lat, row.location_lng);
      await query(
        `UPDATE google_map_places
         SET area_id = $1, google_maps_url = $2
         WHERE id = $3`,
        [resolved.areaId, mapsUrlForPlace(row.name, row.place_id), row.id]
      );
      updated++;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[refresh-google-place-areas] skip id=${row.id}:`, e);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Updated ${updated} / ${rows.length} google_map_places rows (area + maps URL).`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
