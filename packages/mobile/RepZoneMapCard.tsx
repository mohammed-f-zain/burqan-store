import { Ionicons } from "@expo/vector-icons";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getRepPosition,
  LocationDeniedError,
  LocationInaccurateError,
  LocationTimeoutError,
} from "./getDeviceLocation";
import type { MapRegion } from "./registerMapConfig";
import { shouldLoadNativeMapsModule } from "./registerMapConfig";
import { theme } from "./theme";
import { regionFromStorePins, type ZoneStorePin } from "./RepZoneMapNative";
import { voronoiGeoJsonToCells, type VoronoiMapCell } from "./voronoiMapGeo";

const RepZoneMapNativeLazy = lazy(() => import("./RepZoneMapNative"));
export type { ZoneStorePin };

const JORDAN_REGION: MapRegion = {
  latitude: 31.25,
  longitude: 36.5,
  latitudeDelta: 4.8,
  longitudeDelta: 4.2,
};

export type RepZoneMapLabels = {
  title: string;
  update: string;
  inZone: string;
  outZone: string;
  unknown: string;
  noRoute: string;
  locating: string;
  locationDenied: string;
  mapFallback: string;
};

type RouteToday = {
  dayName: string;
  zoneName: string;
  zoneId: number;
  areas: string[];
};

type ZoneStatusResponse = {
  routeToday: RouteToday | null;
  inZone: boolean | null;
  geojson?: { features?: unknown[] };
  message?: string;
};

type Props = {
  apiGet: (path: string) => Promise<Record<string, unknown>>;
  labels: RepZoneMapLabels;
  stores?: ZoneStorePin[];
  onNotice?: (msg: string) => void;
};

function regionFromCells(
  cells: VoronoiMapCell[],
  lat: number | null,
  lng: number | null,
  stores: ZoneStorePin[]
): MapRegion {
  const base = (() => {
    if (lat != null && lng != null) {
      return { latitude: lat, longitude: lng, latitudeDelta: 0.16, longitudeDelta: 0.16 };
    }
    if (cells.length) {
      const cLat = cells.reduce((s, c) => s + c.centerLat, 0) / cells.length;
      const cLng = cells.reduce((s, c) => s + c.centerLng, 0) / cells.length;
      return { latitude: cLat, longitude: cLng, latitudeDelta: 0.4, longitudeDelta: 0.4 };
    }
    return JORDAN_REGION;
  })();
  if (stores.length) {
    return regionFromStorePins(stores, lat, lng, base);
  }
  return base;
}

export default function RepZoneMapCard(props: Props) {
  const { apiGet, labels, stores = [], onNotice } = props;
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [routeToday, setRouteToday] = useState<RouteToday | null>(null);
  const [inZone, setInZone] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [mapAreas, setMapAreas] = useState<VoronoiMapCell[]>([]);

  const loadZoneStatus = useCallback(
    async (opts?: { refreshGps?: boolean }) => {
      const refreshGps = opts?.refreshGps ?? false;
      if (refreshGps) setUpdating(true);
      else setLoading(true);

      let nextLat = lat;
      let nextLng = lng;

      if (refreshGps || nextLat == null || nextLng == null) {
        try {
          const pos = await getRepPosition({ timeoutMs: 12_000, maxAccuracyM: 120 });
          nextLat = pos.lat;
          nextLng = pos.lng;
          setLat(pos.lat);
          setLng(pos.lng);
        } catch (e) {
          if (refreshGps) {
            if (e instanceof LocationDeniedError) onNotice?.(labels.locationDenied);
            else if (e instanceof LocationTimeoutError || e instanceof LocationInaccurateError) {
              onNotice?.(labels.locating);
            }
          }
        }
      }

      try {
        const qs =
          nextLat != null && nextLng != null
            ? `?lat=${nextLat}&lng=${nextLng}`
            : "";
        const data = (await apiGet(`/api/v1/rep/route/zone-status${qs}`)) as ZoneStatusResponse;
        setRouteToday(data.routeToday);
        setInZone(data.inZone);
        setMessage(data.message ?? null);
        setMapAreas(voronoiGeoJsonToCells(data.geojson));
      } catch {
        setRouteToday(null);
        setInZone(null);
        setMapAreas([]);
        setMessage(labels.noRoute);
      } finally {
        setLoading(false);
        setUpdating(false);
      }
    },
    [apiGet, labels.locationDenied, labels.locating, labels.noRoute, lat, lng, onNotice]
  );

  useEffect(() => {
    void loadZoneStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const mapRegion = useMemo(
    () => regionFromCells(mapAreas, lat, lng, stores),
    [mapAreas, lat, lng, stores]
  );

  const statusText =
    inZone === true ? labels.inZone : inZone === false ? labels.outZone : labels.unknown;
  const statusStyle =
    inZone === true ? styles.statusIn : inZone === false ? styles.statusOut : styles.statusUnknown;

  if (loading && !routeToday) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={theme.accent} />
        <Text style={styles.loadingText}>{labels.locating}</Text>
      </View>
    );
  }

  if (!routeToday) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.noRoute}>{message ?? labels.noRoute}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.headText}>
          <Text style={styles.title}>{labels.title}</Text>
          <Text style={styles.subtitle}>
            {routeToday.zoneName}
            {routeToday.dayName ? ` · ${routeToday.dayName}` : ""}
          </Text>
        </View>
        <Pressable
          style={[styles.updateBtn, updating && styles.updateBtnBusy]}
          onPress={() => void loadZoneStatus({ refreshGps: true })}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="locate" size={16} color="#fff" />
              <Text style={styles.updateBtnText}>{labels.update}</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={[styles.statusPill, statusStyle]}>
        <Ionicons
          name={inZone === true ? "checkmark-circle" : inZone === false ? "close-circle" : "help-circle"}
          size={16}
          color={inZone === true ? "#16a34a" : inZone === false ? theme.danger : theme.muted}
        />
        <Text style={[styles.statusText, statusStyle]}>{statusText}</Text>
      </View>

      <View style={styles.mapWrap}>
        {shouldLoadNativeMapsModule() ? (
          <Suspense
            fallback={
              <View style={styles.mapLoading}>
                <ActivityIndicator color={theme.accent} />
              </View>
            }
          >
            <RepZoneMapNativeLazy
              mapRegion={mapRegion}
              lat={lat}
              lng={lng}
              mapAreas={mapAreas}
              inZone={inZone}
              stores={stores}
              interactive
            />
          </Suspense>
        ) : (
          <View style={styles.mapFallback}>
            <Text style={styles.mapFallbackText}>{labels.mapFallback}</Text>
            {routeToday.areas.length ? (
              <Text style={styles.areasList} numberOfLines={2}>
                {routeToday.areas.join(" · ")}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 12,
    ...theme.shadow.card,
  },
  headRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  headText: { flex: 1, minWidth: 0 },
  title: { color: theme.text, fontSize: 16, fontWeight: "800", textAlign: "right" },
  subtitle: { color: theme.muted, fontSize: 12, marginTop: 2, textAlign: "right" },
  updateBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
  },
  updateBtnBusy: { opacity: 0.75, minWidth: 88, justifyContent: "center" },
  updateBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  statusPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    marginBottom: 10,
  },
  statusIn: { backgroundColor: "rgba(22, 163, 74, 0.12)", color: "#15803d" },
  statusOut: { backgroundColor: "rgba(225, 29, 72, 0.1)", color: theme.danger },
  statusUnknown: { backgroundColor: theme.accentSoft, color: theme.muted },
  statusText: { fontSize: 13, fontWeight: "700" },
  mapWrap: {
    height: 280,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: "#0f172a",
  },
  mapLoading: { flex: 1, justifyContent: "center", alignItems: "center" },
  mapFallback: { flex: 1, justifyContent: "center", alignItems: "center", padding: 12 },
  mapFallbackText: { color: "#cbd5e1", fontSize: 12, textAlign: "center" },
  areasList: { color: "#94a3b8", fontSize: 11, marginTop: 6, textAlign: "center" },
  loadingText: { color: theme.muted, textAlign: "center", marginTop: 8, fontSize: 13 },
  noRoute: { color: theme.muted, textAlign: "right", fontSize: 14, marginTop: 4 },
});
