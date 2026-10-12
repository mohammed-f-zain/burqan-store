-- Wholesaler reps see only wholesale stores (all of them, no route).
-- Normal reps never see wholesale stores on the app.

ALTER TABLE representatives
  ADD COLUMN IF NOT EXISTS is_wholesaler BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_stores_is_wholesale
  ON stores(is_wholesale)
  WHERE is_wholesale = true;

CREATE INDEX IF NOT EXISTS idx_representatives_is_wholesaler
  ON representatives(is_wholesaler)
  WHERE is_wholesaler = true;
