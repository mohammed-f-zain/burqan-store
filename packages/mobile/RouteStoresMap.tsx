import { lazy, Suspense } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import MapPanelErrorBoundary from "./MapPanelErrorBoundary";
import type { MapRegion } from "./registerMapConfig";
import { shouldLoadNativeMapsModule } from "./registerMapConfig";
import { theme } from "./theme";
import type { VoronoiMapCell } from "./voronoiMapGeo";
import type { ZoneStorePin } from "./zoneMapTypes";

const RepZoneMapNative = lazy(() => import("./RepZoneMapNative"));

type Props = {
  mapRegion: MapRegion;
  lat?: number | null;
  lng?: number | null;
  mapAreas?: VoronoiMapCell[];
  stores: ZoneStorePin[];
  inZone?: boolean | null;
  height?: number;
  interactive?: boolean;
  fallbackText?: string;
};

export default function RouteStoresMap(props: Props) {
  const {
    mapRegion,
    lat = null,
    lng = null,
    mapAreas = [],
    stores,
    inZone = null,
    height = 140,
    interactive = false,
    fallbackText = "معاينة الخريطة غير متاحة على هذا الجهاز",
  } = props;

  if (!shouldLoadNativeMapsModule()) {
    return (
      <View style={[styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>{fallbackText}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <MapPanelErrorBoundary fallbackText={fallbackText} height={height}>
        <Suspense
          fallback={
            <View style={styles.loading}>
              <ActivityIndicator color={theme.accent} />
            </View>
          }
        >
          <RepZoneMapNative
            mapRegion={mapRegion}
            lat={lat}
            lng={lng}
            mapAreas={mapAreas}
            stores={stores}
            inZone={inZone}
            interactive={interactive}
          />
        </Suspense>
      </MapPanelErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", borderRadius: theme.radius.md, overflow: "hidden", backgroundColor: "#0f172a" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  fallback: {
    width: "100%",
    borderRadius: theme.radius.md,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  fallbackText: { color: "#cbd5e1", fontSize: 12, textAlign: "center", lineHeight: 18 },
});
