export type VoronoiMapCell = {
  id: number;
  name: string;
  labelShort: string;
  governorate: string | null;
  centerLat: number;
  centerLng: number;
  isGovernorateCoverage: boolean;
  coordinates: { latitude: number; longitude: number }[];
};

type VoronoiGeoJson = {
  features?: {
    properties?: {
      areaId?: number;
      name?: string;
      governorate?: string | null;
      centerLat?: number;
      centerLng?: number;
      labelShort?: string;
      isGovernorateCoverage?: boolean;
    };
    geometry?: { coordinates?: number[][][] };
  }[];
};

export function voronoiGeoJsonToCells(geojson: VoronoiGeoJson | null | undefined): VoronoiMapCell[] {
  const features = geojson?.features ?? [];
  const out: VoronoiMapCell[] = [];
  for (const f of features) {
    const p = f.properties;
    const ring = f.geometry?.coordinates?.[0];
    if (!p || !ring?.length) continue;
    const id = Number(p.areaId);
    if (!Number.isFinite(id)) continue;
    const centerLat = Number(p.centerLat);
    const centerLng = Number(p.centerLng);
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) continue;
    out.push({
      id,
      name: String(p.name ?? ""),
      labelShort: String(p.labelShort ?? p.name ?? ""),
      governorate: p.governorate ?? null,
      centerLat,
      centerLng,
      isGovernorateCoverage: Boolean(p.isGovernorateCoverage),
      coordinates: ring.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      })),
    });
  }
  return out;
}
