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

/** Legacy DB names → real neighborhood names (safe rename when target name is free). */
const LEGACY_AREA_RENAMES: [string, string][] = [
  ["الزرقاء — وسط المدينة", "وسط الزرقاء"],
  ["إربد — وسط المدينة", "وسط إربد"],
  ["إربد — الحي الشرقي", "حي الشرقي"],
  ["إربد — الحي الغربي", "حي الغربي"],
  ["مادبا — وسط المدينة", "وسط مادبا"],
  ["المفرق — وسط المدينة", "وسط المفرق"],
  ["العقبة — وسط المدينة", "وسط العقبة"],
  ["الكرك — وسط المدينة", "وسط الكرك"],
  ["معان — وسط المدينة", "وسط معان"],
  ["الطفيلة — وسط المدينة", "وسط الطفيلة"],
  ["جرش — وسط المدينة", "وسط جرش"],
  ["عجلون — وسط المدينة", "وسط عجلون"],
  ["وادي موسى / البتراء", "وادي موسى"],
];

async function renameLegacyAreas() {
  for (const [oldName, newName] of LEGACY_AREA_RENAMES) {
    const updated = await query(
      `UPDATE areas SET name = $1
       WHERE name = $2
         AND NOT EXISTS (SELECT 1 FROM areas WHERE name = $1)`,
      [newName, oldName]
    );
    if (updated.rowCount) {
      // eslint-disable-next-line no-console
      console.log(`Renamed area: ${oldName} → ${newName}`);
    }
    const removed = await query(
      `DELETE FROM areas a
       WHERE a.name = $1
         AND EXISTS (SELECT 1 FROM areas WHERE name = $2)
         AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.area_id = a.id)
         AND NOT EXISTS (SELECT 1 FROM representative_areas ra WHERE ra.area_id = a.id)`,
      [oldName, newName]
    );
    if (removed.rowCount) {
      // eslint-disable-next-line no-console
      console.log(`Removed duplicate legacy area: ${oldName}`);
    }
  }
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

  const removedGrid = await query(
    `DELETE FROM areas a
     WHERE a.name LIKE '% — شبكة %'
       AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.area_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM representative_areas ra WHERE ra.area_id = a.id)`
  );
  if (removedGrid.rowCount) {
    // eslint-disable-next-line no-console
    console.log(`Removed ${removedGrid.rowCount} unused grid areas (شبكة).`);
  }

  await renameLegacyAreas();

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
    `Jordan areas upserted: ${detailed.length} neighborhoods (max 1 km) + ${JORDAN_GOVERNORATES.length} governorate coverage.`,
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
