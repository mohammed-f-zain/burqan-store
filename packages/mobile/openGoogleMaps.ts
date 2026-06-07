import { Linking, Platform } from "react-native";

export function parseGooglePlaceId(url: string | null | undefined): string | null {
  if (!url) return null;
  const q = url.match(/[?&]query_place_id=([^&]+)/);
  if (q?.[1]) return decodeURIComponent(q[1]);
  const legacy = url.match(/place_id:([^&]+)/);
  if (legacy?.[1]) return decodeURIComponent(legacy[1]);
  return null;
}

export function buildGoogleMapsUrl(opts: {
  lat: number;
  lng: number;
  name?: string;
  googleMapsUrl?: string | null;
  placeId?: string | null;
}): string {
  const placeId = opts.placeId ?? parseGooglePlaceId(opts.googleMapsUrl);
  if (placeId) {
    const label = opts.name?.trim() || `${opts.lat},${opts.lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}&query_place_id=${encodeURIComponent(placeId)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${opts.lat},${opts.lng}`;
}

/** Open store location in Google Maps (or device maps fallback). */
export async function openInGoogleMaps(opts: {
  lat: number;
  lng: number;
  name?: string;
  googleMapsUrl?: string | null;
  placeId?: string | null;
}): Promise<void> {
  const webUrl = buildGoogleMapsUrl(opts);
  const { lat, lng, name } = opts;

  try {
    await Linking.openURL(webUrl);
    return;
  } catch {
    /* try native schemes */
  }

  if (Platform.OS === "android") {
    const label = name?.trim() ? encodeURIComponent(name) : `${lat},${lng}`;
    const geo = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    try {
      await Linking.openURL(geo);
      return;
    } catch {
      /* fall through */
    }
  }

  if (Platform.OS === "ios") {
    const apple = `maps://?ll=${lat},${lng}&q=${encodeURIComponent(name?.trim() || "Store")}`;
    try {
      await Linking.openURL(apple);
      return;
    } catch {
      /* fall through */
    }
  }

  await Linking.openURL(webUrl);
}
