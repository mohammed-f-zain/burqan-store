/** Display label for area rows (OSM map_label when set). */
export const AREA_DISPLAY_NAME_SQL = `COALESCE(NULLIF(TRIM(a.map_label), ''), a.name)`;

/** Max Google prospects returned to rep app per request (full governorate import can be 7k+). */
export const REP_GOOGLE_PLACES_LIMIT = 15_000;
