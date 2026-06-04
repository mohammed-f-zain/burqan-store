export type VoronoiFeatureCollection = {
  type: "FeatureCollection";
  features: {
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
  }[];
};
