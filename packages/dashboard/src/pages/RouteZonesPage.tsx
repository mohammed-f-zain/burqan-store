import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import RepAreaMapPicker from "../components/RepAreaMapPicker";
import PaginationBar from "../components/PaginationBar";
import TableFilterBar from "../components/TableFilterBar";
import { useAuth } from "../auth/AuthContext";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";

type Area = { id: number; name: string; governorate?: string | null };
type RouteZone = {
  id: number;
  name: string;
  notes: string | null;
  isActive: boolean;
  areas: { id: number; name: string }[];
};

type RouteZoneRow = RouteZone & { areaNamesText: string };

export default function RouteZonesPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const write = can("areas.write");

  const [zones, setZones] = useState<RouteZone[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState<number[]>([]);

  const [editId, setEditId] = useState<number | null>(null);
  const [eName, setEName] = useState("");
  const [eNotes, setENotes] = useState("");
  const [ePicked, setEPicked] = useState<number[]>([]);
  const [eActive, setEActive] = useState(true);

  const areaNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of areas) m.set(a.id, a.name);
    return m;
  }, [areas]);

  const zoneRows: RouteZoneRow[] = useMemo(
    () =>
      zones.map((z) => ({
        ...z,
        areaNamesText: z.areas.map((a) => areaNameById.get(a.id) ?? a.name).join(" "),
      })),
    [zones, areaNameById]
  );

  const filterFields = useMemo(
    () => [
      { id: "name", label: t.routeZones.name, type: "text" as const, getValue: (z: RouteZoneRow) => z.name },
      { id: "notes", label: t.routeZones.notes, type: "text" as const, getValue: (z: RouteZoneRow) => z.notes },
      { id: "areas", label: t.routeZones.areasCol, type: "text" as const, getValue: (z: RouteZoneRow) => z.areaNamesText },
      {
        id: "active",
        label: t.routeZones.statusCol,
        type: "boolean" as const,
        getValue: (z: RouteZoneRow) => z.isActive,
      },
    ],
    [t.routeZones.areasCol, t.routeZones.name, t.routeZones.notes, t.routeZones.statusCol]
  );

  const zoneTable = useTableFilters(zoneRows, {
    searchAccessors: ["name", "notes", "areaNamesText"],
    fields: filterFields,
  });
  const zonePgn = zoneTable.pagination;

  async function load() {
    const [z, a] = await Promise.all([
      api.get<{ routeZones: RouteZone[] }>("/route-zones"),
      api.get<{ areas: Area[] }>("/areas"),
    ]);
    setZones(z.data.routeZones);
    setAreas(a.data.areas.filter((x) => !x.name.endsWith(" — تغطية المحافظة")));
  }

  useEffect(() => {
    void load().catch(() => toastError(t.routeZones.loadFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!write) return;
    if (!picked.length) {
      toastError(t.routeZones.pickAreas);
      return;
    }
    try {
      await api.post("/route-zones", { name: name.trim(), notes: notes.trim() || null, areaIds: picked });
      setName("");
      setNotes("");
      setPicked([]);
      await load();
      toastSuccess(t.routeZones.created);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.routeZones.saveFailed));
    }
  }

  function openEdit(z: RouteZone) {
    setEditId(z.id);
    setEName(z.name);
    setENotes(z.notes ?? "");
    setEPicked(z.areas.map((a) => a.id));
    setEActive(z.isActive);
  }

  function closeEdit() {
    setEditId(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (editId == null || !write) return;
    if (!ePicked.length) {
      toastError(t.routeZones.pickAreas);
      return;
    }
    try {
      await api.patch(`/route-zones/${editId}`, {
        name: eName.trim(),
        notes: eNotes.trim() || null,
        areaIds: ePicked,
        isActive: eActive,
      });
      closeEdit();
      await load();
      toastSuccess(t.routeZones.saved);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.routeZones.saveFailed));
    }
  }

  async function onDelete(z: RouteZone) {
    if (!write) return;
    const ok = await confirmDanger({
      title: t.routeZones.deleteConfirm,
      text: z.name,
      confirmText: t.routeZones.delete,
      cancelText: t.routeZones.cancel,
    });
    if (!ok) return;
    try {
      await api.delete(`/route-zones/${z.id}`);
      await load();
      toastSuccess(t.routeZones.deleted);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.routeZones.saveFailed));
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t.routeZones.title}</h1>
          <p className="muted">{t.routeZones.subtitle}</p>
        </div>
      </header>

      {write ? (
        <form className="card form-section" onSubmit={(e) => void onCreate(e)}>
          <h2>{t.routeZones.createTitle}</h2>
          <label>
            {t.routeZones.name}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            {t.routeZones.notes}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </label>
          <RepAreaMapPicker areas={areas} selectedIds={picked} onChange={setPicked} />
          <button type="submit" className="primary">
            {t.routeZones.createBtn}
          </button>
        </form>
      ) : null}

      <div className="card">
        <div className="card-head-row">
          <h2>{t.routeZones.listTitle}</h2>
          {zones.length > 0 && (
            <span className="muted small">{t.routeZones.listCount(zones.length)}</span>
          )}
        </div>

        {zones.length === 0 ? (
          <p className="muted">{t.routeZones.empty}</p>
        ) : (
          <>
            <TableFilterBar
              {...zoneTable}
              onSearchChange={zoneTable.setSearch}
              onFilterChange={zoneTable.setFilter}
              onClear={zoneTable.clearFilters}
              onToggleFilters={() => zoneTable.setShowFilters((v) => !v)}
              pinnedFieldIds={["active"]}
              labels={t.tableFilters}
            />
            {zoneTable.filteredCount > 0 && (
              <PaginationBar
                className="pagination-bar--flush"
                page={zonePgn.page}
                totalPages={zonePgn.totalPages}
                totalItems={zonePgn.total}
                from={zonePgn.from}
                to={zonePgn.to}
                pageSize={zonePgn.pageSize}
                pageSizeOptions={zonePgn.pageSizeOptions}
                onPageChange={zonePgn.setPage}
                onPageSizeChange={zonePgn.setPageSize}
              />
            )}
            <div className="table-wrap">
              <table className="table route-zones-table">
                <thead>
                  <tr>
                    <th>{t.routeZones.name}</th>
                    <th>{t.routeZones.areasCol}</th>
                    <th>{t.routeZones.statusCol}</th>
                    {write ? <th className="col-actions">{t.routeZones.colActions}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {zonePgn.slice.map((z) => (
                    <tr key={z.id}>
                      <td className="route-zone-name-cell">
                        <div className="route-zone-name">{z.name}</div>
                        {z.notes ? <div className="route-zone-notes muted small">{z.notes}</div> : null}
                      </td>
                      <td className="route-zone-areas-cell">
                        {z.areas.length === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <>
                            <span className="route-zone-area-count muted small">
                              {t.routeZones.areaCount(z.areas.length)}
                            </span>
                            <div className="route-zone-chips">
                              {z.areas.map((a) => (
                                <span key={a.id} className="route-zone-chip">
                                  {areaNameById.get(a.id) ?? a.name}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                      <td>
                        <span className={`pill${z.isActive ? " on" : " off"}`}>
                          {z.isActive ? t.routeZones.active : t.routeZones.inactive}
                        </span>
                      </td>
                      {write ? (
                        <td className="col-actions">
                          <span className="table-actions">
                            <button type="button" className="ghost small" onClick={() => openEdit(z)}>
                              {t.routeZones.edit}
                            </button>
                            <button type="button" className="ghost small danger" onClick={() => void onDelete(z)}>
                              {t.routeZones.delete}
                            </button>
                          </span>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {zoneTable.filteredCount === 0 && (
              <p className="muted">{t.tableFilters.noResults}</p>
            )}
          </>
        )}
      </div>

      {editId != null && (
        <div className="modal-backdrop" onClick={() => closeEdit()} role="presentation">
          <div className="modal wide card" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3>{t.routeZones.editTitle}</h3>
            <form className="form" onSubmit={(e) => void onSaveEdit(e)}>
              <label>
                {t.routeZones.name}
                <input value={eName} onChange={(e) => setEName(e.target.value)} required />
              </label>
              <label>
                {t.routeZones.notes}
                <textarea value={eNotes} onChange={(e) => setENotes(e.target.value)} rows={2} />
              </label>
              <label>
                {t.routeZones.activeToggle}{" "}
                <input type="checkbox" checked={eActive} onChange={(e) => setEActive(e.target.checked)} />
              </label>
              <RepAreaMapPicker areas={areas} selectedIds={ePicked} onChange={setEPicked} />
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <button type="submit" className="primary">
                  {t.routeZones.saveBtn}
                </button>
                <button type="button" className="ghost" onClick={() => closeEdit()}>
                  {t.routeZones.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
