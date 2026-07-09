import { z } from "zod";

import { config } from "../config.js";
import { HttpError } from "./errors.js";
import { haversineMeters } from "./geoDistance.js";

import { resolveAreaIdForRep, resolveAreaIdFromAllAreas, resolveAreaForRepRoute, type ResolvedArea } from "./geoResolve.js";
export { resolveAreaIdForRep, resolveAreaIdFromAllAreas, resolveAreaForRepRoute, type ResolvedArea } from "./geoResolve.js";
export { haversineMeters } from "./geoDistance.js";

export const repLocationSchema = z.object({
  repLat: z.number().min(-90).max(90),
  repLng: z.number().min(-180).max(180),
});

export function formatMaxScanDistance(meters: number): string {
  if (meters >= 1000 && meters % 1000 === 0) return `${meters / 1000} كم`;
  return `${meters} متر`;
}

export function assertWithinScanDistance(
  repLat: number,
  repLng: number,
  storeLat: number,
  storeLng: number
): void {
  const d = haversineMeters(repLat, repLng, storeLat, storeLng);
  const max = config.scanMaxDistanceM;
  if (d > max) {
    throw new HttpError(
      403,
      `يجب أن تكون على بُعد أقل من ${formatMaxScanDistance(max)} من المتجر (أنت على بُعد ${Math.round(d)} م)`
    );
  }
}
