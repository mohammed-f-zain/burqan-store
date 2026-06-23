import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import TableFilterBar from "../components/TableFilterBar";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { toastError, toastSuccess } from "../lib/toast";

type GooglePlace = {
  id: number;
  name: string;
  address_text: string | null;
  location_lat: number;
  location_lng: number;
  google_maps_url: string | null;
  area_name: string | null;
  governorate: string | null;
  matched_store_id: number | null;
  matched_store_name: string | null;
};

const GOVERNORATES = [
  "عمان",
  "إربد",
  "الزرقاء",
  "المفرق",
  "العقبة",
  "الكرك",
  "معان",
  "الطفيلة",
  "مادبا",
  "جرش",
  "عجلون",
  "البلقاء",
];

export default function GooglePlacesPanel() {
  const { t } = useLocale();
  const [places, setPlaces] = useState<GooglePlace[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [gov, setGov] = useState("عمان");
  const [unmatchedOnly, setUnmatchedOnly] = useState(true);
  const [regenerate, setRegenerate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ places: GooglePlace[]; googlePlacesEnabled: boolean }>(
        "/google-places",
        { params: { governorate: gov, unmatched: unmatchedOnly ? "1" : "0" } }
      );
      setPlaces(data.places ?? []);
      setEnabled(data.googlePlacesEnabled !== false);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.stores.googleLoadFailed));
    } finally {
      setLoading(false);
    }
  }, [gov, unmatchedOnly, t.stores.googleLoadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const placeFilterFields = useMemo(
    () => [
      { id: "name", label: t.stores.colStore, type: "text" as const, getValue: (p: GooglePlace) => p.name },
      { id: "address", label: t.stores.colLocation, type: "text" as const, getValue: (p: GooglePlace) => p.address_text },
      { id: "area", label: t.stores.colArea, type: "text" as const, getValue: (p: GooglePlace) => p.area_name },
      { id: "gov", label: t.stores.googleGov, type: "text" as const, getValue: (p: GooglePlace) => p.governorate },
      { id: "match", label: t.stores.googleBurqanMatch, type: "text" as const, getValue: (p: GooglePlace) => p.matched_store_name },
    ],
    [t.stores.colArea, t.stores.colLocation, t.stores.colStore, t.stores.googleBurqanMatch, t.stores.googleGov]
  );

  const placesTable = useTableFilters(places, {
    searchAccessors: [
      "name",
      "address_text",
      "area_name",
      "governorate",
      "matched_store_name",
      (p) => `${p.location_lat},${p.location_lng}`,
    ],
    fields: placeFilterFields,
  });
  const visiblePlaces = placesTable.filtered;

  async function onImport(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post<{
        searchedPoints: number;
        searchQueries?: number;
        cleared?: number;
        fetched: number;
        upserted: number;
        matchedBurqanStores: number;
      }>("/google-places/import", { governorate: gov, regenerate });
      toastSuccess(
        t.stores.googleImportDone(
          data.fetched,
          data.matchedBurqanStores,
          data.searchedPoints,
          data.cleared ?? 0,
          data.searchQueries ?? 0
        )
      );
      await load();
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.stores.googleImportFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>{t.stores.googleTitle}</h2>
      <p className="muted small">{t.stores.googleHint}</p>
      {!enabled ? <p className="muted small">{t.stores.googleDisabled}</p> : null}

      <form className="row spread" style={{ flexWrap: "wrap", gap: 12, marginBottom: 12 }} onSubmit={onImport}>
        <label>
          {t.stores.googleGov}
          <select value={gov} onChange={(e) => setGov(e.target.value)}>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="gov-coverage-toggle">
          <input
            type="checkbox"
            checked={unmatchedOnly}
            onChange={(e) => setUnmatchedOnly(e.target.checked)}
          />
          {t.stores.googleUnmatchedOnly}
        </label>
        <label className="gov-coverage-toggle" title={t.stores.googleRegenerateHint}>
          <input
            type="checkbox"
            checked={regenerate}
            onChange={(e) => setRegenerate(e.target.checked)}
          />
          {t.stores.googleRegenerate}
        </label>
        <button type="submit" className="primary" disabled={busy || !enabled}>
          {busy ? t.stores.googleImporting : t.stores.googleImportBtn}
        </button>
      </form>

      {loading ? (
        <p className="muted">{t.stores.googleLoading}</p>
      ) : places.length === 0 ? (
        <p className="muted">{t.stores.googleEmpty}</p>
      ) : (
        <>
          <TableFilterBar
            {...placesTable}
            onSearchChange={placesTable.setSearch}
            onFilterChange={placesTable.setFilter}
            onClear={placesTable.clearFilters}
            onToggleFilters={() => placesTable.setShowFilters((v) => !v)}
            labels={t.tableFilters}
          />
          {visiblePlaces.length === 0 ? (
            <p className="muted">{t.tableFilters.noResults}</p>
          ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.stores.colStore}</th>
                <th>{t.stores.colArea}</th>
                <th>{t.stores.colLocation}</th>
                <th>{t.stores.googleBurqanMatch}</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlaces.slice(0, 80).map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="strong">{p.name}</div>
                    {p.address_text ? <div className="muted small">{p.address_text}</div> : null}
                  </td>
                  <td>
                    {p.area_name ?? "—"}
                    {p.governorate ? <div className="muted small">{p.governorate}</div> : null}
                  </td>
                  <td>
                    {p.google_maps_url ? (
                      <a href={p.google_maps_url} target="_blank" rel="noopener noreferrer">
                        {t.stores.googleOpenMaps}
                      </a>
                    ) : (
                      <span className="muted small">
                        {p.location_lat.toFixed(4)}, {p.location_lng.toFixed(4)}
                      </span>
                    )}
                  </td>
                  <td>
                    {p.matched_store_name ? (
                      <span className="pill on">{p.matched_store_name}</span>
                    ) : (
                      <span className="pill off">{t.stores.googleProspect}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visiblePlaces.length > 80 ? (
            <p className="muted small" style={{ marginTop: 8 }}>
              {t.stores.googleTruncated(visiblePlaces.length)}
            </p>
          ) : null}
        </div>
          )}
        </>
      )}
    </div>
  );
}
