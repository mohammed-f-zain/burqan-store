/** Legacy 1 km grid labels — excluded from mobile maps and GPS matching. */
export const EXCLUDE_GRID_AREA_SQL = `name NOT LIKE '% — شبكة %'`;

/** Rough bounding box (degrees) around a point for nearby area candidates. */
export function areaBboxParams(lat: number, lng: number, radiusKm: number) {
  const padDeg = Math.max(0.08, (radiusKm / 111) * 1.35);
  return {
    minLat: lat - padDeg,
    maxLat: lat + padDeg,
    minLng: lng - padDeg,
    maxLng: lng + padDeg,
  };
}
