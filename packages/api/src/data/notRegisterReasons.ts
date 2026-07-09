/** Fixed reasons when a rep visits a possible client without linking QR (must match mobile app). */
export const NOT_REGISTER_REASONS = [
  "المالك غير متواجد",
  "يريد التأجيل أو التفكير",
  "لا يرغب بالتسجيل حالياً",
  "المتجر مغلق أو غير جاهز",
  "مخزون كافٍ — لا حاجة للتعامل حالياً",
] as const;

export type NotRegisterReason = (typeof NOT_REGISTER_REASONS)[number];

export function isNotRegisterReasonNote(note: string | null | undefined): boolean {
  if (!note?.trim()) return false;
  return (NOT_REGISTER_REASONS as readonly string[]).includes(note.trim());
}

/** Any non-empty reason text from preset list or custom entry. */
export function isValidProspectReasonNote(note: string | null | undefined): boolean {
  const trimmed = note?.trim();
  if (!trimmed) return false;
  return trimmed.length >= 2 && trimmed.length <= 2000;
}
