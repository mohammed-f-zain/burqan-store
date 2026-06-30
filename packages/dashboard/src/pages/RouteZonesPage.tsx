import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import RepAreaMapPicker from "../components/RepAreaMapPicker";
import { useAuth } from "../auth/AuthContext";
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
        <h2>{t.routeZones.listTitle}</h2>
        {zones.length === 0 ? (
          <p className="muted">{t.routeZones.empty}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.routeZones.name}</th>
                  <th>{t.routeZones.areasCol}</th>
                  <th>{t.routeZones.statusCol}</th>
                  {write ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id}>
                    <td>
                      <strong>{z.name}</strong>
                      {z.notes ? <div className="muted small">{z.notes}</div> : null}
                    </td>
                    <td>
                      {z.areas.length
                        ? z.areas.map((a) => areaNameById.get(a.id) ?? a.name).join("، ")
                        : "—"}
                    </td>
                    <td>{z.isActive ? t.routeZones.active : t.routeZones.inactive}</td>
                    {write ? (
                      <td>
                        <span className="row" style={{ gap: 8 }}>
                          <button type="button" className="ghost" onClick={() => openEdit(z)}>
                            {t.routeZones.edit}
                          </button>
                          <button type="button" className="ghost danger" onClick={() => void onDelete(z)}>
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
