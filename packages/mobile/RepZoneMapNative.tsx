import { Platform } from "react-native";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from "react-native-maps";

import type { MapRegion } from "./registerMapConfig";
import { theme } from "./theme";
import type { VoronoiMapCell } from "./voronoiMapGeo";

export type ZoneStorePin = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  visitedToday?: boolean;
};

type Props = {
  mapRegion: MapRegion;
  lat: number | null;
  lng: number | null;
  mapAreas: VoronoiMapCell[];
  inZone: boolean | null;
  stores?: ZoneStorePin[];
  interactive?: boolean;
};

export default function RepZoneMapNative(props: Props) {
  const { mapRegion, lat, lng, mapAreas, inZone, stores = [], interactive = true } = props;
  const pinColor = inZone === true ? "#16a34a" : inZone === false ? theme.danger : theme.accent;

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
          key={`store-${s.id}`}
          coordinate={{ latitude: s.lat, longitude: s.lng }}
          pinColor={s.visitedToday ? "#16a34a" : "#f59e0b"}
          title={s.name}
        />
      ))}
      {lat != null && lng != null ? (
        <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor={pinColor} title="موقعك" />
      ) : null}
    </MapView>
  );
}

export function regionFromStorePins(
  stores: ZoneStorePin[],
  repLat: number | null,
  repLng: number | null,
  fallback: MapRegion
): MapRegion {
  const pts: { lat: number; lng: number }[] = stores.map((s) => ({ lat: s.lat, lng: s.lng }));
  if (repLat != null && repLng != null) pts.push({ lat: repLat, lng: repLng });
  if (!pts.length) return fallback;
  const minLat = Math.min(...pts.map((p) => p.lat));
  const maxLat = Math.max(...pts.map((p) => p.lat));
  const minLng = Math.min(...pts.map((p) => p.lng));
  const maxLng = Math.max(...pts.map((p) => p.lng));
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.45, 0.05),
    longitudeDelta: Math.max((maxLng - minLng) * 1.45, 0.05),
  };
}
