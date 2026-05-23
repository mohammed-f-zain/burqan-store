-- Store owner loyalty points (per product, earned on purchase)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS loyalty_points_per_unit INT NOT NULL DEFAULT 0
    CHECK (loyalty_points_per_unit >= 0);

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS loyalty_points_balance INT NOT NULL DEFAULT 0
    CHECK (loyalty_points_balance >= 0);

ALTER TABLE order_lines
  ADD COLUMN IF NOT EXISTS loyalty_points_earned INT NOT NULL DEFAULT 0
    CHECK (loyalty_points_earned >= 0);
