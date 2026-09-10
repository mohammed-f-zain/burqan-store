-- Link external sales to registered stores (keep store_name for display/history).

ALTER TABLE external_sales
  ADD COLUMN IF NOT EXISTS store_id INT REFERENCES stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_external_sales_store_id
  ON external_sales (store_id);
