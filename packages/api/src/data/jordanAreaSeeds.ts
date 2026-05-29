import { JORDAN_MAIN_AREAS } from "./jordanMainAreas.js";
import type { JordanAreaSeed } from "./jordanDetailedAreas.js";

/** Curated main neighborhoods only — full Jordan via governorate fallback rows. */
export function allJordanAreaSeeds(): JordanAreaSeed[] {
  return [...JORDAN_MAIN_AREAS];
}
