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

function isExpoGoClient(): boolean {
  return Constants.appOwnership === "expo";
}

/**
 * Google Maps in a custom Android APK needs the EAS/Play keystore SHA-1 in Google Cloud.
 * Without it, MapView can crash the whole app natively. Expo Go uses its own maps shell.
 */
export function shouldLoadNativeMapsModule(): boolean {
  if (Platform.OS === "ios") return true;
  if (!androidGoogleMapsConfigured()) return false;
  if (isExpoGoClient()) return true;
  return process.env.EXPO_PUBLIC_ANDROID_RELEASE_MAPS === "1";
}
