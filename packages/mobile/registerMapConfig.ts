import Constants from "expo-constants";
import { Platform } from "react-native";

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type JordanAreaMap = {
  id: number;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

export function androidGoogleMapsConfigured(): boolean {
  const fromExpo = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  return Boolean(String(fromExpo || fromEnv || "").trim());
}

/** Never load react-native-maps on Android unless a Google Maps API key is configured. */
export function shouldLoadNativeMapsModule(): boolean {
  if (Platform.OS === "ios") return true;
  return androidGoogleMapsConfigured();
}
