import { Delaunay } from "d3-delaunay";

import { isInsideJordanBbox, jordanGhostSites, jordanVoronoiExtent } from "../data/jordanBounds.js";
import { JORDAN_MICRO_REGION_SUFFIX } from "../data/jordanUrbanMicroGrid.js";
import type { AreaGeo } from "./geoResolve.js";
import { GOVERNORATE_AREA_SUFFIX } from "./matchAreaFromGoogle.js";

export type VoronoiSite = {
  areaId: number;
  name: string;
  mapLabel: string;
  governorate: string | null;
  lng: number;
  lat: number;
};

export type VoronoiGeoJsonFeature = {
  type: "Feature";
  properties: {
    areaId: number;
    name: string;
    governorate: string | null;
    centerLat: number;
    centerLng: number;
    labelShort: string;
    isGovernorateCoverage: boolean;
    isMicroRegion: boolean;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

export type VoronoiGeoJson = {
  type: "FeatureCollection";
  features: VoronoiGeoJsonFeature[];
};

function isGovCoverage(name: string): boolean {
  return name.endsWith(GOVERNORATE_AREA_SUFFIX);
}

function isMicroRegion(name: string): boolean {
  return name.includes(JORDAN_MICRO_REGION_SUFFIX);
}

function labelShort(displayName: string): string {
  if (!displayName) return "";
  if (displayName.endsWith(GOVERNORATE_AREA_SUFFIX)) {
    return displayName.replace(GOVERNORATE_AREA_SUFFIX, "").trim() || displayName;
  }
  if (isMicroRegion(displayName)) {
    const idx = displayName.indexOf(JORDAN_MICRO_REGION_SUFFIX);
    return displayName.slice(idx + JORDAN_MICRO_REGION_SUFFIX.length).trim() || displayName;
  }
  return displayName;
}

function displayNameForArea(row: AreaGeo): string {
  const ml = row.map_label?.trim();
  return ml || row.name;
}

export function areaRowsToVoronoiSites(rows: AreaGeo[]): VoronoiSite[] {
  return rows
    .filter((a) => a.center_lat != null && a.center_lng != null)
    .map((a) => ({
      areaId: a.id,
      name: a.name,
      mapLabel: displayNameForArea(a),
      governorate: a.governorate,
      lng: a.center_lng!,
      lat: a.center_lat!,
    }));
}

/** Build clipped Voronoi polygons for each area seed (ghost cells omitted). */
export function buildVoronoiGeoJson(sites: VoronoiSite[]): VoronoiGeoJson {
  if (!sites.length) {
    return { type: "FeatureCollection", features: [] };
  }

  const ghosts = jordanGhostSites();
  const allPoints: [number, number][] = [
    ...sites.map((s) => [s.lng, s.lat] as [number, number]),
    ...ghosts,
  ];
  const delaunay = Delaunay.from(allPoints);
  const voronoi = delaunay.voronoi(jordanVoronoiExtent());
  const features: VoronoiGeoJsonFeature[] = [];

  for (let i = 0; i < sites.length; i++) {
    const poly = voronoi.cellPolygon(i);
    if (!poly || poly.length < 4) continue;
    const ring = poly.map(([x, y]: [number, number]) => [x, y] as [number, number]);
    if (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1]) {
      ring.push([ring[0]![0], ring[0]![1]]);
    }
    const site = sites[i]!;
    const display = site.mapLabel;
    features.push({
      type: "Feature",
      properties: {
        areaId: site.areaId,
        name: display,
        governorate: site.governorate,
        centerLat: site.lat,
        centerLng: site.lng,
        labelShort: labelShort(display),
        isGovernorateCoverage: isGovCoverage(site.name),
        isMicroRegion: isMicroRegion(site.name),
      },
      geometry: {
        type: "Polygon",
        coordinates: [ring],
      },
    });
  }

  return { type: "FeatureCollection", features };
}

/** Nearest seed site (Voronoi cell owner) for GPS assignment. */
export function pickVoronoiSiteIndex(lat: number, lng: number, sites: VoronoiSite[]): number | null {
  if (!sites.length) return null;
  const delaunay = Delaunay.from(
    sites,
    (s: VoronoiSite) => s.lng,
    (s: VoronoiSite) => s.lat
  );
  const idx = delaunay.find(lng, lat);
  return idx >= 0 && idx < sites.length ? idx : null;
}

/** Assign area by Voronoi — every point in Jordan maps to exactly one named cell. */
export function pickFromVoronoi(
  lat: number,
  lng: number,
  rows: AreaGeo[]
): {
  areaId: number;
  areaName: string;
  governorate: string | null;
  insideMainNeighborhood: boolean;
} | null {
  const sites = areaRowsToVoronoiSites(rows);
  if (!sites.length) return null;

  const vi = pickVoronoiSiteIndex(lat, lng, sites);
  if (vi == null || vi < 0 || vi >= sites.length) return null;
  const s = sites[vi]!;
  return {
    areaId: s.areaId,
    areaName: s.mapLabel,
    governorate: s.governorate,
    insideMainNeighborhood: !isGovCoverage(s.name),
  };
}

export function pickFromVoronoiOrNullOutsideJordan(
  lat: number,
  lng: number,
  rows: AreaGeo[]
): ReturnType<typeof pickFromVoronoi> {
  if (!isInsideJordanBbox(lat, lng)) return null;
  return pickFromVoronoi(lat, lng, rows);
}
