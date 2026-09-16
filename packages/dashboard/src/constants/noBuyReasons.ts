/** Must match mobile app + API — packages/api/src/data/noBuyReasons.ts */
export const NO_BUY_REASONS = [
  "مخزون كافٍ لدى المتجر",
  "لا حاجة للشراء حالياً",
  "السعر أو الدفع غير مناسب",
] as const;

export const NO_BUY_OTHER_PREFIX = "سبب آخر:";

export function isNoBuyReasonNote(note: string | null | undefined): boolean {
  if (!note?.trim()) return false;
  const n = note.trim();
  if ((NO_BUY_REASONS as readonly string[]).includes(n)) return true;
  return n.startsWith(NO_BUY_OTHER_PREFIX) && n.length > NO_BUY_OTHER_PREFIX.length + 1;
}
