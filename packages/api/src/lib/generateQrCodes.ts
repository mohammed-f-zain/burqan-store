import { randomBytes } from "node:crypto";

import { query } from "../db/pool.js";

const INSERT_BATCH = 100;

/** Insert `count` new unassigned qr_codes rows (1–500 per call). */
export async function insertQrCodes(count: number): Promise<number> {
  const n = Math.min(500, Math.max(1, Math.floor(count)));
  let inserted = 0;
  for (let i = 0; i < n; i += INSERT_BATCH) {
    const slice = Math.min(INSERT_BATCH, n - i);
    const tokens: string[] = [];
    for (let j = 0; j < slice; j++) tokens.push(randomBytes(24).toString("hex"));
    const values = tokens.map((_, idx) => `($${idx + 1})`).join(", ");
    await query(`INSERT INTO qr_codes (public_token) VALUES ${values}`, tokens);
    inserted += slice;
  }
  return inserted;
}

export async function countUnassignedQrCodes(): Promise<number> {
  const { rows } = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM qr_codes qc
     LEFT JOIN stores s ON s.qr_code_id = qc.id
     WHERE s.id IS NULL`
  );
  return parseInt(rows[0]?.c ?? "0", 10);
}
