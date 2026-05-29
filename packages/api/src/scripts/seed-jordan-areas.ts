import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { allJordanAreaSeeds } from "../data/jordanAreaSeeds.js";
import { JORDAN_GOVERNORATES } from "../data/jordanGovernorates.js";
import { GOVERNORATE_AREA_SUFFIX } from "../utils/matchAreaFromGoogle.js";
import { query, pool } from "../db/pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dirname, "../../sql");

async function ensureGovernorateColumn() {
  const migration = join(sqlDir, "004_area_governorate.sql");
  await query(readFileSync(migration, "utf8"));
}

async function main() {
  await ensureGovernorateColumn();

  const detailed = allJordanAreaSeeds();
  for (const a of detailed) {
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

  for (const g of JORDAN_GOVERNORATES) {
    const name = `${g.name}${GOVERNORATE_AREA_SUFFIX}`;
    await query(
      `INSERT INTO areas (name, center_lat, center_lng, radius_km, governorate)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET
         center_lat = EXCLUDED.center_lat,
         center_lng = EXCLUDED.center_lng,
         radius_km = EXCLUDED.radius_km,
         governorate = EXCLUDED.governorate`,
      [name, g.centerLat, g.centerLng, g.radiusKm, g.name]
    );
  }

  const { rows } = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM areas`);
  // eslint-disable-next-line no-console
  console.log(
    `Jordan areas upserted: ${detailed.length} detailed (max 1 km) + ${JORDAN_GOVERNORATES.length} governorate coverage.`,
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
