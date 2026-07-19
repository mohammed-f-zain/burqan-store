import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { api } from "../api";
import AreaCoverageMap from "./AreaCoverageMap";
import { useLocale } from "../i18n/LocaleContext";
import type { VoronoiFeatureCollection } from "../lib/voronoiGeo";

type Area = { id: number; name: string; governorate?: string | null };

const MAP_FILTER_ALL = "__all__";
const GOVERNORATE_COVERAGE_SUFFIX = " — تغطية المحافظة";

type Props = {
  areas: Area[];
  selectedIds: number[];
  onChange: Dispatch<SetStateAction<number[]>>;
  /** Show governorate coverage cells by default (route zones need them selectable). */
  defaultShowGovCoverage?: boolean;
};

export default function RepAreaMapPicker({
  areas,
  selectedIds,
  onChange,
  defaultShowGovCoverage = false,
}: Props) {
  const { t } = useLocale();
  const [voronoiGeo, setVoronoiGeo] = useState<VoronoiFeatureCollection | null>(null);
  const [voronoiLoading, setVoronoiLoading] = useState(false);
  const [mapGovFilter, setMapGovFilter] = useState(MAP_FILTER_ALL);
  const [showGovCoverageOnMap, setShowGovCoverageOnMap] = useState(defaultShowGovCoverage);
  const [areaSearch, setAreaSearch] = useState("");

  const governorateOptions = useMemo(() => {
    const s = new Set<string>();
    for (const a of areas) {
      if (a.governorate?.trim()) s.add(a.governorate.trim());
    }
    return [...s].sort((a, b) => a.localeCompare(b, "ar"));
  }, [areas]);

  const coverageAreas = useMemo(() => {
    return areas
      .filter((a) => a.name.endsWith(GOVERNORATE_COVERAGE_SUFFIX))
      .filter((a) => {
        if (mapGovFilter === MAP_FILTER_ALL) return true;
        return (a.governorate ?? "").trim() === mapGovFilter;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [areas, mapGovFilter]);

  const searchableAreas = useMemo(() => {
    const needle = areaSearch.trim().toLowerCase();
    if (needle.length < 2) return [];
    return areas
      .filter((a) => {
        if (mapGovFilter !== MAP_FILTER_ALL && (a.governorate ?? "").trim() !== mapGovFilter) {
          return false;
        }
        return (
          a.name.toLowerCase().includes(needle) ||
          (a.governorate ?? "").toLowerCase().includes(needle)
        );
      })
      .slice(0, 40);
  }, [areas, areaSearch, mapGovFilter]);

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
    } catch {
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
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={showGovCoverageOnMap}
            onChange={(e) => setShowGovCoverageOnMap(e.target.checked)}
          />
          <span>{t.areas.mapShowGovCoverage}</span>
        </label>
        {voronoiLoading ? <span className="muted small">{t.areas.voronoiLoading}</span> : null}
        <span className="muted small rep-area-map-picker__count">
          {t.reps.areaMapSelected(selectedIds.length)}
          {mapGovFilter !== MAP_FILTER_ALL ? ` · ${t.reps.areaMapSelectedInView(selectedInView)}` : ""}
        </span>
      </div>

      {defaultShowGovCoverage || showGovCoverageOnMap ? (
        <div className="rep-area-map-picker__coverage">
          <h4 className="rep-area-map-picker__coverage-title">{t.reps.areaMapGovCoverageTitle}</h4>
          <p className="muted small">{t.reps.areaMapGovCoverageHint}</p>
          {coverageAreas.length === 0 ? (
            <p className="muted small">{t.reps.areaMapGovCoverageEmpty}</p>
          ) : (
            <div className="rep-pick-list rep-area-map-picker__coverage-list">
              {coverageAreas.map((a) => (
                <label key={a.id} className="checkbox-inline rep-pick-item">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(a.id)}
                    onChange={() => toggleArea(a.id)}
                  />
                  <span>{a.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="rep-area-map-picker__search">
        <label>
          {t.reps.areaMapSearchLabel}
          <input
            type="search"
            value={areaSearch}
            onChange={(e) => setAreaSearch(e.target.value)}
            placeholder={t.reps.areaMapSearchPlaceholder}
          />
        </label>
        {searchableAreas.length > 0 ? (
          <div className="rep-pick-list rep-area-map-picker__search-results">
            {searchableAreas.map((a) => (
              <label key={a.id} className="checkbox-inline rep-pick-item">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(a.id)}
                  onChange={() => toggleArea(a.id)}
                />
                <span>
                  {a.name}
                  {a.governorate ? ` · ${a.governorate}` : ""}
                </span>
              </label>
            ))}
          </div>
        ) : null}
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
