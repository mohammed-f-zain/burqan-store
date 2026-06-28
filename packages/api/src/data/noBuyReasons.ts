/** Fixed reasons when a rep ends a visit without a sale (must match mobile app). */
export const NO_BUY_REASONS = [
  "مخزون كافٍ لدى المتجر",
  "لا حاجة للشراء حالياً",
  "السعر أو الدفع غير مناسب",
] as const;

export type NoBuyReason = (typeof NO_BUY_REASONS)[number];

export function isNoBuyReasonNote(note: string | null | undefined): boolean {
  if (!note?.trim()) return false;
  return (NO_BUY_REASONS as readonly string[]).includes(note.trim());
}

/** True when the visit note is a fixed no-buy reason and there was no sale that day. */
export function isNoBuyVisit(
  note: string | null | undefined,
  hadOrderSameDay: boolean
): boolean {
  return !hadOrderSameDay && isNoBuyReasonNote(note);
}

/** SQL fragment — requires visits alias `v`. Excludes visits with an order same rep/store/day. */
export const VISIT_WITHOUT_ORDER_SAME_DAY_SQL = `NOT EXISTS (
  SELECT 1 FROM orders o
  WHERE o.representative_id = v.representative_id
    AND o.store_id = v.store_id
    AND (o.created_at AT TIME ZONE 'Asia/Amman')::date =
        (v.visited_at AT TIME ZONE 'Asia/Amman')::date
)`;

export const VISIT_HAD_ORDER_SAME_DAY_SQL = `EXISTS (
  SELECT 1 FROM orders o
  WHERE o.representative_id = v.representative_id
    AND o.store_id = v.store_id
    AND (o.created_at AT TIME ZONE 'Asia/Amman')::date =
        (v.visited_at AT TIME ZONE 'Asia/Amman')::date
)`;
