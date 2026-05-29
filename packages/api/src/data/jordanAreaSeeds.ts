import { MAX_DETAILED_AREA_RADIUS_KM } from "./jordanAreaConstants.js";
import { buildGovernorateGridAreas } from "./jordanGovernorateGrid.js";
import { JORDAN_DETAILED_AREAS, type JordanAreaSeed } from "./jordanDetailedAreas.js";
import { JORDAN_EXTENDED_NEIGHBORHOODS } from "./jordanNeighborhoodsExtended.js";

function clampDetailedRadius(area: JordanAreaSeed): JordanAreaSeed {
  return {
    ...area,
    radiusKm: Math.min(area.radiusKm, MAX_DETAILED_AREA_RADIUS_KM),
  };
}

/** All detailed seeds: neighborhoods + extended + 1 km grid (deduped by name). */
export function allJordanAreaSeeds(): JordanAreaSeed[] {
  const merged: JordanAreaSeed[] = [];
  const seen = new Set<string>();

  for (const raw of [
    ...JORDAN_DETAILED_AREAS,
    ...JORDAN_EXTENDED_NEIGHBORHOODS,
    ...buildGovernorateGridAreas(),
  ]) {
    const a = clampDetailedRadius(raw);
    if (seen.has(a.name)) continue;
    seen.add(a.name);
    merged.push(a);
  }
  return merged;
}
