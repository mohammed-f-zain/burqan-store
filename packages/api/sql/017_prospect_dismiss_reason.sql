-- Optional dismiss reason when admin closes a possible client.

ALTER TABLE prospect_stores
  ADD COLUMN IF NOT EXISTS dismiss_reason TEXT;
