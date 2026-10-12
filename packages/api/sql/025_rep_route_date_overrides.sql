-- Per-date route overrides for a rep (calendar). Weekly template in rep_route_schedule remains the fallback.
-- route_zone_id NULL = explicit off day for that date (overrides a weekly "on" day).

CREATE TABLE IF NOT EXISTS rep_route_date_overrides (
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  route_zone_id INT REFERENCES route_zones(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (representative_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_rep_route_date_overrides_date
  ON rep_route_date_overrides(work_date);

CREATE INDEX IF NOT EXISTS idx_rep_route_date_overrides_zone
  ON rep_route_date_overrides(route_zone_id)
  WHERE route_zone_id IS NOT NULL;

-- Normalize accidental leading/trailing/double spaces in rep names (breaks exact name filters).
UPDATE representatives
   SET full_name = regexp_replace(btrim(full_name), '[[:space:]]+', ' ', 'g')
 WHERE full_name <> regexp_replace(btrim(full_name), '[[:space:]]+', ' ', 'g');
