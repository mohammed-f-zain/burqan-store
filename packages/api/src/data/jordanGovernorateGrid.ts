import { GRID_STEP_KM, MAX_DETAILED_AREA_RADIUS_KM } from "./jordanAreaConstants.js";
import type { JordanAreaSeed } from "./jordanDetailedAreas.js";
import { JORDAN_GOVERNORATES } from "./jordanGovernorates.js";

/** Urban radius (km) for 1 km grid per governorate (avoids huge desert grids). */
const GRID_EXTENT_KM: Record<string, number> = {
  عمان: 15,
  إربد: 10,
  الزرقاء: 9,
  المفرق: 8,
  العقبة: 7,
  الكرك: 8,
  معان: 9,
  الطفيلة: 6,
  مادبا: 7,
  جرش: 6,
  عجلون: 6,
  البلقاء: 8,
};

const KM_PER_DEG_LAT = 111.32;

function offsetKm(lat: number, lng: number, northKm: number, eastKm: number) {
  const centerLat = lat + northKm / KM_PER_DEG_LAT;
  const centerLng = lng + eastKm / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return { centerLat, centerLng };
}

/** 1 km cells covering each governorate's main urban zone. */
export function buildGovernorateGridAreas(): JordanAreaSeed[] {
  const out: JordanAreaSeed[] = [];
  for (const g of JORDAN_GOVERNORATES) {
    const extent = GRID_EXTENT_KM[g.name] ?? 6;
    const step = GRID_STEP_KM;
    const maxSteps = Math.ceil(extent / step);
    let n = 0;
    for (let i = -maxSteps; i <= maxSteps; i++) {
      for (let j = -maxSteps; j <= maxSteps; j++) {
        const north = i * step;
        const east = j * step;
        if (north * north + east * east > extent * extent) continue;
        n++;
        const { centerLat, centerLng } = offsetKm(g.centerLat, g.centerLng, north, east);
        out.push({
          name: `${g.name} — شبكة ${String(n).padStart(3, "0")}`,
          governorate: g.name,
          centerLat,
          centerLng,
          radiusKm: MAX_DETAILED_AREA_RADIUS_KM,
        });
      }
    }
  }
  return out;
}
