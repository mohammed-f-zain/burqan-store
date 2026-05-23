import { z } from "zod";

import { query } from "../db/pool.js";
import { config } from "../config.js";
import { HttpError } from "./errors.js";

export const repLocationSchema = z.object({
  repLat: z.number().min(-90).max(90),
  repLng: z.number().min(-180).max(180),
});

/** Great-circle distance in meters. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
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
      `يجب أن تكون على بُعد أقل من ${max} متر من المتجر (أنت على بُعد ${Math.round(d)} م)`
    );
  }
}

type AreaGeo = {
  id: number;
  name: string;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: string | number;
};

/** Pick best area among rep assignments for a GPS point (nearest center within radius, else nearest). */
export async function resolveAreaIdForRep(
  lat: number,
  lng: number,
  repAreaIds: number[]
): Promise<{ areaId: number; areaName: string }> {
  if (!repAreaIds.length) throw new HttpError(403, "لا مناطق مخصصة لك");

  const { rows } = await query<AreaGeo>(
    `SELECT id, name, center_lat, center_lng, radius_km FROM areas WHERE id = ANY($1::int[])`,
    [repAreaIds]
  );
  if (!rows.length) throw new HttpError(403, "لا مناطق مخصصة لك");

  const withCenter = rows.filter((a) => a.center_lat != null && a.center_lng != null);
  if (!withCenter.length) {
    const fallback = rows[0]!;
    return { areaId: fallback.id, areaName: fallback.name };
  }

  const scored = withCenter.map((a) => {
    const distM = haversineMeters(lat, lng, a.center_lat!, a.center_lng!);
    const radiusM = parseFloat(String(a.radius_km)) * 1000;
    return { area: a, distM, inside: distM <= radiusM };
  });

  const inside = scored.filter((s) => s.inside).sort((a, b) => a.distM - b.distM);
  if (inside[0]) {
    return { areaId: inside[0].area.id, areaName: inside[0].area.name };
  }

  scored.sort((a, b) => a.distM - b.distM);
  const nearest = scored[0]!;
  return { areaId: nearest.area.id, areaName: nearest.area.name };
}

/** Pick governorate from all Jordan areas in DB (store registration). */
export async function resolveAreaIdFromAllAreas(
  lat: number,
  lng: number
): Promise<{ areaId: number; areaName: string }> {
  const { rows } = await query<AreaGeo>(
    `SELECT id, name, center_lat, center_lng, radius_km
     FROM areas
     WHERE center_lat IS NOT NULL AND center_lng IS NOT NULL
     ORDER BY id ASC`
  );
  if (!rows.length) throw new HttpError(500, "لم تُعرَّف مناطق الأردن على الخادم");

  const scored = rows.map((a) => {
    const distM = haversineMeters(lat, lng, a.center_lat!, a.center_lng!);
    const radiusM = parseFloat(String(a.radius_km)) * 1000;
    return { area: a, distM, inside: distM <= radiusM };
  });

  const inside = scored.filter((s) => s.inside).sort((a, b) => a.distM - b.distM);
  if (inside[0]) {
    return { areaId: inside[0].area.id, areaName: inside[0].area.name };
  }

  scored.sort((a, b) => a.distM - b.distM);
  const nearest = scored[0]!;
  return { areaId: nearest.area.id, areaName: nearest.area.name };
}
