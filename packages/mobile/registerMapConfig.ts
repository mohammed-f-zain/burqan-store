import Constants from "expo-constants";
import { Platform } from "react-native";
import { PROVIDER_GOOGLE } from "react-native-maps";

import type { VoronoiMapCell } from "./voronoiMapGeo";

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type { VoronoiMapCell as JordanAreaMap } from "./voronoiMapGeo";

export function mapRegionFromCells(
  cells: VoronoiMapCell[],
  lat: number | null,
  lng: number | null,
  fallback: MapRegion
): MapRegion {
  if (lat != null && lng != null) {
    return { latitude: lat, longitude: lng, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }
  if (cells.length) {
    const cLat = cells.reduce((s, c) => s + c.centerLat, 0) / cells.length;
    const cLng = cells.reduce((s, c) => s + c.centerLng, 0) / cells.length;
    return { latitude: cLat, longitude: cLng, latitudeDelta: 0.4, longitudeDelta: 0.4 };
  }
  return fallback;
}

function googleMapsApiKey(): string {
  const fromAndroid = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
  const fromIos = Constants.expoConfig?.ios?.config?.googleMapsApiKey;
  const fromExtra = (Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined)
    ?.googleMapsApiKey;
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  return String(fromAndroid || fromIos || fromExtra || fromEnv || "").trim();
}

export function googleMapsConfigured(): boolean {
  return Boolean(googleMapsApiKey());
}

/** @deprecated Use googleMapsConfigured() */
export function androidGoogleMapsConfigured(): boolean {
  return googleMapsConfigured();
}

/** Use Google Maps when an API key is configured; otherwise Apple Maps on iOS. */
export function mapViewProvider(): typeof PROVIDER_GOOGLE | undefined {
  return googleMapsConfigured() ? PROVIDER_GOOGLE : undefined;
}

/** Never load react-native-maps on Android unless a Google Maps API key is configured. */
export function shouldLoadNativeMapsModule(): boolean {
  if (Platform.OS === "ios") return true;
  return googleMapsConfigured();
}
