import type { JordanAreaSeed } from "./jordanDetailedAreas.js";
import { DENSE_URBAN_RADIUS_KM } from "./jordanAreaConstants.js";

const KM_PER_DEG_LAT = 111.32;

/** Urban cores where named neighborhoods do not fully tile — fill with micro Voronoi cells. */
const URBAN_MICRO_ZONES: {
  governorate: string;
  centerLat: number;
  centerLng: number;
  extentKm: number;
  stepKm: number;
}[] = [
  { governorate: "عمان", centerLat: 31.954, centerLng: 35.911, extentKm: 14, stepKm: 1.45 },
  { governorate: "الزرقاء", centerLat: 32.0728, centerLng: 36.0876, extentKm: 9, stepKm: 1.55 },
  { governorate: "إربد", centerLat: 32.5556, centerLng: 35.85, extentKm: 8, stepKm: 1.55 },
  { governorate: "البلقاء", centerLat: 32.0367, centerLng: 35.7278, extentKm: 7, stepKm: 1.9 },
  { governorate: "مادبا", centerLat: 31.716, centerLng: 35.7939, extentKm: 6, stepKm: 1.9 },
  { governorate: "المفرق", centerLat: 32.3424, centerLng: 36.208, extentKm: 7, stepKm: 2.1 },
  { governorate: "العقبة", centerLat: 29.532, centerLng: 35.0063, extentKm: 6, stepKm: 1.9 },
  { governorate: "الكرك", centerLat: 31.1853, centerLng: 35.7048, extentKm: 6, stepKm: 2.1 },
  { governorate: "معان", centerLat: 30.1962, centerLng: 35.7341, extentKm: 7, stepKm: 2.2 },
  { governorate: "الطفيلة", centerLat: 30.8375, centerLng: 35.6167, extentKm: 5, stepKm: 2.0 },
  { governorate: "جرش", centerLat: 32.2722, centerLng: 35.8993, extentKm: 5, stepKm: 2.0 },
  { governorate: "عجلون", centerLat: 32.3326, centerLng: 35.7517, extentKm: 5, stepKm: 2.0 },
];

export const JORDAN_MICRO_REGION_SUFFIX = " — منطقة ";

function offsetKm(lat: number, lng: number, northKm: number, eastKm: number) {
  const centerLat = lat + northKm / KM_PER_DEG_LAT;
  const centerLng = lng + eastKm / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return { centerLat, centerLng };
}

function distKm(a: JordanAreaSeed, lat: number, lng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat - a.centerLat);
  const dLng = toRad(lng - a.centerLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.centerLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Fine grid seeds only where no named neighborhood is within `minDistFromNamedKm`.
 * Included in Voronoi (unlike legacy "شبكة" rows).
 */
export function buildUrbanMicroGridSeeds(
  namedSeeds: JordanAreaSeed[],
  minDistFromNamedKm = 1.05
): JordanAreaSeed[] {
  const out: JordanAreaSeed[] = [];
  const counters = new Map<string, number>();

  for (const zone of URBAN_MICRO_ZONES) {
    const maxSteps = Math.ceil(zone.extentKm / zone.stepKm);
    for (let i = -maxSteps; i <= maxSteps; i++) {
      for (let j = -maxSteps; j <= maxSteps; j++) {
        const north = i * zone.stepKm;
        const east = j * zone.stepKm;
        if (north * north + east * east > zone.extentKm * zone.extentKm) continue;

        const { centerLat, centerLng } = offsetKm(zone.centerLat, zone.centerLng, north, east);
        const tooClose = namedSeeds.some((s) => distKm(s, centerLat, centerLng) < minDistFromNamedKm);
        if (tooClose) continue;

        const n = (counters.get(zone.governorate) ?? 0) + 1;
        counters.set(zone.governorate, n);
        out.push({
          name: `${zone.governorate}${JORDAN_MICRO_REGION_SUFFIX}${String(n).padStart(3, "0")}`,
          governorate: zone.governorate,
          centerLat,
          centerLng,
          radiusKm: DENSE_URBAN_RADIUS_KM,
        });
      }
    }
  }

  return out;
}
