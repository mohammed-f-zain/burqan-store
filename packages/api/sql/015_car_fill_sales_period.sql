-- Track last van refill so fill-car sales count only orders since that refill.

ALTER TABLE representatives
  ADD COLUMN IF NOT EXISTS car_fill_at TIMESTAMPTZ;
