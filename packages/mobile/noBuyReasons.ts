/** Fixed reasons when ending a visit without a sale (saved as visit note). */
export const NO_BUY_REASONS = [
  "مخزون كافٍ لدى المتجر",
  "لا حاجة للشراء حالياً",
  "السعر أو الدفع غير مناسب",
] as const;

export type NoBuyReason = (typeof NO_BUY_REASONS)[number];

/** Must match API `NO_BUY_OTHER_PREFIX`. */
export const NO_BUY_OTHER_PREFIX = "سبب آخر:";
export const NO_BUY_OTHER_OPTION = "__other__";

export function formatNoBuyOtherReason(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return `${NO_BUY_OTHER_PREFIX} ${trimmed}`;
}

export function isNoBuyReasonNote(note: string | null | undefined): boolean {
  if (!note?.trim()) return false;
  const n = note.trim();
  if ((NO_BUY_REASONS as readonly string[]).includes(n)) return true;
  return n.startsWith(NO_BUY_OTHER_PREFIX) && n.length > NO_BUY_OTHER_PREFIX.length + 1;
}
