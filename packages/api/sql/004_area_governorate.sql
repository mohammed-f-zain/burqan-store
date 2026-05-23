-- Optional governorate label for grouping detailed areas (e.g. الدوار السابع → عمان)

ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS governorate VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_areas_governorate ON areas(governorate);
