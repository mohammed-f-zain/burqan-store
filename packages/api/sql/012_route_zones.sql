-- Custom route zones (group of map areas) + per-rep weekday schedule.

CREATE TABLE IF NOT EXISTS route_zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS route_zone_areas (
  route_zone_id INT NOT NULL REFERENCES route_zones(id) ON DELETE CASCADE,
  area_id INT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  PRIMARY KEY (route_zone_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_route_zone_areas_area ON route_zone_areas(area_id);

-- 0 = Sunday … 6 = Saturday (matches JavaScript Date.getDay() and PostgreSQL EXTRACT(DOW)).
CREATE TABLE IF NOT EXISTS rep_route_schedule (
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  route_zone_id INT NOT NULL REFERENCES route_zones(id) ON DELETE RESTRICT,
  PRIMARY KEY (representative_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_rep_route_schedule_zone ON rep_route_schedule(route_zone_id);
