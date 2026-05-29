import { config } from "../config.js";

export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type GoogleGeocodeResult = {
  formatted_address: string;
  place_id: string;
  address_components: GoogleAddressComponent[];
};

type GeocodeResponse = {
  status: string;
  error_message?: string;
  results?: GoogleGeocodeResult[];
};

const JORDAN_REGION = "jo";
const GEOCODE_LANG = "ar";

export function isGoogleGeocodeEnabled(): boolean {
  return Boolean(config.googleMapsApiKey?.trim());
}

/** Reverse geocode GPS → Google place names (Arabic preferred). */
export async function reverseGeocode(lat: number, lng: number): Promise<GoogleGeocodeResult | null> {
  const key = config.googleMapsApiKey?.trim();
  if (!key) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", key);
  url.searchParams.set("language", GEOCODE_LANG);
  url.searchParams.set("region", JORDAN_REGION);

  const res = await fetch(url.toString());
  const data = (await res.json()) as GeocodeResponse;
  if (data.status !== "OK" || !data.results?.[0]) {
    if (data.status !== "ZERO_RESULTS") {
      // eslint-disable-next-line no-console
      console.warn("[googleGeocode] reverse failed:", data.status, data.error_message ?? "");
    }
    return null;
  }
  return data.results[0];
}

/** Forward geocode area name → coordinates (for seed refresh). */
export async function forwardGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = config.googleMapsApiKey?.trim();
  if (!key) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", key);
  url.searchParams.set("language", GEOCODE_LANG);
  url.searchParams.set("region", JORDAN_REGION);

  const res = await fetch(url.toString());
  const data = (await res.json()) as GeocodeResponse;
  if (data.status !== "OK" || !data.results?.[0]) return null;

  const loc = (data.results[0] as GoogleGeocodeResult & { geometry?: { location: { lat: number; lng: number } } })
    .geometry?.location;
  if (!loc) return null;
  return { lat: loc.lat, lng: loc.lng };
}

/** Collect human-readable place labels from a geocode result (most specific first). */
export function labelsFromGeocode(result: GoogleGeocodeResult): string[] {
  const out: string[] = [];
  const typeOrder = [
    "neighborhood",
    "sublocality",
    "sublocality_level_1",
    "locality",
    "administrative_area_level_2",
    "administrative_area_level_1",
  ];

  for (const type of typeOrder) {
    const comp = result.address_components.find((c) => c.types.includes(type));
    if (comp?.long_name) out.push(comp.long_name);
  }

  if (result.formatted_address) out.push(result.formatted_address);
  return [...new Set(out)];
}

export function governorateLabelFromGeocode(result: GoogleGeocodeResult): string | null {
  const comp = result.address_components.find((c) => c.types.includes("administrative_area_level_1"));
  return comp?.long_name ?? null;
}
