import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "../api";
import AreaCoverageMap from "../components/AreaCoverageMap";
import AreaGovernorateGroups from "../components/AreaGovernorateGroups";
import TableFilterBar from "../components/TableFilterBar";
import { useAuth } from "../auth/AuthContext";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import type { VoronoiFeatureCollection } from "../lib/voronoiGeo";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";

type Area = {
  id: number;
  name: string;
  governorate: string | null;
  center_lat?: number | null;
  center_lng?: number | null;
  radius_km?: string | number | null;
};

type GovernorateCoverage = {
  governorate: string;
  areaId: number | null;
  areaName: string;
  enabled: boolean;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

const GOVERNORATE_COVERAGE_SUFFIX = " — تغطية المحافظة";
const MAP_FILTER_ALL = "__all__";

export default function AreasPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [govCoverage, setGovCoverage] = useState<GovernorateCoverage[]>([]);
  const [name, setName] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [coverageBusy, setCoverageBusy] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapGovFilter, setMapGovFilter] = useState("عمان");
  const [showGovCoverageOnMap, setShowGovCoverageOnMap] = useState(true);
  const [voronoiGeo, setVoronoiGeo] = useState<VoronoiFeatureCollection | null>(null);
  const [voronoiLoading, setVoronoiLoading] = useState(false);
  const [highlightAreaId, setHighlightAreaId] = useState<number | null>(null);

  const governorateOptions = useMemo(() => {
    const s = new Set<string>();
    for (const a of areas) {
      if (a.governorate?.trim()) s.add(a.governorate.trim());
    }
    return [...s].sort((a, b) => a.localeCompare(b, "ar"));
  }, [areas]);

  const mapGovernorateOptions = useMemo(() => {
    const s = new Set(governorateOptions);
    for (const g of govCoverage) s.add(g.governorate);
    return [MAP_FILTER_ALL, ...[...s].sort((a, b) => a.localeCompare(b, "ar"))];
  }, [governorateOptions, govCoverage]);

  const neighborhoodAreas = useMemo(
    () => areas.filter((a) => !a.name.endsWith(GOVERNORATE_COVERAGE_SUFFIX)),
    [areas]
  );

  const areaFilterFields = useMemo(
    () => [
      { id: "name", label: t.areas.newLabel, type: "text" as const, getValue: (a: Area) => a.name },
      { id: "gov", label: t.areas.governorateLabel, type: "text" as const, getValue: (a: Area) => a.governorate },
      { id: "id", label: "ID", type: "text" as const, getValue: (a: Area) => a.id },
    ],
    [t.areas.governorateLabel, t.areas.newLabel]
  );

  const areaListTable = useTableFilters(neighborhoodAreas, {
    searchAccessors: ["id", "name", "governorate", (a) => `${a.center_lat},${a.center_lng}`, "radius_km"],
    fields: areaFilterFields,
  });

  const filteredNeighborhoodAreas = areaListTable.filtered;

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

  const invalidateVoronoi = useCallback(() => {
    setVoronoiGeo(null);
  }, []);

  const onMapSelectArea = useCallback((id: number) => {
    setHighlightAreaId(id);
  }, []);

  const loadVoronoiMap = useCallback(async () => {
    setVoronoiLoading(true);
    try {
      const { data } = await api.get<{ geojson: VoronoiFeatureCollection }>("/areas/voronoi");
      setVoronoiGeo(data.geojson ?? null);
    } catch (err) {
      setVoronoiGeo(null);
      toastError(pickAxiosErrorMessage(err, t.areas.voronoiLoadFailed));
    } finally {
      setVoronoiLoading(false);
    }
  }, [t.areas.voronoiLoadFailed]);

  useEffect(() => {
    if (showMap && !voronoiGeo && !voronoiLoading) {
      void loadVoronoiMap();
    }
  }, [showMap, voronoiGeo, voronoiLoading, loadVoronoiMap]);

  function focusAreaOnMap(area: Area) {
    const gov = area.governorate?.trim();
    if (gov) setMapGovFilter(gov);
    setHighlightAreaId(area.id);
    setShowMap(true);
    requestAnimationFrame(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function load() {
    const { data } = await api.get<{ areas: Area[] }>("/areas");
    setAreas(data.areas);
  }

  async function loadGovernorateCoverage() {
    const { data } = await api.get<{ governorates: GovernorateCoverage[] }>(
      "/areas/governorate-coverage"
    );
    setGovCoverage(data.governorates);
  }

  useEffect(() => {
    void Promise.all([load(), loadGovernorateCoverage()]).catch(() =>
      toastError(t.areas.governorateCoverageLoadFailed)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/areas", {
        name: name.trim(),
        governorate: governorate.trim() || null,
      });
      setName("");
      setGovernorate("");
      await load();
      invalidateVoronoi();
      toastSuccess(t.areas.added);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.areas.addFailed));
    }
  }

  async function toggleGovernorateCoverage(item: GovernorateCoverage, enabled: boolean) {
    if (!can("areas.write")) return;
    setCoverageBusy(item.governorate);
    try {
      await api.patch("/areas/governorate-coverage", {
        governorate: item.governorate,
        enabled,
      });
      setGovCoverage((prev) =>
        prev.map((g) => (g.governorate === item.governorate ? { ...g, enabled } : g))
      );
      invalidateVoronoi();
      toastSuccess(t.areas.governorateCoverageSaved);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.areas.governorateCoverageFailed));
    } finally {
      setCoverageBusy(null);
    }
  }

  function startEdit(a: Area) {
    setEditingId(a.id);
    setEditName(a.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit() {
    if (editingId == null) return;
    try {
      await api.patch(`/areas/${editingId}`, { name: editName.trim() });
      setEditingId(null);
      setEditName("");
      await load();
      invalidateVoronoi();
      toastSuccess(t.areas.updated);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.areas.saveFailed));
    }
  }

  async function remove(id: number) {
    const ok = await confirmDanger({
      title: t.areas.deleteTitle,
      text: t.areas.confirmDelete,
      confirmText: t.areas.delete,
      cancelText: t.areas.cancel,
    });
    if (!ok) return;
    try {
      await api.delete(`/areas/${id}`);
      if (editingId === id) cancelEdit();
      if (highlightAreaId === id) setHighlightAreaId(null);
      await load();
      invalidateVoronoi();
      toastSuccess(t.areas.deleted);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.areas.deleteFailed));
    }
  }

  const write = can("areas.write");

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.areas.governorateCoverageTitle}</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>
          {t.areas.governorateCoverageHint}
        </p>
        <div className="gov-coverage-grid">
          {govCoverage.map((g) => (
            <div className="gov-coverage-row" key={g.governorate}>
              <div>
                <strong>{g.governorate}</strong>
                <div className="muted small">
                  {g.areaName} · {g.radiusKm} km
                </div>
              </div>
              {write ? (
                <label className="gov-coverage-toggle">
                  <input
                    type="checkbox"
                    checked={g.enabled}
                    disabled={coverageBusy === g.governorate}
                    onChange={(e) => void toggleGovernorateCoverage(g, e.target.checked)}
                  />
                  <span>{g.enabled ? t.areas.governorateCoverageOn : t.areas.governorateCoverageOff}</span>
                </label>
              ) : (
                <span className="muted small">
                  {g.enabled ? t.areas.governorateCoverageOn : t.areas.governorateCoverageOff}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card" ref={mapSectionRef}>
        <div className="row spread" style={{ flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{t.areas.mapTitle}</h2>
          <button type="button" className="ghost" onClick={() => setShowMap((v) => !v)}>
            {showMap ? t.areas.mapHide : t.areas.mapShow}
          </button>
        </div>
        {showMap ? (
          <>
            <div className="area-map-toolbar">
              <label>
                {t.areas.mapGovernorateFilter}
                <select value={mapGovFilter} onChange={(e) => setMapGovFilter(e.target.value)}>
                  <option value={MAP_FILTER_ALL}>{t.areas.mapAllGovernorates}</option>
                  {mapGovernorateOptions
                    .filter((g) => g !== MAP_FILTER_ALL)
                    .map((g) => (
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
              <div className="area-map-legend">
                <span className="area-map-legend-item">
                  <span className="area-map-legend-swatch area-map-legend-swatch--voronoi" aria-hidden />
                  {t.areas.mapVoronoiLegend}
                </span>
                <span className="area-map-legend-item">
                  <span
                    className="area-map-legend-swatch area-map-legend-swatch--voronoi-gov"
                    aria-hidden
                  />
                  {t.areas.mapVoronoiGovLegend}
                </span>
              </div>
            </div>
            <p className="muted small" style={{ marginBottom: 10 }}>
              {t.areas.mapVoronoiHint}
            </p>
            <AreaCoverageMap
              voronoi={mapVoronoi}
              highlightId={highlightAreaId}
              onSelectArea={onMapSelectArea}
              emptyLabel={t.areas.mapNoGeo}
            />
          </>
        ) : null}
      </div>

      <div className="card">
        <h2>{t.areas.title}</h2>
        {write && (
          <form onSubmit={onAdd} className="form" style={{ maxWidth: 520 }}>
            <label>
              {t.areas.governorateLabel}
              <select value={governorate} onChange={(e) => setGovernorate(e.target.value)}>
                <option value="">{t.areas.governoratePick}</option>
                {governorateOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.areas.newLabel}
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </label>
            <button className="primary" type="submit">
              {t.areas.add}
            </button>
          </form>
        )}
      </div>
      <div className="card">
        {neighborhoodAreas.length === 0 ? (
          <p className="muted">{t.areas.empty}</p>
        ) : (
          <>
            <TableFilterBar
              {...areaListTable}
              onSearchChange={areaListTable.setSearch}
              onFilterChange={areaListTable.setFilter}
              onClear={areaListTable.clearFilters}
              onToggleFilters={() => areaListTable.setShowFilters((v) => !v)}
              labels={t.tableFilters}
            />
            {filteredNeighborhoodAreas.length === 0 ? (
              <p className="muted">{t.tableFilters.noResults}</p>
            ) : (
          <AreaGovernorateGroups
            areas={filteredNeighborhoodAreas}
            unassignedLabel={t.areas.unassignedGroup}
            expandAllLabel={t.areas.expandAll}
            collapseAllLabel={t.areas.collapseAll}
            defaultOpen
          >
            {(a) => (
              <div
                className={`area-gov-row${highlightAreaId === a.id ? " area-gov-row--highlight" : ""}`}
                key={a.id}
              >
                <div className="area-gov-row__main">
                  {editingId === a.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      minLength={2}
                      style={{ width: "100%", maxWidth: 320 }}
                    />
                  ) : (
                    <>
                      <strong>{a.name}</strong> <span className="muted small">#{a.id}</span>
                    </>
                  )}
                </div>
                <div className="row spread" style={{ gap: 8, flexWrap: "wrap" }}>
                  {a.center_lat != null && a.center_lng != null ? (
                    <button type="button" className="ghost" onClick={() => focusAreaOnMap(a)}>
                      {t.areas.mapViewOnMap}
                    </button>
                  ) : null}
                  {write && (
                    <>
                      {editingId === a.id ? (
                        <>
                          <button type="button" className="primary" onClick={() => void saveEdit()}>
                            {t.areas.save}
                          </button>
                          <button type="button" className="ghost" onClick={cancelEdit}>
                            {t.areas.cancel}
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="ghost" onClick={() => startEdit(a)}>
                            {t.areas.edit}
                          </button>
                          <button type="button" className="ghost danger" onClick={() => void remove(a.id)}>
                            {t.areas.delete}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </AreaGovernorateGroups>
            )}
          </>
        )}
      </div>
    </div>
  );
}
