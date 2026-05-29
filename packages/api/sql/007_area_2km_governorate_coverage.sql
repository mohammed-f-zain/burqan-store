-- 2 km neighborhood zones + per-governorate "cover all" toggle on fallback rows.
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS governorate_full_coverage BOOLEAN NOT NULL DEFAULT false;

UPDATE areas
SET governorate_full_coverage = true
WHERE name LIKE '% — تغطية المحافظة';
