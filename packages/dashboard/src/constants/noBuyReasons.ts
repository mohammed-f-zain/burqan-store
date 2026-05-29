/** Must match mobile app + API — packages/api/src/data/noBuyReasons.ts */
export const NO_BUY_REASONS = [
  "مخزون كافٍ لدى المتجر",
  "لا حاجة للشراء حالياً",
  "السعر أو الدفع غير مناسب",
] as const;

export function isNoBuyReasonNote(note: string | null | undefined): boolean {
  if (!note?.trim()) return false;
  return (NO_BUY_REASONS as readonly string[]).includes(note.trim());
}
