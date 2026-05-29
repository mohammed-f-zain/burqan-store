import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { allJordanAreaSeeds } from "../data/jordanAreaSeeds.js";
import { JORDAN_MAIN_AREA_NAMES } from "../data/jordanMainAreas.js";
import { JORDAN_GOVERNORATES } from "../data/jordanGovernorates.js";
import { SPLIT_AREA_TO_PARENT } from "../data/jordanSplitAreaMerges.js";
import { GOVERNORATE_AREA_SUFFIX } from "../utils/matchAreaFromGoogle.js";
import { query, pool } from "../db/pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dirname, "../../sql");

async function runSqlFile(name: string) {
  await query(readFileSync(join(sqlDir, name), "utf8"));
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

/** Reassign stores/reps from old 1 km split names to parent neighborhoods, then delete splits. */
async function mergeSplitAreasIntoParents() {
  for (const [fromName, toName] of SPLIT_AREA_TO_PARENT) {
    const { rows: parents } = await query<{ id: number }>(
      `SELECT id FROM areas WHERE name = $1 LIMIT 1`,
      [toName]
    );
    const parent = parents[0];
    if (!parent) continue;

    const { rows: children } = await query<{ id: number }>(
      `SELECT id FROM areas WHERE name = $1`,
      [fromName]
    );
    const child = children[0];
    if (!child || child.id === parent.id) continue;

    await query(`UPDATE stores SET area_id = $1 WHERE area_id = $2`, [parent.id, child.id]);
    await query(
      `INSERT INTO representative_areas (representative_id, area_id)
       SELECT ra.representative_id, $1
       FROM representative_areas ra
       WHERE ra.area_id = $2
       ON CONFLICT DO NOTHING`,
      [parent.id, child.id]
    );
    await query(`DELETE FROM representative_areas WHERE area_id = $1`, [child.id]);
    const del = await query(`DELETE FROM areas WHERE id = $1`, [child.id]);
    if (del.rowCount) {
      // eslint-disable-next-line no-console
      console.log(`Merged split area: ${fromName} → ${toName}`);
    }
  }
}

/** Remove legacy micro-areas not in the main list (only when unused). */
async function pruneNonMainAreas() {
  const names = [...JORDAN_MAIN_AREA_NAMES];
  const removed = await query(
    `DELETE FROM areas a
     WHERE a.name NOT LIKE '%' || $1
       AND a.name NOT LIKE '% — شبكة %'
       AND a.name <> ALL($2::text[])
       AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.area_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM representative_areas ra WHERE ra.area_id = a.id)`,
    [GOVERNORATE_AREA_SUFFIX, names]
  );
  if (removed.rowCount) {
    // eslint-disable-next-line no-console
    console.log(`Pruned ${removed.rowCount} unused non-main areas.`);
  }
}

async function main() {
  await runSqlFile("004_area_governorate.sql");
  await runSqlFile("007_area_2km_governorate_coverage.sql");

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
  await mergeSplitAreasIntoParents();
  await pruneNonMainAreas();

  for (const g of JORDAN_GOVERNORATES) {
    const name = `${g.name}${GOVERNORATE_AREA_SUFFIX}`;
    await query(
      `INSERT INTO areas (name, center_lat, center_lng, radius_km, governorate, governorate_full_coverage)
       VALUES ($1, $2, $3, $4, $5, true)
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
    `Jordan areas upserted: ${detailed.length} main neighborhoods + ${JORDAN_GOVERNORATES.length} governorate coverage.`,
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
