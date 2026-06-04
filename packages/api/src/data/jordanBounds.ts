/** Approximate Jordan bounding box (WGS84) for Voronoi clipping. */
export const JORDAN_BBOX = {
  minLat: 29.05,
  maxLat: 33.38,
  minLng: 34.88,
  maxLng: 39.32,
} as const;

/** Delaunay/Voronoi bbox: [xmin, ymin, xmax, ymax] = [west, south, east, north]. */
export function jordanVoronoiExtent(): [number, number, number, number] {
  const { minLng, minLat, maxLng, maxLat } = JORDAN_BBOX;
  return [minLng, minLat, maxLng, maxLat];
}

/** Ghost sites outside Jordan so interior cells are bounded (classic Voronoi clip). */
export function jordanGhostSites(): [number, number][] {
  const { minLat, maxLat, minLng, maxLng } = JORDAN_BBOX;
  const padLat = 1.2;
  const padLng = 1.2;
  return [
    [minLng - padLng, minLat - padLat],
    [maxLng + padLng, minLat - padLat],
    [minLng - padLng, maxLat + padLat],
    [maxLng + padLng, maxLat + padLat],
    [(minLng + maxLng) / 2, minLat - padLat],
    [(minLng + maxLng) / 2, maxLat + padLat],
    [minLng - padLng, (minLat + maxLat) / 2],
    [maxLng + padLng, (minLat + maxLat) / 2],
  ];
}

export function isInsideJordanBbox(lat: number, lng: number): boolean {
  const { minLat, maxLat, minLng, maxLng } = JORDAN_BBOX;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}
