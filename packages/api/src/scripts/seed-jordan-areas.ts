import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { JORDAN_DETAILED_AREAS } from "../data/jordanDetailedAreas.js";
import { JORDAN_GOVERNORATES } from "../data/jordanGovernorates.js";
import { query, pool } from "../db/pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dirname, "../../sql");

async function ensureGovernorateColumn() {
  const migration = join(sqlDir, "004_area_governorate.sql");
  await query(readFileSync(migration, "utf8"));
}

async function main() {
  await ensureGovernorateColumn();

  for (const a of JORDAN_DETAILED_AREAS) {
    await query(
      `INSERT INTO areas (name, center_lat, center_lng, radius_km, governorate)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET
         center_lat = EXCLUDED.center_lat,
         center_lng = EXCLUDED.center_lng,
         radius_km = EXCLUDED.radius_km,
         governorate = EXCLUDED.governorate`,
      [a.name, a.centerLat, a.centerLng, a.radiusKm, a.governorate]
    );
  }

  const legacyNames = JORDAN_GOVERNORATES.map((g) => g.name);
  const removed = await query<{ id: number }>(
    `DELETE FROM areas a
     WHERE a.name = ANY($1::text[])
       AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.area_id = a.id)
     RETURNING a.id`,
    [legacyNames]
  );

  const { rows } = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM areas`);
  // eslint-disable-next-line no-console
  console.log(
    `Jordan detailed areas upserted: ${JORDAN_DETAILED_AREAS.length}.`,
    `Removed ${removed.rows.length} old governorate-only row(s).`,
    `Total areas in DB:`,
    rows[0]?.c ?? "0"
  );
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
