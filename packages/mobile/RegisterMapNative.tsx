import { Platform } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";

import type { RegisterMapPanelProps } from "./RegisterMapFallback";
import { theme } from "./theme";

export default function RegisterMapNative(props: RegisterMapPanelProps) {
  const { mapRegion, lat, lng, mapAreas, areaId } = props;

  return (
    <MapView
      key={lat != null && lng != null ? `${lat.toFixed(5)}-${lng.toFixed(5)}` : "jordan"}
      style={{ width: "100%", height: "100%" }}
      initialRegion={mapRegion}
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      showsUserLocation={Platform.OS === "ios"}
      showsMyLocationButton={Platform.OS === "ios"}
    >
      {mapAreas.map((a) => (
        <Circle
          key={a.id}
          center={{ latitude: a.centerLat, longitude: a.centerLng }}
          radius={a.radiusKm * 1000}
          fillColor={a.id === areaId ? "rgba(37, 99, 235, 0.2)" : "rgba(34, 211, 238, 0.08)"}
          strokeColor={a.id === areaId ? theme.accent : "rgba(34, 211, 238, 0.45)"}
          strokeWidth={a.id === areaId ? 2 : 1}
        />
      ))}
      {lat != null && lng != null ? (
        <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor={theme.accent} title="موقع المتجر" />
      ) : null}
    </MapView>
  );
}
