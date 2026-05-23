import { countUnassignedQrCodes, insertQrCodes } from "../lib/generateQrCodes.js";
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
  const inserted = await insertQrCodes(need);
  const unassigned = await countUnassignedQrCodes();
  // eslint-disable-next-line no-console
  console.log("Inserted", inserted, "QR codes; unassigned now", unassigned);
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
