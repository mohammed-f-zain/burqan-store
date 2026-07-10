import { Platform } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";

import type { RegisterMapPanelProps } from "./RegisterMapFallback";
import { mapViewProvider } from "./registerMapConfig";
import { theme } from "./theme";

export default function RegisterMapNative(props: RegisterMapPanelProps) {
  const { mapRegion, lat, lng, mapAreas, areaId, zoneMap, inZone } = props;
  const repPinColor = inZone === true ? "#16a34a" : inZone === false ? theme.danger : theme.accent;

  return (
    <MapView
      key={lat != null && lng != null ? `${lat.toFixed(5)}-${lng.toFixed(5)}` : "jordan"}
      style={{ width: "100%", height: "100%" }}
      initialRegion={mapRegion}
      provider={mapViewProvider()}
      showsUserLocation={Platform.OS === "ios"}
      showsMyLocationButton={Platform.OS === "ios"}
    >
      {mapAreas.map((a) => {
        if (zoneMap) {
          return (
            <Polygon
              key={a.id}
              coordinates={a.coordinates}
              fillColor="rgba(37, 99, 235, 0.34)"
              strokeColor={theme.accent}
              strokeWidth={2}
            />
          );
        }
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
        <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor={repPinColor} title="موقع المتجر" />
      ) : null}
    </MapView>
  );
}
