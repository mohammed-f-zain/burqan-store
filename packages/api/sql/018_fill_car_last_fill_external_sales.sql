-- Snapshot of van qty at last fill (does not change when reps sell).
-- External sales: admin-only orders with no store and no van stock deduction.

ALTER TABLE representative_inventory
  ADD COLUMN IF NOT EXISTS last_fill_quantity INT NOT NULL DEFAULT 0
  CHECK (last_fill_quantity >= 0);

UPDATE representative_inventory
   SET last_fill_quantity = quantity
 WHERE last_fill_quantity = 0 AND quantity > 0;

CREATE TABLE IF NOT EXISTS external_sales (
  id BIGSERIAL PRIMARY KEY,
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE RESTRICT,
  payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('cash', 'deferred')),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  note TEXT,
  recorded_by_admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_sale_lines (
  id BIGSERIAL PRIMARY KEY,
  external_sale_id BIGINT NOT NULL REFERENCES external_sales(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL,
  line_total NUMERIC(14, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_external_sales_rep_created
  ON external_sales (representative_id, created_at DESC);
