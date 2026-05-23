-- Wipe stores, areas, orders and related rows (keeps table structure).
-- Run: psql "$DATABASE_URL" -f packages/api/sql/003_reset_commerce.sql
--
-- To DROP tables instead, use the npm script with RESET_DROP_TABLES=1.

BEGIN;

TRUNCATE TABLE
  order_lines,
  orders,
  visits,
  store_payments,
  stores,
  representative_areas,
  areas
RESTART IDENTITY CASCADE;

COMMIT;
