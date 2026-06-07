import { JORDAN_GOVERNORATES } from "../data/jordanGovernorates.js";
import { query } from "../db/pool.js";
import { resolveAreaIdFromVoronoi } from "./resolveAreaIdFromVoronoi.js";
import { GoogleNearbyPlace, isGooglePlacesEnabled, nearbyPlacesSearch } from "./googlePlaces.js";

const KM_PER_DEG_LAT = 111.32;
const SEARCH_TYPES = ["grocery_or_supermarket", "supermarket", "convenience_store"] as const;
const MATCH_STORE_METERS = 85;

const GOV_EXTENT_KM: Record<string, number> = {
  عمان: 14,
  إربد: 8,
  الزرقاء: 9,
  المفرق: 7,
  العقبة: 6,
  الكرك: 6,
  معان: 7,
  الطفيلة: 5,
  مادبا: 6,
  جرش: 5,
  عجلون: 5,
  البلقاء: 7,
};

function offsetKm(lat: number, lng: number, northKm: number, eastKm: number) {
  return {
    lat: lat + northKm / KM_PER_DEG_LAT,
    lng: lng + eastKm / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)),
  };
}

function gridCenters(governorate: string, stepKm: number): { lat: number; lng: number }[] {
  const g = JORDAN_GOVERNORATES.find((x) => x.name === governorate);
  if (!g) return [];
  const extent = GOV_EXTENT_KM[governorate] ?? 6;
  const maxSteps = Math.ceil(extent / stepKm);
  const out: { lat: number; lng: number }[] = [];
  for (let i = -maxSteps; i <= maxSteps; i++) {
    for (let j = -maxSteps; j <= maxSteps; j++) {
      const north = i * stepKm;
      const east = j * stepKm;
      if (north * north + east * east > extent * extent) continue;
      out.push(offsetKm(g.centerLat, g.centerLng, north, east));
    }
  }
  return out;
}

async function findMatchedStoreId(lat: number, lng: number): Promise<number | null> {
  const { rows } = await query<{ id: number }>(
    `SELECT id FROM stores
     WHERE (
       6371000 * acos(
         LEAST(1, GREATEST(-1,
           cos(radians($1)) * cos(radians(location_lat)) *
           cos(radians(location_lng) - radians($2)) +
           sin(radians($1)) * sin(radians(location_lat))
         ))
       )
     ) <= $3
     ORDER BY id ASC
     LIMIT 1`,
    [lat, lng, MATCH_STORE_METERS]
  );
  return rows[0]?.id ?? null;
}

async function upsertPlace(place: GoogleNearbyPlace): Promise<boolean> {
  const resolved = await resolveAreaIdFromVoronoi(place.lat, place.lng);
  const matchedStoreId = await findMatchedStoreId(place.lat, place.lng);

  await query(
    `INSERT INTO google_map_places (
       place_id, name, address_text, location_lat, location_lng, area_id,
       google_maps_url, types, business_status, matched_store_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
     ON CONFLICT (place_id) DO UPDATE SET
       name = EXCLUDED.name,
       address_text = EXCLUDED.address_text,
       location_lat = EXCLUDED.location_lat,
       location_lng = EXCLUDED.location_lng,
       area_id = EXCLUDED.area_id,
       google_maps_url = EXCLUDED.google_maps_url,
       types = EXCLUDED.types,
       business_status = EXCLUDED.business_status,
       matched_store_id = EXCLUDED.matched_store_id,
       imported_at = now()`,
    [
      place.placeId,
      place.name,
      place.addressText,
      place.lat,
      place.lng,
      resolved.areaId,
      place.mapsUrl,
      JSON.stringify(place.types),
      place.businessStatus,
      matchedStoreId,
    ]
  );
  return matchedStoreId != null;
}

export type ImportGooglePlacesOptions = {
  governorate?: string;
  lat?: number;
  lng?: number;
  radiusM?: number;
  gridStepKm?: number;
};

export type ImportGooglePlacesResult = {
  searchedPoints: number;
  fetched: number;
  upserted: number;
  matchedBurqanStores: number;
};

export async function importGooglePlaces(
  opts: ImportGooglePlacesOptions
): Promise<ImportGooglePlacesResult> {
  if (!isGooglePlacesEnabled()) {
    throw new Error("GOOGLE_MAPS_API_KEY غير مضبوط — فعّل Places API على نفس المفتاح");
  }

  const radiusM = opts.radiusM ?? 1400;
  const gridStepKm = opts.gridStepKm ?? 2.2;
  const centers: { lat: number; lng: number }[] = [];

  if (opts.lat != null && opts.lng != null) {
    centers.push({ lat: opts.lat, lng: opts.lng });
  } else if (opts.governorate) {
    centers.push(...gridCenters(opts.governorate, gridStepKm));
  } else {
    for (const g of JORDAN_GOVERNORATES) {
      centers.push(...gridCenters(g.name, gridStepKm));
    }
  }

  const byPlaceId = new Map<string, GoogleNearbyPlace>();
  for (const c of centers) {
    for (const type of SEARCH_TYPES) {
      const batch = await nearbyPlacesSearch(c.lat, c.lng, radiusM, type);
      for (const p of batch) byPlaceId.set(p.placeId, p);
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  let upserted = 0;
  let matchedBurqanStores = 0;
  for (const place of byPlaceId.values()) {
    if (await upsertPlace(place)) matchedBurqanStores++;
    upserted++;
  }

  return {
    searchedPoints: centers.length,
    fetched: byPlaceId.size,
    upserted,
    matchedBurqanStores,
  };
}
