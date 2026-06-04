import { JORDAN_BBOX } from "../data/jordanBounds.js";
import { areaBboxParams } from "./areaQuery.js";
import { areaRowsToVoronoiSites, buildVoronoiGeoJson, type VoronoiGeoJson } from "./jordanVoronoi.js";
import { loadVoronoiAreaRows } from "./loadVoronoiAreaRows.js";

export async function buildJordanVoronoiPayload(filter?: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
}): Promise<{
  geojson: VoronoiGeoJson;
  siteCount: number;
  algorithm: string;
  bbox: typeof JORDAN_BBOX;
}> {
  const rows = await loadVoronoiAreaRows();
  const sites = areaRowsToVoronoiSites(rows);
  let geojson = buildVoronoiGeoJson(sites);

  if (filter?.lat != null && filter?.lng != null) {
    const radiusKm = filter.radiusKm ?? 28;
    const box = areaBboxParams(filter.lat, filter.lng, radiusKm);
    geojson = {
      type: "FeatureCollection",
      features: geojson.features.filter((f) => {
        const lat = f.properties.centerLat;
        const lng = f.properties.centerLng;
        return (
          lat >= box.minLat &&
          lat <= box.maxLat &&
          lng >= box.minLng &&
          lng <= box.maxLng
        );
      }),
    };
  }

  return {
    geojson,
    siteCount: sites.length,
    algorithm: "delaunay-voronoi",
    bbox: JORDAN_BBOX,
  };
}
