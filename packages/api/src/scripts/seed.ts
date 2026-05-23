import { hashPassword } from "../utils/password.js";
import { query, pool } from "../db/pool.js";

const superEmail = process.env.SEED_SUPER_EMAIL ?? "super@burqan.store";
const superPassword = process.env.SEED_SUPER_PASSWORD ?? "ChangeMe_Super_Strong_1!";
const repEmail = process.env.SEED_REP_EMAIL ?? "rep@burqan.store";
const repPassword = process.env.SEED_REP_PASSWORD ?? "ChangeMe_Rep_Strong_1!";

async function main() {
  const phSuper = await hashPassword(superPassword);
  const phRep = await hashPassword(repPassword);

  const { JORDAN_GOVERNORATES } = await import("../data/jordanGovernorates.js");
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

  const { rows: areaRows } = await query<{ id: number }>(`SELECT id FROM areas ORDER BY id ASC`);
  const areaIds = areaRows.map((r) => r.id);
  if (!areaIds.length) throw new Error("Need at least one area");

  await query(
    `INSERT INTO admins (email, password_hash, full_name, is_super_admin, role_id, created_by_admin_id)
     VALUES ($1, $2, $3, true, NULL, NULL)
     ON CONFLICT (email) DO NOTHING`,
    [superEmail, phSuper, "Super Admin"]
  );

  await query(
    `INSERT INTO products (name, designation, unit_label, carton_spec, dimensions_cm, carton_weight_kg, image_url, price)
     SELECT $1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6, NULL::text, 12.50::numeric
     WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = $1::varchar)`,
    [
      "Dark chocolate zero added sugar",
      "Dark chocolate with almond zero added sugar",
      "50g",
      "6*6",
      "35 * 26 * 17",
      2.6,
    ]
  );

  await query(
    `INSERT INTO representatives (email, password_hash, full_name, phone, image_url, car_plate)
     VALUES ($1, $2, $3, $4, NULL, $5)
     ON CONFLICT (email) DO NOTHING`,
    [repEmail, phRep, "Demo Representative", "+962790000000", "JO 1234"]
  );

  const { rows: repRows } = await query<{ id: number }>(
    `SELECT id FROM representatives WHERE email = $1`,
    [repEmail]
  );
  const repId = repRows[0]?.id;
  if (repId) {
    for (const aid of areaIds) {
      await query(
        `INSERT INTO representative_areas (representative_id, area_id) VALUES ($1, $2)
         ON CONFLICT (representative_id, area_id) DO NOTHING`,
        [repId, aid]
      );
    }
    const { rows: prods } = await query<{ id: number }>(`SELECT id FROM products WHERE is_active = true`);
    for (const p of prods) {
      await query(
        `INSERT INTO representative_inventory (representative_id, product_id, quantity)
         VALUES ($1, $2, 50)
         ON CONFLICT (representative_id, product_id)
         DO UPDATE SET quantity = GREATEST(representative_inventory.quantity, 50)`,
        [repId, p.id]
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete. Super:", superEmail, "| Rep:", repEmail);
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
