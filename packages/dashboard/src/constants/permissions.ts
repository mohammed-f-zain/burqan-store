/** Mirrors API permission keys — used for nav + role editor */
export const PERMISSION_KEYS = [
  "roles.read",
  "roles.write",
  "admins.read",
  "admins.write",
  "areas.read",
  "areas.write",
  "products.read",
  "products.write",
  "reps.read",
  "reps.write",
  "fill_car.read",
  "fill_car.write",
  "stores.read",
  "stores.write",
  "stores.deferred_toggle",
  "orders.read",
  "orders.record_payment",
  "orders.delete",
  "qr_pool.read",
  "qr_pool.write",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
