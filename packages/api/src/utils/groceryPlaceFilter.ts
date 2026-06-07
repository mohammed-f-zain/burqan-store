import type { GoogleNearbyPlace } from "./googlePlaces.js";

/** Google place types we always keep (strict supermarket / grocery searches). */
export const STRICT_GROCERY_TYPES = new Set([
  "grocery_or_supermarket",
  "supermarket",
  "convenience_store",
]);

/** Broader types that need name/type filtering. */
export const BROAD_RETAIL_TYPES = new Set([
  "food",
  "bakery",
  "liquor_store",
  "store",
  "home_goods_store",
  "department_store",
]);

const EXCLUDE_TYPES = new Set([
  "restaurant",
  "cafe",
  "bar",
  "night_club",
  "meal_takeaway",
  "meal_delivery",
  "gas_station",
  "pharmacy",
  "hospital",
  "school",
  "university",
  "bank",
  "atm",
  "mosque",
  "church",
  "lodging",
  "gym",
  "spa",
  "beauty_salon",
  "hair_care",
  "car_repair",
  "car_wash",
  "parking",
  "transit_station",
  "place_of_worship",
  "local_government_office",
  "police",
  "fire_station",
]);

const NAME_HINTS =
  /بقال|سوبر|ماركت|سوق|ميني\s*ماركت|هايبر|market|grocery|mini\s*mark|super\s*mark|hyper\s*mark|food\s*mart/i;

/** Keep groceries, mini-markets, and local markets; drop restaurants and unrelated POIs. */
export function isGroceryOrMarketPlace(place: GoogleNearbyPlace): boolean {
  const types = place.types ?? [];
  const name = place.name.trim();

  if (types.some((t) => STRICT_GROCERY_TYPES.has(t))) return true;
  if (NAME_HINTS.test(name)) return true;

  const hasGroceryType = types.some(
    (t) => STRICT_GROCERY_TYPES.has(t) || BROAD_RETAIL_TYPES.has(t)
  );
  const onlyExcluded =
    types.length > 0 && types.every((t) => EXCLUDE_TYPES.has(t) || t === "point_of_interest" || t === "establishment");

  if (onlyExcluded) return false;
  if (types.some((t) => EXCLUDE_TYPES.has(t)) && !hasGroceryType && !NAME_HINTS.test(name)) {
    return false;
  }
  if (hasGroceryType) return true;

  return false;
}
