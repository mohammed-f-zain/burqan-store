-- Product exchanges / returns (additive only — no changes to existing tables).

CREATE TABLE IF NOT EXISTS product_exchanges (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE RESTRICT,
  return_total NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (return_total >= 0),
  give_total NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (give_total >= 0),
  cash_difference NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (cash_difference >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_exchanges_give_covers_return CHECK (give_total + 0.00005 >= return_total)
);

CREATE TABLE IF NOT EXISTS product_exchange_return_lines (
  id BIGSERIAL PRIMARY KEY,
  exchange_id BIGINT NOT NULL REFERENCES product_exchanges(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 4) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14, 4) NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE IF NOT EXISTS product_exchange_give_lines (
  id BIGSERIAL PRIMARY KEY,
  exchange_id BIGINT NOT NULL REFERENCES product_exchanges(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 4) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14, 4) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_exchanges_rep_created
  ON product_exchanges (representative_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_exchanges_store_created
  ON product_exchanges (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_exchange_return_lines_ex
  ON product_exchange_return_lines (exchange_id);

CREATE INDEX IF NOT EXISTS idx_product_exchange_give_lines_ex
  ON product_exchange_give_lines (exchange_id);
