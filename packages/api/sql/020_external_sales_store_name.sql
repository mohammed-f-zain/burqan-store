-- Free-text store label on external sales (not linked to stores table).

ALTER TABLE external_sales
  ADD COLUMN IF NOT EXISTS store_name TEXT;

UPDATE external_sales
   SET store_name = COALESCE(NULLIF(BTRIM(store_name), ''), 'External sale')
 WHERE store_name IS NULL OR BTRIM(store_name) = '';

ALTER TABLE external_sales
  ALTER COLUMN store_name SET NOT NULL;
