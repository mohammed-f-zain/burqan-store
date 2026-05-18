-- Area geofencing + representative van inventory

ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS radius_km NUMERIC(8, 3) NOT NULL DEFAULT 25;

CREATE TABLE IF NOT EXISTS representative_inventory (
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (representative_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_rep_inventory_rep ON representative_inventory(representative_id);
