-- Prospective stores discovered via Google Places (not yet registered with Burqan QR).
CREATE TABLE IF NOT EXISTS google_map_places (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(40),
  address_text TEXT,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  area_id INT REFERENCES areas(id) ON DELETE SET NULL,
  google_maps_url TEXT,
  types JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_status VARCHAR(32),
  matched_store_id INT REFERENCES stores(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_map_places_area ON google_map_places(area_id);
CREATE INDEX IF NOT EXISTS idx_google_map_places_matched ON google_map_places(matched_store_id);
