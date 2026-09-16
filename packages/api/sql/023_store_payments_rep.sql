-- Allow reps to record store deferred payments.

ALTER TABLE store_payments
  ADD COLUMN IF NOT EXISTS recorded_by_representative_id INT
    REFERENCES representatives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_rep_created
  ON store_payments (recorded_by_representative_id, created_at DESC)
  WHERE recorded_by_representative_id IS NOT NULL;
