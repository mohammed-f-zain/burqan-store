import { Platform } from "react-native";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from "react-native-maps";

import type { MapRegion } from "./registerMapConfig";
import { theme } from "./theme";
import type { VoronoiMapCell } from "./voronoiMapGeo";
import type { ZoneStorePin } from "./zoneMapTypes";

type Props = {
  mapRegion: MapRegion;
  lat: number | null;
  lng: number | null;
  mapAreas: VoronoiMapCell[];
  stores?: ZoneStorePin[];
  inZone: boolean | null;
  interactive?: boolean;
};

function storePinColor(store: ZoneStorePin): string {
  if (store.visitedToday) return "#16a34a";
  if (store.isProspect) return "#f59e0b";
  return "#2563eb";
}

export default function RepZoneMapNative(props: Props) {
  const { mapRegion, lat, lng, mapAreas, stores = [], inZone, interactive = false } = props;
  const repPinColor = inZone === true ? "#16a34a" : inZone === false ? theme.danger : theme.accent;

  return (
    <MapView
      key={lat != null && lng != null ? `${lat.toFixed(5)}-${lng.toFixed(5)}` : "zone"}
      style={{ width: "100%", height: "100%" }}
      initialRegion={mapRegion}
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
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
      {stores.map((s) => (
        <Marker
          key={`store-${s.id}-${s.isProspect ? "p" : "b"}`}
          coordinate={{ latitude: s.lat, longitude: s.lng }}
          pinColor={storePinColor(s)}
          title={s.name}
        />
      ))}
      {lat != null && lng != null ? (
        <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor={repPinColor} title="موقعك" />
      ) : null}
    </MapView>
  );
}
