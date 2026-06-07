import { query } from "../db/pool.js";

const GOVERNORATE_COVERAGE_SUFFIX = " — تغطية المحافظة";

/**
 * Reps are often assigned governorate coverage rows (e.g. "عمان — تغطية المحافظة")
 * while stores / Google places resolve to neighborhood-level area ids.
 * Expand coverage assignments to every neighborhood in that governorate.
 */
export async function expandRepAreaIds(repAreaIds: number[]): Promise<number[]> {
  if (!repAreaIds.length) return [];

  const { rows: repAreas } = await query<{ id: number; name: string; governorate: string | null }>(
    `SELECT id, name, governorate FROM areas WHERE id = ANY($1::int[])`,
    [repAreaIds]
  );

  const expanded = new Set(repAreaIds);
  const coverageGovernorates = new Set<string>();

  for (const a of repAreas) {
    if (a.name.includes(GOVERNORATE_COVERAGE_SUFFIX) && a.governorate) {
      coverageGovernorates.add(a.governorate);
    }
  }

  if (coverageGovernorates.size) {
    const { rows: neighborhoodIds } = await query<{ id: number }>(
      `SELECT id FROM areas
       WHERE governorate = ANY($1::text[])
         AND name NOT LIKE '%' || $2`,
      [[...coverageGovernorates], GOVERNORATE_COVERAGE_SUFFIX]
    );
    for (const row of neighborhoodIds) expanded.add(row.id);
  }

  return [...expanded];
}
