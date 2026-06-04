import type { AreaGeo } from "./geoResolve.js";
import { pickFromVoronoi } from "./jordanVoronoi.js";

export type AreaPick = {
  areaId: number;
  areaName: string;
  governorate: string | null;
  source: "gps";
  /** True when the assigned cell is a main neighborhood (not governorate fallback). */
  insideMainNeighborhood: boolean;
};

/** Assign area from GPS using Voronoi cells (full Jordan coverage). */
export function pickAreaFromGps(lat: number, lng: number, rows: AreaGeo[]): AreaPick {
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

  const first = withCenter[0]!;
  return {
    areaId: first.id,
    areaName: first.name,
    governorate: first.governorate,
    source: "gps",
    insideMainNeighborhood: false,
  };
}

/** @deprecated Use pickAreaFromGps — kept for existing tests/imports. */
export const pickFromCircles = pickAreaFromGps;
