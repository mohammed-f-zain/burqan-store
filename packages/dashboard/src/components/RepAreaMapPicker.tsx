import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { api } from "../api";
import AreaCoverageMap from "./AreaCoverageMap";
import { useLocale } from "../i18n/LocaleContext";
import type { VoronoiFeatureCollection } from "../lib/voronoiGeo";

type Area = { id: number; name: string; governorate?: string | null };

const MAP_FILTER_ALL = "__all__";

type Props = {
  areas: Area[];
  selectedIds: number[];
  onChange: Dispatch<SetStateAction<number[]>>;
};

export default function RepAreaMapPicker({ areas, selectedIds, onChange }: Props) {
  const { t } = useLocale();
  const [voronoiGeo, setVoronoiGeo] = useState<VoronoiFeatureCollection | null>(null);
  const [voronoiLoading, setVoronoiLoading] = useState(false);
  const [mapGovFilter, setMapGovFilter] = useState("عمان");
  const [showGovCoverageOnMap, setShowGovCoverageOnMap] = useState(false);

  const governorateOptions = useMemo(() => {
    const s = new Set<string>();
    for (const a of areas) {
      if (a.governorate?.trim()) s.add(a.governorate.trim());
    }
    return [...s].sort((a, b) => a.localeCompare(b, "ar"));
  }, [areas]);

  const mapVoronoi = useMemo((): VoronoiFeatureCollection | null => {
    if (!voronoiGeo?.features?.length) return voronoiGeo;
    const features = voronoiGeo.features.filter((f) => {
      const p = f.properties;
      if (!showGovCoverageOnMap && p.isGovernorateCoverage) return false;
      if (mapGovFilter === MAP_FILTER_ALL) return true;
      return p.governorate === mapGovFilter;
    });
    return { type: "FeatureCollection", features };
  }, [voronoiGeo, mapGovFilter, showGovCoverageOnMap]);

  const loadVoronoiMap = useCallback(async () => {
    setVoronoiLoading(true);
    try {
      const { data } = await api.get<{ geojson: VoronoiFeatureCollection }>("/areas/voronoi");
      setVoronoiGeo(data.geojson ?? null);
    } catch (err) {
      setVoronoiGeo(null);
    } finally {
      setVoronoiLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVoronoiMap();
  }, [loadVoronoiMap]);

  const toggleArea = useCallback(
    (id: number) => {
      onChange((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [onChange]
  );

  const visibleAreaIds = useMemo(() => {
    const ids = new Set<number>();
    for (const f of mapVoronoi?.features ?? []) {
      const id = Number(f.properties.areaId);
      if (Number.isFinite(id)) ids.add(id);
    }
    return ids;
  }, [mapVoronoi]);

  const selectVisible = useCallback(() => {
    const next = new Set(selectedIds);
    for (const id of visibleAreaIds) next.add(id);
    onChange([...next]);
  }, [onChange, selectedIds, visibleAreaIds]);

  const clearVisible = useCallback(() => {
    onChange(selectedIds.filter((id) => !visibleAreaIds.has(id)));
  }, [onChange, selectedIds, visibleAreaIds]);

  const selectedInView = useMemo(
    () => selectedIds.filter((id) => visibleAreaIds.has(id)).length,
    [selectedIds, visibleAreaIds]
  );

  return (
    <div className="rep-area-map-picker">
      <p className="muted small rep-area-map-picker__hint">{t.reps.areaMapHint}</p>
      <div className="area-map-toolbar rep-area-map-picker__toolbar">
        <label>
          {t.areas.mapGovernorateFilter}
          <select value={mapGovFilter} onChange={(e) => setMapGovFilter(e.target.value)}>
            <option value={MAP_FILTER_ALL}>{t.areas.mapAllGovernorates}</option>
            {governorateOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showGovCoverageOnMap}
            onChange={(e) => setShowGovCoverageOnMap(e.target.checked)}
          />
          {t.areas.mapShowGovCoverage}
        </label>
        {voronoiLoading ? <span className="muted small">{t.areas.voronoiLoading}</span> : null}
        <span className="muted small rep-area-map-picker__count">
          {t.reps.areaMapSelected(selectedIds.length)}
          {mapGovFilter !== MAP_FILTER_ALL ? ` · ${t.reps.areaMapSelectedInView(selectedInView)}` : ""}
        </span>
      </div>
      <div className="row rep-area-map-picker__actions" style={{ gap: 8, marginBottom: 8 }}>
        <button type="button" className="ghost small" onClick={selectVisible}>
          {t.reps.areaMapSelectVisible}
        </button>
        <button type="button" className="ghost small" onClick={clearVisible}>
          {t.reps.areaMapClearVisible}
        </button>
      </div>
      <AreaCoverageMap
        voronoi={mapVoronoi}
        selectedIds={selectedIds}
        onSelectArea={toggleArea}
        emptyLabel={t.areas.mapNoGeo}
        className="rep-area-map-picker__map"
        earlyLabels
      />
    </div>
  );
}
