import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { MapAreaCircle } from "../lib/areaMapGeo";

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

const HIGHLIGHT_STYLE = {
  weight: 3,
  fillOpacity: 0.22,
};

type Props = {
  areas: MapAreaCircle[];
  highlightId?: number | null;
  onSelectArea?: (id: number) => void;
  emptyLabel: string;
};

export default function AreaCoverageMap({ areas, highlightId, onSelectArea, emptyLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerByIdRef = useRef<Map<number, L.Circle>>(new Map());

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
      layerByIdRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const layer of layerByIdRef.current.values()) {
      layer.remove();
    }
    layerByIdRef.current.clear();

    const bounds: L.LatLngExpression[] = [];

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
      layerByIdRef.current.set(a.id, circle);
      bounds.push([a.centerLat, a.centerLng]);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0]!, 13);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 14 });
    } else {
      map.setView(JORDAN_CENTER, JORDAN_ZOOM);
    }
  }, [areas, highlightId, onSelectArea]);

  return (
    <div className="area-coverage-map-wrap">
      {areas.length === 0 ? <p className="muted small area-coverage-map-empty">{emptyLabel}</p> : null}
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
