import { haversineMeters } from "./geoDistance.js";
import type { AreaGeo } from "./geoResolve.js";
import { pickFromVoronoi } from "./jordanVoronoi.js";
import { GOVERNORATE_AREA_SUFFIX } from "./matchAreaFromGoogle.js";

export type CirclePick = {
  areaId: number;
  areaName: string;
  governorate: string | null;
  source: "gps";
  /** True when GPS lies inside a main neighborhood circle (not governorate fallback / not nearest-only). */
  insideMainNeighborhood: boolean;
};

function isGovCoverage(name: string): boolean {
  return name.endsWith(GOVERNORATE_AREA_SUFFIX);
}

/** Pick area from GPS circles — closest center among neighborhoods inside radius. */
export function pickFromCircles(lat: number, lng: number, rows: AreaGeo[]): CirclePick {
  const withCenter = rows.filter((a) => a.center_lat != null && a.center_lng != null);
  if (!withCenter.length) {
    const fallback = rows[0]!;
    return {
      areaId: fallback.id,
      areaName: fallback.name,
      governorate: fallback.governorate,
      source: "gps",
      insideMainNeighborhood: false,
    };
  }

  const scored = withCenter.map((a) => {
    const distM = haversineMeters(lat, lng, a.center_lat!, a.center_lng!);
    const radiusM = parseFloat(String(a.radius_km)) * 1000;
    return { area: a, distM, inside: distM <= radiusM };
  });

  const insideNeighborhoods = scored
    .filter((s) => s.inside && !isGovCoverage(s.area.name))
    .sort((a, b) => a.distM - b.distM);

  if (insideNeighborhoods.length) {
    const a = insideNeighborhoods[0]!.area;
    return {
      areaId: a.id,
      areaName: a.name,
      governorate: a.governorate,
      source: "gps",
      insideMainNeighborhood: true,
    };
  }

  const insideAny = scored
    .filter((s) => s.inside)
    .sort((a, b) => {
      const ra = parseFloat(String(a.area.radius_km));
      const rb = parseFloat(String(b.area.radius_km));
      if (ra !== rb) return ra - rb;
      const aGov = isGovCoverage(a.area.name) ? 1 : 0;
      const bGov = isGovCoverage(b.area.name) ? 1 : 0;
      if (aGov !== bGov) return aGov - bGov;
      return a.distM - b.distM;
    });

  if (insideAny.length) {
    const a = insideAny[0]!.area;
    return {
      areaId: a.id,
      areaName: a.name,
      governorate: a.governorate,
      source: "gps",
      insideMainNeighborhood: false,
    };
  }

  const voronoiPick = pickFromVoronoi(lat, lng, rows);
  if (voronoiPick) {
    return {
      areaId: voronoiPick.areaId,
      areaName: voronoiPick.areaName,
      governorate: voronoiPick.governorate,
      source: "gps",
      insideMainNeighborhood: voronoiPick.insideMainNeighborhood,
    };
  }

  scored.sort((a, b) => a.distM - b.distM);
  const nearest = scored[0]!.area;
  return {
    areaId: nearest.id,
    areaName: nearest.name,
    governorate: nearest.governorate,
    source: "gps",
    insideMainNeighborhood: false,
  };
}
