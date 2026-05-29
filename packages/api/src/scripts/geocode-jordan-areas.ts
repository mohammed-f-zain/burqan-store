/**
 * Refresh area center_lat / center_lng from Google Geocoding (forward).
 * Requires GOOGLE_MAPS_API_KEY in .env
 *
 *   npm run geocode:jordan-areas -w @burqan/api
 */
import { config } from "../config.js";
import { query, pool } from "../db/pool.js";
import { forwardGeocode } from "../utils/googleGeocode.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!config.googleMapsApiKey) {
    throw new Error("Set GOOGLE_MAPS_API_KEY in packages/api/.env");
  }

  const { rows } = await query<{ id: number; name: string; governorate: string | null }>(
    `SELECT id, name, governorate FROM areas ORDER BY id`
  );

  let updated = 0;
  for (const row of rows) {
    const gov = row.governorate?.trim();
    const queryText = gov
      ? `${row.name}, ${gov}, الأردن`
      : `${row.name}, الأردن`;
    const loc = await forwardGeocode(queryText);
    await sleep(220);
    if (!loc) {
      // eslint-disable-next-line no-console
      console.warn("No result:", row.name);
      continue;
    }
    await query(`UPDATE areas SET center_lat = $1, center_lng = $2 WHERE id = $3`, [
      loc.lat,
      loc.lng,
      row.id,
    ]);
    updated++;
    // eslint-disable-next-line no-console
    console.log(`OK #${row.id} ${row.name} → ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);
  }

  // eslint-disable-next-line no-console
  console.log(`Updated ${updated} / ${rows.length} areas.`);
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
