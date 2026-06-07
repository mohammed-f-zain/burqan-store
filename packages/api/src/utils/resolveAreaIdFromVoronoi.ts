import { pickAreaFromGps } from "./geoPick.js";
import type { AreaGeo, ResolvedArea } from "./geoResolve.js";
import { loadVoronoiAreaRows } from "./loadVoronoiAreaRows.js";

let cachedVoronoiRows: AreaGeo[] | null = null;

/** Clear cache after area seed refresh (import scripts). */
export function clearVoronoiAreaCache(): void {
  cachedVoronoiRows = null;
}

/** Assign neighborhood using the same Voronoi cells as the rep map (no Google geocode). */
export async function resolveAreaIdFromVoronoi(lat: number, lng: number): Promise<ResolvedArea> {
  if (!cachedVoronoiRows) {
    cachedVoronoiRows = await loadVoronoiAreaRows();
  }
  if (!cachedVoronoiRows.length) {
    throw new Error("لم تُعرَّف المناطق على الخادم — شغّل seed:jordan-areas");
  }
  const pick = pickAreaFromGps(lat, lng, cachedVoronoiRows);
  return {
    areaId: pick.areaId,
    areaName: pick.areaName,
    governorate: pick.governorate,
    source: "gps",
  };
}
