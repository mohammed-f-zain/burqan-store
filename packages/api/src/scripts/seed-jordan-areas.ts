import { JORDAN_GOVERNORATES } from "../data/jordanGovernorates.js";
import { query, pool } from "../db/pool.js";

async function main() {
  for (const g of JORDAN_GOVERNORATES) {
    await query(
      `INSERT INTO areas (name, center_lat, center_lng, radius_km)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         center_lat = EXCLUDED.center_lat,
         center_lng = EXCLUDED.center_lng,
         radius_km = EXCLUDED.radius_km`,
      [g.name, g.centerLat, g.centerLng, g.radiusKm]
    );
  }
  const { rows } = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM areas`);
  // eslint-disable-next-line no-console
  console.log("Jordan governorates upserted. Total areas:", rows[0]?.c ?? "0");
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
