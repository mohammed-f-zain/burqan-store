-- When a route zone was last assigned to a weekday for a rep.
ALTER TABLE rep_route_schedule
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- One date per (rep, weekday, zone) so switching routes on the same day still keeps each zone's last assign date.
CREATE TABLE IF NOT EXISTS rep_route_assignment_history (
  representative_id INT NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  route_zone_id INT NOT NULL REFERENCES route_zones(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (representative_id, day_of_week, route_zone_id)
);

CREATE INDEX IF NOT EXISTS idx_rep_route_assignment_history_rep
  ON rep_route_assignment_history(representative_id);

INSERT INTO rep_route_assignment_history (representative_id, day_of_week, route_zone_id, assigned_at)
SELECT representative_id, day_of_week, route_zone_id, assigned_at
FROM rep_route_schedule
ON CONFLICT (representative_id, day_of_week, route_zone_id) DO NOTHING;
