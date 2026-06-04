import { query } from "../db/pool.js";
import { EXCLUDE_GRID_AREA_SQL, GOVERNORATE_COVERAGE_ACTIVE_SQL } from "./areaQuery.js";
import type { AreaGeo } from "./geoResolve.js";

export async function loadVoronoiAreaRows(): Promise<AreaGeo[]> {
  const { rows } = await query<AreaGeo>(
    `SELECT id, name, map_label, governorate, center_lat, center_lng, radius_km
     FROM areas
     WHERE center_lat IS NOT NULL AND center_lng IS NOT NULL
       AND ${EXCLUDE_GRID_AREA_SQL}
       AND ${GOVERNORATE_COVERAGE_ACTIVE_SQL}
     ORDER BY governorate NULLS LAST, name ASC`
  );
  return rows;
}
