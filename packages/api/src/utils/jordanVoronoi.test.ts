import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { JORDAN_BBOX } from "../data/jordanBounds.js";
import {
  areaRowsToVoronoiSites,
  buildVoronoiGeoJson,
  pickFromVoronoi,
  pickVoronoiSiteIndex,
} from "./jordanVoronoi.js";
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
    const fc = buildVoronoiGeoJson(areaRowsToVoronoiSites(sampleRows));
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
    const idx = pickVoronoiSiteIndex(midLat, midLng, areaRowsToVoronoiSites(sampleRows));
    assert.ok(idx !== null);
  });

  it("full site set can assign differently than a nearby subset (Ajloun-like)", () => {
    // Zone cell: وسط عجلون. Nearby-only set omits it and steals the point.
    const ajloun: AreaGeo = {
      id: 10,
      name: "وسط عجلون",
      governorate: "عجلون",
      center_lat: 32.3326,
      center_lng: 35.7517,
      radius_km: 3,
    };
    const anjara: AreaGeo = {
      id: 11,
      name: "عنجرة",
      governorate: "عجلون",
      center_lat: 32.408,
      center_lng: 35.768,
      radius_km: 3.5,
    };
    const irbidFar: AreaGeo = {
      id: 20,
      name: "وسط إربد",
      governorate: "إربد",
      center_lat: 32.555,
      center_lng: 35.849,
      radius_km: 3.5,
    };
    const amman: AreaGeo = {
      id: 30,
      name: "وسط عمان",
      governorate: "عمان",
      center_lat: 31.954,
      center_lng: 35.911,
      radius_km: 2.5,
    };

    const lat = 32.31;
    const lng = 35.74;
    const full = pickFromVoronoi(lat, lng, [ajloun, anjara, irbidFar, amman]);
    const nearbyOnly = pickFromVoronoi(lat, lng, [anjara, irbidFar]);

    assert.ok(full);
    assert.equal(full!.areaId, 10);
    assert.ok(nearbyOnly);
    assert.notEqual(nearbyOnly!.areaId, 10);
  });
});
