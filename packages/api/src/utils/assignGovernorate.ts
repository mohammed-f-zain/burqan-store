import { JORDAN_GOVERNORATES } from "../data/jordanGovernorates.js";

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Assign Arabic governorate from coordinates (nearest governorate center). */
export function governorateForCoordinates(lat: number, lng: number): string {
  let best: string = JORDAN_GOVERNORATES[0]!.name;
  let min = Infinity;
  for (const g of JORDAN_GOVERNORATES) {
    const d = distKm(lat, lng, g.centerLat, g.centerLng);
    if (d < min) {
      min = d;
      best = g.name;
    }
  }
  return best;
}
