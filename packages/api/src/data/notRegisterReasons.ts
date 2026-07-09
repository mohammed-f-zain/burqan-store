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
