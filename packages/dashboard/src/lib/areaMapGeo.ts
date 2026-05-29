export type MapAreaCircle = {
  id: number;
  name: string;
  governorate: string | null;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  isGovernorateCoverage: boolean;
};

export function parseAreaCircle(input: {
  id: number;
  name: string;
  governorate?: string | null;
  center_lat?: number | string | null;
  center_lng?: number | string | null;
  radius_km?: number | string | null;
  isGovernorateCoverage?: boolean;
}): MapAreaCircle | null {
  const centerLat =
    typeof input.center_lat === "number"
      ? input.center_lat
      : input.center_lat != null
        ? parseFloat(String(input.center_lat))
        : NaN;
  const centerLng =
    typeof input.center_lng === "number"
      ? input.center_lng
      : input.center_lng != null
        ? parseFloat(String(input.center_lng))
        : NaN;
  const radiusKm =
    typeof input.radius_km === "number"
      ? input.radius_km
      : input.radius_km != null
        ? parseFloat(String(input.radius_km))
        : NaN;
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    return null;
  }
  return {
    id: input.id,
    name: input.name,
    governorate: input.governorate ?? null,
    centerLat,
    centerLng,
    radiusKm,
    isGovernorateCoverage: input.isGovernorateCoverage === true,
  };
}
