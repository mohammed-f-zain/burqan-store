-- Optional rep assignment per route zone (empty = visible to all reps).

CREATE TABLE IF NOT EXISTS route_zone_representatives (
  route_zone_id INT NOT NULL REFERENCES route_zones(id) ON DELETE CASCADE,
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
  PRIMARY KEY (route_zone_id, representative_id)
);

CREATE INDEX IF NOT EXISTS idx_route_zone_reps_rep ON route_zone_representatives(representative_id);
