-- Burqan Store — PostgreSQL schema
-- Run after CREATE DATABASE

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  role_id INT REFERENCES roles(id) ON DELETE SET NULL,
  created_by_admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admins_role_super CHECK (
    (is_super_admin = true AND role_id IS NULL) OR
    (is_super_admin = false AND role_id IS NOT NULL)
  )
);

CREATE TABLE areas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE representatives (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  image_url TEXT,
  car_plate VARCHAR(40),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE representative_areas (
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
  area_id INT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  PRIMARY KEY (representative_id, area_id)
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  designation TEXT,
  unit_label VARCHAR(64),
  carton_spec VARCHAR(64),
  dimensions_cm VARCHAR(64),
  carton_weight_kg NUMERIC(10, 3),
  image_url TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pre-printed pool: each row is one physical card QR payload token
CREATE TABLE qr_codes (
  id BIGSERIAL PRIMARY KEY,
  public_token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

CREATE TRIGGER trg_stores_updated
BEFORE UPDATE ON stores
FOR EACH ROW EXECUTE PROCEDURE touch_stores_updated_at();
