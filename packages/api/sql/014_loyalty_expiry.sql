-- Loyalty points expire after N days from the first earning purchase in a period.

CREATE TABLE IF NOT EXISTS loyalty_settings (
  id INT PRIMARY KEY CHECK (id = 1),
  expiry_days INT NOT NULL DEFAULT 120 CHECK (expiry_days > 0 AND expiry_days <= 3650),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO loyalty_settings (id, expiry_days) VALUES (1, 120)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS loyalty_period_started_at TIMESTAMPTZ;

-- Every store that ever earned loyalty points: period starts at first such purchase.
UPDATE stores s
SET loyalty_period_started_at = sub.first_at
FROM (
  SELECT o.store_id, MIN(o.created_at) AS first_at
  FROM orders o
  JOIN order_lines ol ON ol.order_id = o.id
  WHERE ol.loyalty_points_earned > 0
  GROUP BY o.store_id
) sub
WHERE s.id = sub.store_id
  AND s.loyalty_period_started_at IS NULL;

-- Balance with no earning history (e.g. manual adjustment): period starts at migration time.
UPDATE stores
SET loyalty_period_started_at = now()
WHERE loyalty_points_balance > 0
  AND loyalty_period_started_at IS NULL;
