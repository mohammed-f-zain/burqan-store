import { fetchJson } from "./fetchJson";
import { voronoiGeoJsonToCells, type VoronoiMapCell } from "./voronoiMapGeo";

/** Voronoi cells for the rep's scheduled route zone (today), not all nearby Jordan areas. */
export async function fetchRepZoneMapAreas(
  apiBase: string,
  headers: Record<string, string>,
  lat: number,
  lng: number
): Promise<VoronoiMapCell[]> {
  const url = `${apiBase}/api/v1/rep/route/zone-status?lat=${lat}&lng=${lng}`;
  const { res, data } = await fetchJson<{ geojson?: { features?: unknown[] }; error?: string }>(url, {
    headers,
    timeoutMs: 20_000,
  });
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "تعذّر تحميل خريطة المناطق");
  }
  return voronoiGeoJsonToCells(data.geojson);
}
