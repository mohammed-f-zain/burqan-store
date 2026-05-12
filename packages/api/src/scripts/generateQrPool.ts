import { randomBytes } from "node:crypto";

import { query, pool } from "../db/pool.js";

async function main() {
  const raw = parseInt(process.env.QR_POOL_TARGET ?? "6000", 10);
  const target = Math.min(6000, Math.max(1, Number.isFinite(raw) ? raw : 6000));
  const { rows } = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM qr_codes`);
  const have = parseInt(rows[0]?.c ?? "0", 10);
  const need = Math.max(0, target - have);
  if (need === 0) {
    // eslint-disable-next-line no-console
    console.log("QR pool already has", have, "codes");
    await pool.end();
    return;
  }
  const batch = 500;
  for (let i = 0; i < need; i += batch) {
    const slice = Math.min(batch, need - i);
    const tokens: string[] = [];
    for (let j = 0; j < slice; j++) tokens.push(randomBytes(24).toString("hex"));
    const values = tokens.map((_, idx) => `($${idx + 1})`).join(", ");
    await query(`INSERT INTO qr_codes (public_token) VALUES ${values}`, tokens);
  }
  // eslint-disable-next-line no-console
  console.log("Inserted", need, "QR codes; total now ~", have + need);
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
