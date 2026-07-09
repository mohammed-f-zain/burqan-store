/** Fixed reasons when ending a prospect visit without linking QR (saved as visit note). */
export const NOT_REGISTER_REASONS = [
  "المالك غير متواجد",
  "يريد التأجيل أو التفكير",
  "لا يرغب بالتسجيل حالياً",
  "المتجر مغلق أو غير جاهز",
  "مخزون كافٍ — لا حاجة للتعامل حالياً",
] as const;

export type NotRegisterReason = (typeof NOT_REGISTER_REASONS)[number];

export const NOT_REGISTER_OTHER_LABEL = "سبب آخر (اكتب يدوياً)";

export function isPresetNotRegisterReason(note: string | null | undefined): boolean {
  if (!note?.trim()) return false;
  return (NOT_REGISTER_REASONS as readonly string[]).includes(note.trim());
}

/** Preset reasons use not-register-reason; custom text uses visit-note (no backend list validation). */
export function prospectReasonApiKind(
  reason: string
): "not-register-reason" | "visit-note" {
  return isPresetNotRegisterReason(reason) ? "not-register-reason" : "visit-note";
}
