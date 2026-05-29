export const PERMISSIONS = [
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
  "redeem.read",
  "redeem.write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
