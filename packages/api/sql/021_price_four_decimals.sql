-- Widen money/price scale to 4 decimals (JOD fils-friendly).
-- Safe on live data: only increases scale; existing values keep their meaning (1.90 -> 1.9000).

ALTER TABLE products
  ALTER COLUMN price TYPE NUMERIC(14, 4)
  USING ROUND(price::numeric, 4);

ALTER TABLE representative_inventory
  ALTER COLUMN price TYPE NUMERIC(14, 4)
  USING CASE
    WHEN price IS NULL THEN NULL
    ELSE ROUND(price::numeric, 4)
  END;

ALTER TABLE order_lines
  ALTER COLUMN unit_price TYPE NUMERIC(14, 4)
  USING ROUND(unit_price::numeric, 4);

ALTER TABLE order_lines
  ALTER COLUMN line_total TYPE NUMERIC(16, 4)
  USING ROUND(line_total::numeric, 4);

ALTER TABLE orders
  ALTER COLUMN total_amount TYPE NUMERIC(16, 4)
  USING ROUND(total_amount::numeric, 4);

ALTER TABLE external_sale_lines
  ALTER COLUMN unit_price TYPE NUMERIC(14, 4)
  USING ROUND(unit_price::numeric, 4);

ALTER TABLE external_sale_lines
  ALTER COLUMN line_total TYPE NUMERIC(16, 4)
  USING ROUND(line_total::numeric, 4);

ALTER TABLE external_sales
  ALTER COLUMN total_amount TYPE NUMERIC(16, 4)
  USING ROUND(total_amount::numeric, 4);
