/** Fixed reasons when ending a prospect visit without linking QR (saved as visit note). */
export const NOT_REGISTER_REASONS = [
  "المالك غير متواجد",
  "يريد التأجيل أو التفكير",
  "لا يرغب بالتسجيل حالياً",
  "المتجر مغلق أو غير جاهز",
  "مخزون كافٍ — لا حاجة للتعامل حالياً",
] as const;

export const NOT_REGISTER_REASON_OTHER = "سبب آخر — اكتب يدوياً";

export type NotRegisterReason = (typeof NOT_REGISTER_REASONS)[number];

export function isPresetNotRegisterReason(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return (NOT_REGISTER_REASONS as readonly string[]).includes(value.trim());
}

export function isValidProspectReason(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return trimmed.length >= 2 && trimmed.length <= 2000;
}
