import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { JORDAN_BBOX } from "../data/jordanBounds.js";
import { buildVoronoiGeoJson, pickFromVoronoi, pickVoronoiSiteIndex } from "./jordanVoronoi.js";
import type { AreaGeo } from "./geoResolve.js";

describe("jordanVoronoi", () => {
  const sampleRows: AreaGeo[] = [
    {
      id: 1,
      name: "وسط عمان",
      governorate: "عمان",
      center_lat: 31.954,
      center_lng: 35.911,
      radius_km: 2.5,
    },
    {
      id: 2,
      name: "إربد — تغطية المحافظة",
      governorate: "إربد",
      center_lat: 32.556,
      center_lng: 35.85,
      radius_km: 22,
    },
    {
      id: 3,
      name: "وسط إربد",
      governorate: "إربد",
      center_lat: 32.555,
      center_lng: 35.849,
      radius_km: 3.5,
    },
  ];

  it("builds a polygon per site inside Jordan bbox", () => {
    const sites = sampleRows.map((r) => ({
      areaId: r.id,
      name: r.name,
      governorate: r.governorate,
      lng: r.center_lng!,
      lat: r.center_lat!,
    }));
    const fc = buildVoronoiGeoJson(sites);
    assert.equal(fc.features.length, 3);
    for (const f of fc.features) {
      assert.equal(f.geometry.type, "Polygon");
      assert.ok(f.geometry.coordinates[0]!.length >= 4);
    }
  });

  it("assigns Amman center to Amman site via Voronoi", () => {
    const pick = pickFromVoronoi(31.954, 35.911, sampleRows);
    assert.ok(pick);
    assert.equal(pick!.areaId, 1);
    assert.equal(pick!.insideMainNeighborhood, true);
  });

  it("covers point in Jordan bbox with some area", () => {
    const midLat = (JORDAN_BBOX.minLat + JORDAN_BBOX.maxLat) / 2;
    const midLng = (JORDAN_BBOX.minLng + JORDAN_BBOX.maxLng) / 2;
    const idx = pickVoronoiSiteIndex(midLat, midLng, sampleRows.map((r) => ({
      areaId: r.id,
      name: r.name,
      governorate: r.governorate,
      lng: r.center_lng!,
      lat: r.center_lat!,
    })));
    assert.ok(idx !== null);
  });
});
