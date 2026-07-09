import { Platform } from "react-native";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from "react-native-maps";

import type { MapRegion } from "./registerMapConfig";
import { theme } from "./theme";
import type { VoronoiMapCell } from "./voronoiMapGeo";

type Props = {
  mapRegion: MapRegion;
  lat: number | null;
  lng: number | null;
  mapAreas: VoronoiMapCell[];
  inZone: boolean | null;
};

export default function RepZoneMapNative(props: Props) {
  const { mapRegion, lat, lng, mapAreas, inZone } = props;
  const pinColor = inZone === true ? "#16a34a" : inZone === false ? theme.danger : theme.accent;

  return (
    <MapView
      key={lat != null && lng != null ? `${lat.toFixed(5)}-${lng.toFixed(5)}` : "zone"}
      style={{ width: "100%", height: "100%" }}
      initialRegion={mapRegion}
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      {mapAreas.map((a) => (
        <Polygon
          key={a.id}
          coordinates={a.coordinates}
          fillColor="rgba(37, 99, 235, 0.34)"
          strokeColor={theme.accent}
          strokeWidth={2}
        />
      ))}
      {lat != null && lng != null ? (
        <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor={pinColor} title="موقعك" />
      ) : null}
    </MapView>
  );
}
