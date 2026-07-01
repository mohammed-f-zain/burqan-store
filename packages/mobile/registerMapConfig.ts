import Constants from "expo-constants";
import { Platform } from "react-native";

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type { VoronoiMapCell as JordanAreaMap } from "./voronoiMapGeo";

export function androidGoogleMapsConfigured(): boolean {
  const fromExpo = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
  const fromExtra = (Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined)
    ?.googleMapsApiKey;
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  return Boolean(String(fromExpo || fromExtra || fromEnv || "").trim());
}

/** Never load react-native-maps on Android unless a Google Maps API key is configured. */
export function shouldLoadNativeMapsModule(): boolean {
  if (Platform.OS === "ios") return true;
  return androidGoogleMapsConfigured();
}
