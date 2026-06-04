import { Delaunay } from "d3-delaunay";

import { isInsideJordanBbox, jordanGhostSites, jordanVoronoiExtent } from "../data/jordanBounds.js";
import type { AreaGeo } from "./geoResolve.js";
import { GOVERNORATE_AREA_SUFFIX } from "./matchAreaFromGoogle.js";

export type VoronoiSite = {
  areaId: number;
  name: string;
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

export function areaRowsToVoronoiSites(rows: AreaGeo[]): VoronoiSite[] {
  return rows
    .filter((a) => a.center_lat != null && a.center_lng != null)
    .map((a) => ({
      areaId: a.id,
      name: a.name,
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
    features.push({
      type: "Feature",
      properties: {
        areaId: site.areaId,
        name: site.name,
        governorate: site.governorate,
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

/**
 * Assign area by Voronoi (full coverage inside Jordan bbox).
 * Prefer a neighborhood whose circle contains the point; otherwise use Voronoi cell owner.
 */
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

  const byId = new Map(rows.map((r) => [r.id, r]));

  const insideNeighborhood = sites
    .filter((s) => !isGovCoverage(s.name))
    .map((s) => {
      const row = byId.get(s.areaId)!;
      const distM = haversineMeters(lat, lng, s.lat, s.lng);
      const radiusM = parseFloat(String(row.radius_km)) * 1000;
      return { site: s, distM, inside: distM <= radiusM };
    })
    .filter((x) => x.inside)
    .sort((a, b) => a.distM - b.distM);

  if (insideNeighborhood.length) {
    const s = insideNeighborhood[0]!.site;
    return {
      areaId: s.areaId,
      areaName: s.name,
      governorate: s.governorate,
      insideMainNeighborhood: true,
    };
  }

  const vi = pickVoronoiSiteIndex(lat, lng, sites);
  if (vi == null || vi < 0 || vi >= sites.length) return null;
  const s = sites[vi]!;
  return {
    areaId: s.areaId,
    areaName: s.name,
    governorate: s.governorate,
    insideMainNeighborhood: false,
  };
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function pickFromVoronoiOrNullOutsideJordan(
  lat: number,
  lng: number,
  rows: AreaGeo[]
): ReturnType<typeof pickFromVoronoi> {
  if (!isInsideJordanBbox(lat, lng)) return null;
  return pickFromVoronoi(lat, lng, rows);
}
