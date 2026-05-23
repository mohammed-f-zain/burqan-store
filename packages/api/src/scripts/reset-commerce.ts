/**
 * Wipe commerce data: orders, stores, areas (and dependent rows).
 *
 * Default — truncate rows (keeps table structure):
 *   RESET_COMMERCE_CONFIRM=yes npm run reset:commerce -w @burqan/api
 *
 * Drop and recreate those tables (destructive schema reset):
 *   RESET_COMMERCE_CONFIRM=yes RESET_DROP_TABLES=1 npm run reset:commerce -w @burqan/api
 *
 * After clearing areas, re-seed detailed Jordan areas:
 *   npm run seed:jordan-areas -w @burqan/api
 */
import { pool } from "../db/pool.js";

const TRUNCATE_SQL = `
TRUNCATE TABLE
  order_lines,
  orders,
  visits,
  store_payments,
  stores,
  representative_areas,
  areas
RESTART IDENTITY CASCADE;
`;

const DROP_SQL = `
DROP TABLE IF EXISTS order_lines CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS visits CASCADE;
DROP TABLE IF EXISTS store_payments CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS representative_areas CASCADE;
DROP TABLE IF EXISTS areas CASCADE;
`;

const RECREATE_SQL = `
CREATE TABLE areas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  governorate VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_km NUMERIC(8, 3) NOT NULL DEFAULT 2.5
);

CREATE INDEX idx_areas_governorate ON areas(governorate);

CREATE TABLE representative_areas (
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
  area_id INT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  PRIMARY KEY (representative_id, area_id)
);

CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  qr_code_id BIGINT NOT NULL UNIQUE REFERENCES qr_codes(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  address_text TEXT,
  image_url TEXT,
  area_id INT NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  deferred_payment_enabled BOOLEAN NOT NULL DEFAULT false,
  owner_portal_token VARCHAR(64) NOT NULL UNIQUE,
  registered_by_representative_id INT REFERENCES representatives(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stores_area ON stores(area_id);
CREATE INDEX idx_stores_owner_token ON stores(owner_portal_token);

CREATE TABLE visits (
  id BIGSERIAL PRIMARY KEY,
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
  store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

CREATE INDEX idx_visits_rep_store ON visits(representative_id, store_id);
CREATE INDEX idx_visits_store ON visits(store_id);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE RESTRICT,
  store_id INT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('cash', 'deferred')),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_lines (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL,
  line_total NUMERIC(14, 2) NOT NULL
);

CREATE INDEX idx_orders_store ON orders(store_id);
CREATE INDEX idx_orders_rep ON orders(representative_id);

CREATE TABLE store_payments (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  recorded_by_admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_store ON store_payments(store_id);

CREATE OR REPLACE FUNCTION touch_stores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stores_updated ON stores;
CREATE TRIGGER trg_stores_updated
BEFORE UPDATE ON stores
FOR EACH ROW EXECUTE PROCEDURE touch_stores_updated_at();
`;

async function main() {
  if (process.env.RESET_COMMERCE_CONFIRM !== "yes") {
    console.error(
      "Refusing to run without RESET_COMMERCE_CONFIRM=yes\n" +
        "  Truncate data:  RESET_COMMERCE_CONFIRM=yes npm run reset:commerce -w @burqan/api\n" +
        "  Drop tables:    RESET_COMMERCE_CONFIRM=yes RESET_DROP_TABLES=1 npm run reset:commerce -w @burqan/api"
    );
    process.exit(1);
  }

  const dropTables = process.env.RESET_DROP_TABLES === "1";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (dropTables) {
      await client.query(DROP_SQL);
      await client.query(RECREATE_SQL);
      console.log("Dropped and recreated: areas, stores, orders, visits, store_payments, representative_areas");
    } else {
      await client.query(TRUNCATE_SQL);
      console.log("Truncated: order_lines, orders, visits, store_payments, stores, representative_areas, areas");
    }
    await client.query("COMMIT");
    console.log("QR codes, products, reps, and admins were left unchanged.");
    console.log("Next: npm run seed:jordan-areas -w @burqan/api  (then re-assign rep areas in the dashboard)");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
