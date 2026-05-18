import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { query, pool } from "../db/pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sqlDir = join(__dirname, "../../sql");
  const files = readdirSync(sqlDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sqlPath = join(sqlDir, file);
    const sql = readFileSync(sqlPath, "utf8");
    await query(sql);
    // eslint-disable-next-line no-console
    console.log("Migration applied:", file);
  }
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
