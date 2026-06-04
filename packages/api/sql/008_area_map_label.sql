-- Display label for maps (OpenStreetMap / Google). Falls back to name when NULL.
ALTER TABLE areas ADD COLUMN IF NOT EXISTS map_label VARCHAR(255);

UPDATE areas SET map_label = name WHERE map_label IS NULL;
