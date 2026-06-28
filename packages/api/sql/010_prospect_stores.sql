-- Possible clients (prospects) — stores without QR until linked on a later visit.

CREATE TABLE IF NOT EXISTS prospect_stores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  address_text TEXT,
  image_url TEXT,
  area_id INT NOT NULL REFERENCES areas(id),
  created_by_representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE RESTRICT,
  converted_store_id INT REFERENCES stores(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'converted', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_stores_area ON prospect_stores(area_id);
CREATE INDEX IF NOT EXISTS idx_prospect_stores_rep ON prospect_stores(created_by_representative_id);
CREATE INDEX IF NOT EXISTS idx_prospect_stores_status ON prospect_stores(status);

CREATE TABLE IF NOT EXISTS prospect_visits (
  id BIGSERIAL PRIMARY KEY,
  prospect_store_id INT NOT NULL REFERENCES prospect_stores(id) ON DELETE CASCADE,
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_prospect_visits_prospect ON prospect_visits(prospect_store_id);
