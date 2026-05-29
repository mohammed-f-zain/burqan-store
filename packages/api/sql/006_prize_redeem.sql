-- Prize redemption: products cost points; stores spend balance via rep visits

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS redeem_points_per_unit INT NOT NULL DEFAULT 0
    CHECK (redeem_points_per_unit >= 0),
  ADD COLUMN IF NOT EXISTS redeem_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS prize_redemptions (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE RESTRICT,
  total_points_spent INT NOT NULL CHECK (total_points_spent > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prize_redemptions_store ON prize_redemptions(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prize_redemptions_rep ON prize_redemptions(representative_id, created_at DESC);

CREATE TABLE IF NOT EXISTS prize_redemption_lines (
  id BIGSERIAL PRIMARY KEY,
  redemption_id BIGINT NOT NULL REFERENCES prize_redemptions(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  points_per_unit INT NOT NULL CHECK (points_per_unit >= 0),
  points_spent INT NOT NULL CHECK (points_spent > 0)
);

CREATE INDEX IF NOT EXISTS idx_prize_redemption_lines_redemption ON prize_redemption_lines(redemption_id);
