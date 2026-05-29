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
