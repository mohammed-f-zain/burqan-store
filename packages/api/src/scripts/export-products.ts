/**
 * Print active Burqan products for Odoo x_integration_id mapping.
 * Run on VPS: npm run export-products -w @burqan/api
 */
import { pool } from "../db/pool.js";

async function main() {
  const { rows } = await pool.query<{
    id: number;
    name: string;
    price: string;
    is_active: boolean;
  }>(
    `SELECT id, name, price::text, is_active
     FROM products
     ORDER BY id`
  );
  console.log("id\tname\tprice\tactive");
  for (const r of rows) {
    console.log(`${r.id}\t${r.name.replace(/\t/g, " ")}\t${r.price}\t${r.is_active}`);
  }
  console.error(`\n${rows.filter((r) => r.is_active).length} active / ${rows.length} total`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
