import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { query, pool } from "../db/pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sqlPath = join(__dirname, "../../sql/003_admin_password_reset.sql");
  await query(readFileSync(sqlPath, "utf8"));
  // eslint-disable-next-line no-console
  console.log("Applied:", sqlPath);
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
