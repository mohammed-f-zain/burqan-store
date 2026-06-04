import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { VoronoiFeatureCollection } from "../lib/voronoiGeo";

const JORDAN_CENTER: L.LatLngExpression = [31.9539, 35.9106];
const JORDAN_ZOOM = 8;

const NEIGHBORHOOD_STYLE = {
  color: "#0d9488",
  fillColor: "#14b8a6",
  fillOpacity: 0.2,
  weight: 1.5,
};

const GOVERNORATE_STYLE = {
  color: "#7c3aed",
  fillColor: "#a78bfa",
  fillOpacity: 0.12,
  weight: 1.5,
  dashArray: "4 3",
};

const HIGHLIGHT_STYLE = {
  weight: 3,
  fillOpacity: 0.32,
};

type Props = {
  voronoi: VoronoiFeatureCollection | null;
  highlightId?: number | null;
  onSelectArea?: (id: number) => void;
  emptyLabel: string;
};

export default function AreaCoverageMap({
  voronoi,
  highlightId,
  onSelectArea,
  emptyLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const voronoiLayerRef = useRef<L.GeoJSON | null>(null);
  const labelMarkersRef = useRef<L.Marker[]>([]);

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
      voronoiLayerRef.current = null;
      labelMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (voronoiLayerRef.current) {
      voronoiLayerRef.current.remove();
      voronoiLayerRef.current = null;
    }
    for (const m of labelMarkersRef.current) {
      m.remove();
    }
    labelMarkersRef.current = [];

    const features = voronoi?.features ?? [];
    if (!features.length) {
      map.setView(JORDAN_CENTER, JORDAN_ZOOM);
      return;
    }

    const bounds: L.LatLngExpression[] = [];

    const layer = L.geoJSON(voronoi as GeoJSON.FeatureCollection, {
      style: (feature) => {
        const p = feature?.properties as {
          isGovernorateCoverage?: boolean;
          areaId?: number;
        };
        const isGov = Boolean(p?.isGovernorateCoverage);
        const isHi = highlightId === Number(p?.areaId);
        const base = isGov ? GOVERNORATE_STYLE : NEIGHBORHOOD_STYLE;
        return { ...base, ...(isHi ? HIGHLIGHT_STYLE : {}) };
      },
      onEachFeature: (feature, l) => {
        const p = feature.properties as {
          areaId?: number;
          name?: string;
          governorate?: string | null;
          labelShort?: string;
          centerLat?: number;
          centerLng?: number;
          isGovernorateCoverage?: boolean;
        };
        const areaId = Number(p.areaId);
        const name = String(p.name ?? "");
        const gov = p.governorate ? ` · ${escapeHtml(String(p.governorate))}` : "";
        const kind = p.isGovernorateCoverage ? "فورونوي · محافظة" : "فورونوي · حي";
        l.bindPopup(`<strong>${escapeHtml(name)}</strong><br/>${kind}${gov}`);
        l.on("click", () => {
          if (Number.isFinite(areaId)) onSelectArea?.(areaId);
        });

        const label = String(p.labelShort ?? name);
        const clat = Number(p.centerLat);
        const clng = Number(p.centerLng);
        if (Number.isFinite(clat) && Number.isFinite(clng)) {
          const marker = L.marker([clat, clng], {
            icon: L.divIcon({
              className: "area-voronoi-label",
              html: `<span>${escapeHtml(label)}</span>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            }),
            interactive: false,
            keyboard: false,
          });
          marker.addTo(map);
          labelMarkersRef.current.push(marker);
          bounds.push([clat, clng]);
        }
      },
    });
    layer.addTo(map);
    voronoiLayerRef.current = layer;

    for (const f of features) {
      const ring = f.geometry.coordinates[0];
      if (ring?.[0]) bounds.push([ring[0][1], ring[0][0]]);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0]!, 13);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 14 });
    }
  }, [voronoi, highlightId, onSelectArea]);

  const isEmpty = !voronoi?.features?.length;

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
