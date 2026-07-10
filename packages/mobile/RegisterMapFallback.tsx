import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import type { JordanAreaMap, MapRegion } from "./registerMapConfig";
import { theme } from "./theme";

export type RegisterMapPanelProps = {
  mapRegion: MapRegion;
  lat: number | null;
  lng: number | null;
  mapAreas: JordanAreaMap[];
  areaId?: number;
  /** Highlight rep route zone polygons instead of the GPS-resolved area cell. */
  zoneMap?: boolean;
  /** Rep GPS inside today's route zone (pin color). */
  inZone?: boolean | null;
  labels: {
    mapFallback: string;
    openInMaps: string;
    storeLocation: string;
  };
};

export default function RegisterMapFallback(props: RegisterMapPanelProps) {
  const { lat, lng, mapAreas, labels } = props;
  const mapsUrl =
    lat != null && lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : null;

  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>{labels.mapFallback}</Text>
      {lat != null && lng != null ? (
        <Text style={styles.fallbackCoords}>
          {labels.storeLocation}: {lat.toFixed(5)}, {lng.toFixed(5)}
        </Text>
      ) : null}
      {mapAreas.length > 0 ? (
        <Text style={styles.fallbackAreas}>
          {mapAreas
            .slice(0, 4)
            .map((a) => a.labelShort || a.name)
            .join(" · ")}
          {mapAreas.length > 4 ? " …" : ""}
        </Text>
      ) : null}
      {mapsUrl ? (
        <Pressable style={styles.mapsBtn} onPress={() => void Linking.openURL(mapsUrl)}>
          <Text style={styles.mapsBtnText}>{labels.openInMaps}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#0f172a",
    borderRadius: 12,
  },
  fallbackTitle: { color: "#e2e8f0", fontSize: 14, textAlign: "center", marginBottom: 8 },
  fallbackCoords: { color: "#94a3b8", fontSize: 13, textAlign: "center", marginBottom: 6 },
  fallbackAreas: { color: "#64748b", fontSize: 12, textAlign: "center", marginBottom: 12 },
  mapsBtn: {
    marginTop: 8,
    backgroundColor: theme.accent,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  mapsBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
