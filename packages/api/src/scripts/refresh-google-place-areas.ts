/**
 * Re-resolve area_id for all google_map_places rows (fixes NULL or stale assignments).
 */
import { query, pool } from "../db/pool.js";
import { resolveAreaIdFromAllAreas } from "../utils/geoResolve.js";

async function main() {
  const { rows } = await query<{ id: number; location_lat: number; location_lng: number }>(
    `SELECT id, location_lat, location_lng FROM google_map_places ORDER BY id ASC`
  );
  let updated = 0;
  for (const row of rows) {
    try {
      const resolved = await resolveAreaIdFromAllAreas(row.location_lat, row.location_lng);
      await query(`UPDATE google_map_places SET area_id = $1 WHERE id = $2`, [
        resolved.areaId,
        row.id,
      ]);
      updated++;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[refresh-google-place-areas] skip id=${row.id}:`, e);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Updated area_id for ${updated} / ${rows.length} google_map_places rows.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
