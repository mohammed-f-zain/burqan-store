import { JORDAN_MAIN_AREAS } from "./jordanMainAreas.js";
import { JORDAN_OSM_NEIGHBORHOODS } from "./jordanOsmNeighborhoods.js";
import type { JordanAreaSeed } from "./jordanDetailedAreas.js";

/**
 * OSM names match the dashboard map (OpenStreetMap tiles).
 * MAIN list only adjusts coordinates for known GPS-tuned spots when the OSM name matches.
 */
export function mergeJordanAreaSeeds(): JordanAreaSeed[] {
  const byName = new Map<string, JordanAreaSeed>();

  for (const a of JORDAN_OSM_NEIGHBORHOODS) {
    byName.set(a.name, { ...a });
  }

  for (const a of JORDAN_MAIN_AREAS) {
    const existing = byName.get(a.name);
    if (existing) {
      byName.set(a.name, {
        ...existing,
        centerLat: a.centerLat,
        centerLng: a.centerLng,
        radiusKm: a.radiusKm,
        governorate: a.governorate,
      });
    } else {
      byName.set(a.name, { ...a });
    }
  }

  return [...byName.values()];
}

/** Full Jordan Voronoi seed list (OSM + tuned main + governorate rows in DB). */
export function allJordanAreaSeeds(): JordanAreaSeed[] {
  return mergeJordanAreaSeeds();
}

export const JORDAN_SEED_AREA_NAMES = new Set(mergeJordanAreaSeeds().map((a) => a.name));
