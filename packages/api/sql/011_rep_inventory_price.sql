-- Optional per-rep product price override (NULL = use catalog products.price).

ALTER TABLE representative_inventory
  ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2) NULL
  CHECK (price IS NULL OR price >= 0);
