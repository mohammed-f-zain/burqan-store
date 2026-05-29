/**
 * Applies incremental SQL migrations (002 geo, 003 auth) — safe to re-run (IF NOT EXISTS).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { query, pool } from "../db/pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dirname, "../../sql");

const FILES = [
  "002_geo_inventory.sql",
  "003_admin_password_reset.sql",
  "004_area_governorate.sql",
  "005_loyalty.sql",
  "006_prize_redeem.sql",
  "007_area_2km_governorate_coverage.sql",
] as const;

async function main() {
  for (const file of FILES) {
    const sqlPath = join(sqlDir, file);
    await query(readFileSync(sqlPath, "utf8"));
    // eslint-disable-next-line no-console
    console.log("Applied:", sqlPath);
  }
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
