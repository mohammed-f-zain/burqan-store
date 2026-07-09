import { lazy, Suspense, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import type { MapRegion } from "./registerMapConfig";
import { shouldLoadNativeMapsModule } from "./registerMapConfig";
import { regionFromStorePins, type ZoneStorePin } from "./zoneMapTypes";
import { theme } from "./theme";

const RepZoneMapNativeLazy = lazy(() => import("./RepZoneMapNative"));

type Props = {
  stores: ZoneStorePin[];
  height?: number;
  interactive?: boolean;
};

const FALLBACK_REGION: MapRegion = {
  latitude: 31.25,
  longitude: 36.5,
  latitudeDelta: 0.25,
  longitudeDelta: 0.25,
};

export default function RouteStoresMap({ stores, height = 168, interactive = true }: Props) {
  const mapRegion = useMemo(
    () => regionFromStorePins(stores, null, null, FALLBACK_REGION),
    [stores]
  );

  if (!stores.length) return null;

  if (!shouldLoadNativeMapsModule()) {
    return null;
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <Suspense
        fallback={
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accent} />
          </View>
        }
      >
        <RepZoneMapNativeLazy
          mapRegion={mapRegion}
          lat={null}
          lng={null}
          mapAreas={[]}
          inZone={null}
          stores={stores}
          interactive={interactive}
        />
      </Suspense>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    marginTop: 10,
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  fallback: {
    borderRadius: theme.radius.md,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
});
