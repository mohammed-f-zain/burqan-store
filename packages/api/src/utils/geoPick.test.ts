import assert from "node:assert/strict";
import test from "node:test";

import { JORDAN_MAIN_AREAS } from "../data/jordanMainAreas.js";
import { pickFromCircles } from "./geoPick.js";
import type { AreaGeo } from "./geoResolve.js";

function asDbRows(): AreaGeo[] {
  return JORDAN_MAIN_AREAS.map((a, i) => ({
    id: i + 1,
    name: a.name,
    governorate: a.governorate,
    center_lat: a.centerLat,
    center_lng: a.centerLng,
    radius_km: a.radiusKm,
  }));
}

test("Tabarbour center resolves to طبربور not الهاشمي الشمالي", () => {
  const rows = asDbRows();
  const pick = pickFromCircles(32.003, 35.94, rows);
  assert.equal(pick.areaName, "طبربور");
  assert.equal(pick.insideMainNeighborhood, true);
});

test("Hashimi north center resolves to الهاشمي الشمالي", () => {
  const rows = asDbRows();
  const pick = pickFromCircles(31.985, 35.962, rows);
  assert.equal(pick.areaName, "الهاشمي الشمالي");
});
