import { Platform } from "react-native";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from "react-native-maps";

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
      {mapAreas.map((a) => {
        const selected = a.id === areaId;
        const isGov = a.isGovernorateCoverage;
        return (
          <Polygon
            key={a.id}
            coordinates={a.coordinates}
            fillColor={
              selected
                ? "rgba(37, 99, 235, 0.28)"
                : isGov
                  ? "rgba(167, 139, 250, 0.14)"
                  : "rgba(34, 211, 238, 0.12)"
            }
            strokeColor={
              selected ? theme.accent : isGov ? "rgba(124, 58, 237, 0.7)" : "rgba(34, 211, 238, 0.55)"
            }
            strokeWidth={selected ? 2.5 : 1}
          />
        );
      })}
      {lat != null && lng != null ? (
        <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor={theme.accent} title="موقع المتجر" />
      ) : null}
    </MapView>
  );
}
