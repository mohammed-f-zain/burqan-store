import { areaNameFromGoogleLabel } from "../data/jordanAreaAliases.js";
import { governorateFromGoogleLabel } from "../data/jordanGovernorateMap.js";
import type { GoogleGeocodeResult } from "./googleGeocode.js";
import { governorateLabelFromGeocode, labelsFromGeocode } from "./googleGeocode.js";
import { normalizePlaceName } from "./normalizeArabic.js";
import type { AreaGeo } from "./geoResolve.js";

/** Governorate-wide fallback rows end with this suffix (see seed). */
export const GOVERNORATE_AREA_SUFFIX = " — تغطية المحافظة";

function isGovernorateCoverageArea(name: string): boolean {
  return name.endsWith(GOVERNORATE_AREA_SUFFIX);
}

function pickArea(area: AreaGeo): { areaId: number; areaName: string; governorate: string | null } {
  return { areaId: area.id, areaName: area.name, governorate: area.governorate };
}

/**
 * Match a Google reverse-geocode result to one of the candidate areas (rep areas or all Jordan).
 * Prefers detailed neighborhoods over governorate-wide coverage rows.
 */
export function matchAreaFromGoogle(
  geocode: GoogleGeocodeResult,
  candidates: AreaGeo[]
): { areaId: number; areaName: string; governorate: string | null } | null {
  if (!candidates.length) return null;

  const govLabel = governorateLabelFromGeocode(geocode);
  const govAr = govLabel ? governorateFromGoogleLabel(govLabel) : null;
  const scoped =
    govAr && candidates.length > 40 ? candidates.filter((a) => a.governorate === govAr) : candidates;
  const pool = scoped.length ? scoped : candidates;

  const byName = new Map(pool.map((a) => [normalizePlaceName(a.name), a]));
  const labels = labelsFromGeocode(geocode);

  for (const label of labels) {
    const viaAlias = areaNameFromGoogleLabel(label);
    if (viaAlias) {
      const area = byName.get(normalizePlaceName(viaAlias));
      if (area) return pickArea(area);
    }

    const norm = normalizePlaceName(label);
    const direct = byName.get(norm);
    if (direct) return pickArea(direct);

    for (const area of pool) {
      if (isGovernorateCoverageArea(area.name)) continue;
      const an = normalizePlaceName(area.name);
      if (norm.includes(an) || an.includes(norm)) return pickArea(area);
    }
  }

  if (govAr) {
    const govAreas = pool.filter((a) => a.governorate === govAr);
    const coverage = govAreas.find((a) => isGovernorateCoverageArea(a.name));
    if (coverage) return pickArea(coverage);
    if (govAreas.length === 1) return pickArea(govAreas[0]!);
  }

  return null;
}
