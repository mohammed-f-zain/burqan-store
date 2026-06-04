const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "BurqanStore/1.0 (area-map-labels; contact: admin@burqan.store)";

export type NominatimAddress = {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  town?: string;
  village?: string;
  city?: string;
  state?: string;
};

/** Reverse geocode → Arabic place name (OSM / map labels). Respects 1 req/s policy — sleep in scripts. */
export async function reverseNominatimLabel(
  lat: number,
  lng: number
): Promise<{ label: string; state: string | null } | null> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("accept-language", "ar");
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { address?: NominatimAddress };
  const addr = data.address;
  if (!addr) return null;

  const label =
    addr.neighbourhood ??
    addr.suburb ??
    addr.quarter ??
    addr.city_district ??
    addr.town ??
    addr.village ??
    null;

  if (!label?.trim()) return null;

  return { label: label.trim(), state: addr.state?.trim() ?? null };
}
