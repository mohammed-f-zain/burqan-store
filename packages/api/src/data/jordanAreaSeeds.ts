import { JORDAN_AMMAN_DENSE } from "./jordanAmmanDense.js";
import { JORDAN_DETAILED_AREAS } from "./jordanDetailedAreas.js";
import { JORDAN_MAIN_AREAS } from "./jordanMainAreas.js";
import { JORDAN_EXTENDED_NEIGHBORHOODS } from "./jordanNeighborhoodsExtended.js";
import { JORDAN_REAL_NEIGHBORHOODS } from "./jordanRealNeighborhoods.js";
import { buildUrbanMicroGridSeeds } from "./jordanUrbanMicroGrid.js";
import type { JordanAreaSeed } from "./jordanDetailedAreas.js";

function mergeNamedLayers(layers: JordanAreaSeed[][]): JordanAreaSeed[] {
  const byName = new Map<string, JordanAreaSeed>();
  for (const layer of layers) {
    for (const a of layer) {
      if (!byName.has(a.name)) byName.set(a.name, a);
    }
  }
  return [...byName.values()];
}

/**
 * Merge all named neighborhood layers (main wins on duplicate names), then urban micro-grid fill.
 */
export function mergeJordanAreaSeeds(): JordanAreaSeed[] {
  const named = mergeNamedLayers([
    JORDAN_MAIN_AREAS,
    JORDAN_DETAILED_AREAS,
    JORDAN_REAL_NEIGHBORHOODS,
    JORDAN_EXTENDED_NEIGHBORHOODS,
    JORDAN_AMMAN_DENSE,
  ]);
  const micro = buildUrbanMicroGridSeeds(named);
  return [...named, ...micro];
}

/** Full Jordan Voronoi seed list (neighborhoods + micro fill + governorate rows in DB). */
export function allJordanAreaSeeds(): JordanAreaSeed[] {
  return mergeJordanAreaSeeds();
}

export const JORDAN_SEED_AREA_NAMES = new Set(mergeJordanAreaSeeds().map((a) => a.name));
