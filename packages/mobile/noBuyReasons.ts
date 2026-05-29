/** Fixed reasons when ending a visit without a sale (saved as visit note). */
export const NO_BUY_REASONS = [
  "مخزون كافٍ لدى المتجر",
  "لا حاجة للشراء حالياً",
  "السعر أو الدفع غير مناسب",
] as const;

export type NoBuyReason = (typeof NO_BUY_REASONS)[number];
