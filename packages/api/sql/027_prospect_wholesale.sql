-- Wholesale flag for possible clients (same rules as stores).

ALTER TABLE prospect_stores
  ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_prospect_stores_is_wholesale
  ON prospect_stores(is_wholesale)
  WHERE is_wholesale = true;
