/** Fixed reasons when a rep visits a possible client without linking QR (must match API/mobile). */
export const NOT_REGISTER_REASONS = [
  "المالك غير متواجد",
  "يريد التأجيل أو التفكير",
  "لا يرغب بالتسجيل حالياً",
  "المتجر مغلق أو غير جاهز",
  "مخزون كافٍ — لا حاجة للتعامل حالياً",
] as const;
