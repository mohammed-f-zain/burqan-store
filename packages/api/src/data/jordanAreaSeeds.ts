import { MAX_DETAILED_AREA_RADIUS_KM } from "./jordanAreaConstants.js";
import { JORDAN_DETAILED_AREAS, type JordanAreaSeed } from "./jordanDetailedAreas.js";
import { JORDAN_EXTENDED_NEIGHBORHOODS } from "./jordanNeighborhoodsExtended.js";
import { JORDAN_REAL_NEIGHBORHOODS } from "./jordanRealNeighborhoods.js";
import { SPLIT_AREA_NAMES } from "./jordanSplitAreaMerges.js";

function clampDetailedRadius(area: JordanAreaSeed): JordanAreaSeed {
  return {
    ...area,
    radiusKm: MAX_DETAILED_AREA_RADIUS_KM,
  };
}

/** All detailed seeds: real neighborhood names only (deduped by name). */
export function allJordanAreaSeeds(): JordanAreaSeed[] {
  const merged: JordanAreaSeed[] = [];
  const seen = new Set<string>();

  for (const raw of [
    ...JORDAN_DETAILED_AREAS,
    ...JORDAN_REAL_NEIGHBORHOODS,
    ...JORDAN_EXTENDED_NEIGHBORHOODS,
  ]) {
    const a = clampDetailedRadius(raw);
    if (SPLIT_AREA_NAMES.has(a.name)) continue;
    if (seen.has(a.name)) continue;
    seen.add(a.name);
    merged.push(a);
  }
  return merged;
}
