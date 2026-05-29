/** Default radius (km) for main neighborhoods outside dense cities. */
export const MAIN_AREA_RADIUS_KM = 3.5;

/** Tighter circles in dense Amman / Zarqa urban zones — less overlap mis-assignment. */
export const DENSE_URBAN_RADIUS_KM = 2.5;

/** @deprecated Use MAIN_AREA_RADIUS_KM — kept for legacy imports. */
export const MAX_DETAILED_AREA_RADIUS_KM = MAIN_AREA_RADIUS_KM;

/** Grid spacing (km); legacy grid (not seeded by default). */
export const GRID_STEP_KM = 4.9;
