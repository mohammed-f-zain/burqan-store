import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { MapAreaCircle } from "../lib/areaMapGeo";
import type { VoronoiFeatureCollection } from "../lib/voronoiGeo";

const JORDAN_CENTER: L.LatLngExpression = [31.9539, 35.9106];
const JORDAN_ZOOM = 8;

const NEIGHBORHOOD_STYLE = {
  color: "#1d6fd4",
  fillColor: "#3b8eed",
  fillOpacity: 0.14,
  weight: 1.5,
};

const GOVERNORATE_STYLE = {
  color: "#b45309",
  fillColor: "#f59e0b",
  fillOpacity: 0.08,
  weight: 2,
  dashArray: "6 4",
};

const VORONOI_NEIGHBORHOOD_STYLE = {
  color: "#0d9488",
  fillColor: "#14b8a6",
  fillOpacity: 0.2,
  weight: 1.5,
};

const VORONOI_GOV_STYLE = {
  color: "#7c3aed",
  fillColor: "#a78bfa",
  fillOpacity: 0.12,
  weight: 1.5,
  dashArray: "4 3",
};

const HIGHLIGHT_STYLE = {
  weight: 3,
  fillOpacity: 0.28,
};

const GOVERNORATE_COVERAGE_SUFFIX = " — تغطية المحافظة";

type Props = {
  areas: MapAreaCircle[];
  voronoi?: VoronoiFeatureCollection | null;
  mapMode: "circles" | "voronoi" | "both";
  highlightId?: number | null;
  onSelectArea?: (id: number) => void;
  emptyLabel: string;
};

export default function AreaCoverageMap({
  areas,
  voronoi,
  mapMode,
  highlightId,
  onSelectArea,
  emptyLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleByIdRef = useRef<Map<number, L.Circle>>(new Map());
  const voronoiLayerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView(JORDAN_CENTER, JORDAN_ZOOM);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      circleByIdRef.current.clear();
      voronoiLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const layer of circleByIdRef.current.values()) {
      layer.remove();
    }
    circleByIdRef.current.clear();

    if (voronoiLayerRef.current) {
      voronoiLayerRef.current.remove();
      voronoiLayerRef.current = null;
    }

    const bounds: L.LatLngExpression[] = [];
    const showCircles = mapMode === "circles" || mapMode === "both";
    const showVoronoi = (mapMode === "voronoi" || mapMode === "both") && voronoi?.features?.length;

    if (showCircles) {
      for (const a of areas) {
        const baseStyle = a.isGovernorateCoverage ? GOVERNORATE_STYLE : NEIGHBORHOOD_STYLE;
        const isHi = highlightId === a.id;
        const circle = L.circle([a.centerLat, a.centerLng], {
          radius: a.radiusKm * 1000,
          ...baseStyle,
          ...(isHi ? HIGHLIGHT_STYLE : {}),
        });
        const govLine = a.governorate ? ` · ${escapeHtml(a.governorate)}` : "";
        const kind = a.isGovernorateCoverage ? "تغطية محافظة" : "حي";
        circle.bindPopup(
          `<strong>${escapeHtml(a.name)}</strong><br/>${kind}${govLine}<br/>نصف القطر: ${a.radiusKm} km`
        );
        circle.on("click", () => onSelectArea?.(a.id));
        circle.addTo(map);
        circleByIdRef.current.set(a.id, circle);
        bounds.push([a.centerLat, a.centerLng]);
      }
    }

    if (showVoronoi && voronoi) {
      const layer = L.geoJSON(voronoi as GeoJSON.FeatureCollection, {
        style: (feature) => {
          const name = String(feature?.properties?.name ?? "");
          const areaId = Number(feature?.properties?.areaId);
          const isGov = name.endsWith(GOVERNORATE_COVERAGE_SUFFIX);
          const isHi = highlightId === areaId;
          const base = isGov ? VORONOI_GOV_STYLE : VORONOI_NEIGHBORHOOD_STYLE;
          return { ...base, ...(isHi ? HIGHLIGHT_STYLE : {}) };
        },
        onEachFeature: (feature, l) => {
          const p = feature.properties as { areaId?: number; name?: string; governorate?: string | null };
          const areaId = Number(p.areaId);
          const name = String(p.name ?? "");
          const gov = p.governorate ? ` · ${escapeHtml(String(p.governorate))}` : "";
          const kind = name.endsWith(GOVERNORATE_COVERAGE_SUFFIX) ? "فورونوي · محافظة" : "فورونوي · حي";
          l.bindPopup(`<strong>${escapeHtml(name)}</strong><br/>${kind}${gov}`);
          l.on("click", () => {
            if (Number.isFinite(areaId)) onSelectArea?.(areaId);
          });
        },
      });
      layer.addTo(map);
      voronoiLayerRef.current = layer;
      for (const f of voronoi.features) {
        const ring = f.geometry.coordinates[0];
        if (ring?.[0]) bounds.push([ring[0][1], ring[0][0]]);
      }
    }

    if (bounds.length === 1) {
      map.setView(bounds[0]!, 13);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 14 });
    } else {
      map.setView(JORDAN_CENTER, JORDAN_ZOOM);
    }
  }, [areas, voronoi, mapMode, highlightId, onSelectArea]);

  const isEmpty =
    (mapMode === "voronoi" && !voronoi?.features?.length) ||
    (mapMode === "circles" && areas.length === 0) ||
    (mapMode === "both" && areas.length === 0 && !voronoi?.features?.length);

  return (
    <div className="area-coverage-map-wrap">
      {isEmpty ? <p className="muted small area-coverage-map-empty">{emptyLabel}</p> : null}
      <div ref={containerRef} className="area-coverage-map" role="application" aria-label="Area coverage map" />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
