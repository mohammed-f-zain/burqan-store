import { config } from "../config.js";

export type GoogleNearbyPlace = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  addressText: string | null;
  types: string[];
  businessStatus: string | null;
  mapsUrl: string;
};

type NearbyResponse = {
  status: string;
  error_message?: string;
  results?: {
    place_id: string;
    name: string;
    geometry?: { location?: { lat: number; lng: number } };
    vicinity?: string;
    formatted_address?: string;
    types?: string[];
    business_status?: string;
  }[];
  next_page_token?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isGooglePlacesEnabled(): boolean {
  return Boolean(config.googleMapsApiKey?.trim());
}

/** Nearby Search (legacy Places API) — requires Places API on the same key as Geocoding. */
export async function nearbyPlacesSearch(
  lat: number,
  lng: number,
  radiusM: number,
  type: string
): Promise<GoogleNearbyPlace[]> {
  const key = config.googleMapsApiKey?.trim();
  if (!key) return [];

  const out: GoogleNearbyPlace[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 3; page++) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", String(Math.min(50000, Math.max(100, radiusM))));
    url.searchParams.set("type", type);
    url.searchParams.set("language", "ar");
    url.searchParams.set("key", key);
    if (pageToken) url.searchParams.set("pagetoken", pageToken);

    const res = await fetch(url.toString());
    const data = (await res.json()) as NearbyResponse;
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      // eslint-disable-next-line no-console
      console.warn("[googlePlaces] nearby failed:", data.status, data.error_message ?? "");
      break;
    }

    for (const r of data.results ?? []) {
      const la = r.geometry?.location?.lat;
      const lo = r.geometry?.location?.lng;
      if (la == null || lo == null || !r.place_id || !r.name) continue;
      out.push({
        placeId: r.place_id,
        name: r.name,
        lat: la,
        lng: lo,
        addressText: r.vicinity ?? r.formatted_address ?? null,
        types: r.types ?? [],
        businessStatus: r.business_status ?? null,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${encodeURIComponent(r.place_id)}`,
      });
    }

    pageToken = data.next_page_token;
    if (!pageToken) break;
    await sleep(2200);
  }

  return out;
}
