/** Display label for area rows (OSM map_label when set). */
export const AREA_DISPLAY_NAME_SQL = `COALESCE(NULLIF(TRIM(a.map_label), ''), a.name)`;
