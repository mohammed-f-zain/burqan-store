import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { VoronoiFeatureCollection } from "../lib/voronoiGeo";

const JORDAN_CENTER: L.LatLngExpression = [31.9539, 35.9106];
const JORDAN_ZOOM = 8;
const LABEL_ZOOM_GOV = 8;
const LABEL_ZOOM_NEIGHBORHOOD = 10;
const LABEL_ZOOM_MICRO = 13;

const NEIGHBORHOOD_STYLE = {
  color: "#0d9488",
  fillColor: "#14b8a6",
  fillOpacity: 0.2,
  weight: 1.2,
};

const GOVERNORATE_STYLE = {
  color: "#7c3aed",
  fillColor: "#a78bfa",
  fillOpacity: 0.12,
  weight: 1.5,
  dashArray: "4 3",
};

const MICRO_STYLE = {
  color: "#64748b",
  fillColor: "#94a3b8",
  fillOpacity: 0.14,
  weight: 0.8,
};

const SELECTED_STYLE = {
  color: "#2563eb",
  fillColor: "#3b82f6",
  fillOpacity: 0.38,
  weight: 2.5,
};

const HIGHLIGHT_STYLE = {
  weight: 3,
  fillOpacity: 0.32,
};

type LabelEntry = {
  marker: L.Marker;
  isGovernorateCoverage: boolean;
  isMicroRegion: boolean;
};

type Props = {
  voronoi: VoronoiFeatureCollection | null;
  highlightId?: number | null;
  selectedIds?: number[];
  onSelectArea?: (id: number) => void;
  emptyLabel: string;
  className?: string;
  showLabels?: boolean;
};

function syncLabelVisibility(map: L.Map, labels: LabelEntry[]) {
  const z = map.getZoom();
  for (const entry of labels) {
    const { marker, isGovernorateCoverage } = entry;
    const el = marker.getElement();
    if (!el) continue;
    const minZ = isGovernorateCoverage
      ? LABEL_ZOOM_GOV
      : entry.isMicroRegion
        ? LABEL_ZOOM_MICRO
        : LABEL_ZOOM_NEIGHBORHOOD;
    el.style.display = z >= minZ ? "" : "none";
    el.classList.toggle("area-voronoi-label--dense", z >= 12);
  }
}

export default function AreaCoverageMap({
  voronoi,
  highlightId,
  selectedIds,
  onSelectArea,
  emptyLabel,
  className,
  showLabels = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const voronoiLayerRef = useRef<L.GeoJSON | null>(null);
  const labelEntriesRef = useRef<LabelEntry[]>([]);
  const zoomHandlerRef = useRef<(() => void) | null>(null);

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

    const onZoom = () => syncLabelVisibility(map, labelEntriesRef.current);
    zoomHandlerRef.current = onZoom;
    map.on("zoomend", onZoom);

    mapRef.current = map;
    return () => {
      map.off("zoomend", onZoom);
      map.remove();
      mapRef.current = null;
      voronoiLayerRef.current = null;
      labelEntriesRef.current = [];
      zoomHandlerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (voronoiLayerRef.current) {
      voronoiLayerRef.current.remove();
      voronoiLayerRef.current = null;
    }
    for (const { marker } of labelEntriesRef.current) {
      marker.remove();
    }
    labelEntriesRef.current = [];

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
          isMicroRegion?: boolean;
          areaId?: number;
        };
        const isGov = Boolean(p?.isGovernorateCoverage);
        const isMicro = Boolean(p?.isMicroRegion);
        const areaIdNum = Number(p?.areaId);
        const isSelected = selectedIds?.includes(areaIdNum) ?? false;
        const isHi = highlightId === areaIdNum || isSelected;
        const base = isSelected
          ? SELECTED_STYLE
          : isGov
            ? GOVERNORATE_STYLE
            : isMicro
              ? MICRO_STYLE
              : NEIGHBORHOOD_STYLE;
        return { ...base, ...(isHi && !isSelected ? HIGHLIGHT_STYLE : {}) };
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
          isMicroRegion?: boolean;
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
        const isGov = Boolean(p.isGovernorateCoverage);
        const isMicro = Boolean(p.isMicroRegion);
        if (showLabels && Number.isFinite(clat) && Number.isFinite(clng)) {
          const marker = L.marker([clat, clng], {
            icon: L.divIcon({
              className: `area-voronoi-label${isMicro ? " area-voronoi-label--micro" : ""}`,
              html: `<span title="${escapeHtml(name)}">${escapeHtml(label)}</span>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            }),
            interactive: false,
            keyboard: false,
          });
          marker.addTo(map);
          labelEntriesRef.current.push({
            marker,
            isGovernorateCoverage: isGov,
            isMicroRegion: isMicro,
          });
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
      map.setView(bounds[0]!, 14);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 16 });
    }

    syncLabelVisibility(map, labelEntriesRef.current);
  }, [voronoi, highlightId, selectedIds, onSelectArea, showLabels]);

  const isEmpty = !voronoi?.features?.length;

  return (
    <div className={`area-coverage-map-wrap${className ? ` ${className}` : ""}`}>
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
