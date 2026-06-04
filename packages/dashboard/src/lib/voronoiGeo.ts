export type VoronoiFeatureProperties = {
  areaId: number;
  name: string;
  governorate: string | null;
  centerLat: number;
  centerLng: number;
  labelShort: string;
  isGovernorateCoverage: boolean;
};

export type VoronoiFeatureCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: VoronoiFeatureProperties;
    geometry: {
      type: "Polygon";
      coordinates: number[][][];
    };
  }[];
};
