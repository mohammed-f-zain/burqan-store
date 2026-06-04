/**
 * Set areas.map_label from OpenStreetMap Nominatim (Arabic, same family as map tiles).
 * ~1 request/sec — takes several minutes for full DB.
 *
 *   npm run refresh:area-map-labels -w @burqan/api
 */
import { query, pool } from "../db/pool.js";
import { GOVERNORATE_AREA_SUFFIX } from "../utils/matchAreaFromGoogle.js";
import { reverseNominatimLabel } from "../utils/nominatimGeocode.js";
import { JORDAN_MICRO_REGION_SUFFIX } from "../data/jordanUrbanMicroGrid.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { rows } = await query<{
    id: number;
    name: string;
    center_lat: number;
    center_lng: number;
  }>(
    `SELECT id, name, center_lat, center_lng FROM areas
     WHERE center_lat IS NOT NULL AND center_lng IS NOT NULL
     ORDER BY id`
  );

  let updated = 0;
  for (const row of rows) {
    if (row.name.endsWith(GOVERNORATE_AREA_SUFFIX)) {
      await query(`UPDATE areas SET map_label = $1 WHERE id = $2`, [row.name, row.id]);
      continue;
    }

    const loc = await reverseNominatimLabel(row.center_lat, row.center_lng);
    await sleep(1100);

    let mapLabel = loc?.label ?? row.name;
    if (row.name.includes(JORDAN_MICRO_REGION_SUFFIX) && loc?.label) {
      mapLabel = loc.label;
    }

    await query(`UPDATE areas SET map_label = $1 WHERE id = $2`, [mapLabel, row.id]);
    updated++;
    // eslint-disable-next-line no-console
    console.log(`#${row.id} ${row.name} → map_label: ${mapLabel}`);
  }

  // eslint-disable-next-line no-console
  console.log(`Updated map_label for ${updated} areas.`);
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
