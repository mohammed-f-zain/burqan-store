import { areaNameFromGoogleLabel } from "../data/jordanAreaAliases.js";
import { governorateFromGoogleLabel } from "../data/jordanGovernorateMap.js";
import type { GoogleGeocodeResult } from "./googleGeocode.js";
import { governorateLabelFromGeocode, labelsFromGeocode } from "./googleGeocode.js";
import { haversineMeters } from "./geoDistance.js";
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

function areaContainsGps(area: AreaGeo, lat: number, lng: number): boolean {
  if (area.center_lat == null || area.center_lng == null) return false;
  const radiusM = parseFloat(String(area.radius_km)) * 1000;
  if (!Number.isFinite(radiusM) || radiusM <= 0) return false;
  const distM = haversineMeters(lat, lng, area.center_lat, area.center_lng);
  return distM <= radiusM * 1.08;
}

/**
 * Match Google reverse-geocode labels to a candidate area.
 * When lat/lng are provided, matches must lie inside the area circle (stops wrong fuzzy hits).
 */
export function matchAreaFromGoogle(
  geocode: GoogleGeocodeResult,
  candidates: AreaGeo[],
  lat?: number,
  lng?: number
): { areaId: number; areaName: string; governorate: string | null } | null {
  if (!candidates.length) return null;

  const hasGps = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  const accept = (area: AreaGeo): boolean => {
    if (!hasGps) return true;
    if (isGovernorateCoverageArea(area.name)) return true;
    return areaContainsGps(area, lat!, lng!);
  };

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
      if (area && accept(area)) return pickArea(area);
    }

    const norm = normalizePlaceName(label);
    const direct = byName.get(norm);
    if (direct && accept(direct)) return pickArea(direct);

    for (const area of pool) {
      if (isGovernorateCoverageArea(area.name)) continue;
      const an = normalizePlaceName(area.name);
      if (norm.length >= 4 && an.length >= 4 && (norm.includes(an) || an.includes(norm))) {
        if (accept(area)) return pickArea(area);
      }
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
