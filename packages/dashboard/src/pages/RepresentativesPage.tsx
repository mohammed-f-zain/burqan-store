import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { mediaUrl } from "../lib/mediaUrl";
import { confirmDanger } from "../lib/swalConfirm";
import { uploadAdminImage } from "../lib/uploadAdmin";

type Rep = {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  car_plate: string | null;
  is_active: boolean;
  area_ids: unknown;
  image_url: string | null;
};
type Area = { id: number; name: string };
type InvRow = { product_id: number; name: string; price: string; quantity: number };

function normalizeAreaIds(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) return p.map((x) => Number(x)).filter((n) => Number.isFinite(n));
    } catch {
      /* ignore */
    }
  }
  return [];
}

export default function RepresentativesPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const [reps, setReps] = useState<Rep[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [imagePath, setImagePath] = useState("");
  const [uploading, setUploading] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [eEmail, setEEmail] = useState("");
  const [eFullName, setEFullName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eCarPlate, setECarPlate] = useState("");
  const [ePicked, setEPicked] = useState<number[]>([]);
  const [eImagePath, setEImagePath] = useState("");
  const [eIsActive, setEIsActive] = useState(true);
  const [eNewPassword, setENewPassword] = useState("");
  const [eUploading, setEUploading] = useState(false);
  const [eInventory, setEInventory] = useState<InvRow[]>([]);

  const repPgn = useClientPagination(reps);

  const areaNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of areas) m.set(a.id, a.name);
    return m;
  }, [areas]);

  async function load() {
    const [r, a] = await Promise.all([
      api.get<{ representatives: Rep[] }>("/representatives"),
      api.get<{ areas: Area[] }>("/areas"),
    ]);
    setReps(r.data.representatives);
    setAreas(a.data.areas);
  }

  async function toggleRepActive(r: Rep) {
    if (!can("reps.write")) return;
    setMsg(null);
    try {
      await api.patch(`/representatives/${r.id}`, { isActive: !r.is_active });
      await load();
      setMsg(r.is_active ? t.reps.deactivated : t.reps.activated);
    } catch (e) {
      setMsg(pickAxiosErrorMessage(e, t.reps.loadFailed));
    }
  }

  useEffect(() => {
    void load().catch(() => setMsg(t.reps.loadFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  function toggleArea(id: number) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function toggleEArea(id: number) {
    setEPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function onPickPhoto(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadAdminImage(file);
      setImagePath(path);
    } catch (e) {
      setMsg(pickAxiosErrorMessage(e, t.reps.loadFailed));
    } finally {
      setUploading(false);
    }
  }

  async function onPickEditPhoto(file: File | null) {
    if (!file) return;
    setEUploading(true);
    try {
      const path = await uploadAdminImage(file);
      setEImagePath(path);
    } catch (e) {
      setMsg(pickAxiosErrorMessage(e, t.reps.loadFailed));
    } finally {
      setEUploading(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const areaIds = picked.length ? picked : areas.map((x) => x.id);
    if (!areaIds.length) {
      setMsg(t.reps.loadFailed);
      return;
    }
    try {
      await api.post("/representatives", {
        email,
        password,
        fullName,
        phone,
        carPlate: carPlate || undefined,
        imageUrl: imagePath || undefined,
        areaIds,
      });
      setEmail("");
      setPassword("");
      setFullName("");
      setPhone("");
      setCarPlate("");
      setPicked([]);
      setImagePath("");
      await load();
      setMsg(t.reps.created);
    } catch (err) {
      setMsg(pickAxiosErrorMessage(err, t.reps.createFailed));
    }
  }

  async function loadRepInventory(repId: number) {
    const { data } = await api.get<{ inventory: InvRow[] }>(`/representatives/${repId}/inventory`);
    setEInventory(data.inventory ?? []);
  }

  function openEdit(r: Rep) {
    setMsg(null);
    setEditId(r.id);
    setEEmail(r.email);
    setEFullName(r.full_name);
    setEPhone(r.phone);
    setECarPlate(r.car_plate ?? "");
    setEPicked(normalizeAreaIds(r.area_ids));
    setEImagePath(r.image_url ?? "");
    setEIsActive(r.is_active);
    setENewPassword("");
    void loadRepInventory(r.id).catch(() => setEInventory([]));
  }

  function closeEdit() {
    setEditId(null);
    setENewPassword("");
    setEInventory([]);
  }

  async function saveInventory() {
    if (editId == null) return;
    setMsg(null);
    try {
      await api.put(`/representatives/${editId}/inventory`, {
        items: eInventory.map((row) => ({
          productId: row.product_id,
          quantity: Math.max(0, parseInt(String(row.quantity), 10) || 0),
        })),
      });
      setMsg(t.reps.inventorySaved);
    } catch (err) {
      setMsg(pickAxiosErrorMessage(err, t.reps.saveFailed));
    }
  }

  async function saveEdit() {
    if (editId == null) return;
    setMsg(null);
    const areaIds = ePicked.length ? ePicked : areas.map((x) => x.id);
    if (!areaIds.length) {
      setMsg(t.reps.saveFailed);
      return;
    }
    try {
      await api.patch(`/representatives/${editId}`, {
        email: eEmail,
        fullName: eFullName,
        phone: ePhone,
        carPlate: eCarPlate.trim() || null,
        imageUrl: eImagePath === "" ? null : eImagePath || undefined,
        isActive: eIsActive,
        areaIds,
        newPassword: eNewPassword.trim().length >= 10 ? eNewPassword.trim() : undefined,
      });
      closeEdit();
      await load();
      setMsg(t.reps.updated);
    } catch (err) {
      setMsg(pickAxiosErrorMessage(err, t.reps.saveFailed));
    }
  }

  async function removeRep(id: number) {
    const ok = await confirmDanger({
      title: t.reps.deleteTitle,
      text: t.reps.confirmDelete,
      confirmText: t.reps.delete,
      cancelText: t.reps.cancel,
    });
    if (!ok) return;
    setMsg(null);
    try {
      await api.delete(`/representatives/${id}`);
      if (editId === id) closeEdit();
      await load();
      setMsg(t.reps.deleted);
    } catch (err) {
      setMsg(pickAxiosErrorMessage(err, t.reps.deleteFailed));
    }
  }

  function formatAreasCell(r: Rep) {
    const ids = normalizeAreaIds(r.area_ids);
    return ids.map((id) => areaNameById.get(id) ?? id).join(", ");
  }

  const write = can("reps.write");

  return (
    <div className="grid">
      {msg && (
        <p
          className={
            msg === t.reps.created || msg === t.reps.updated || msg === t.reps.deleted ? "muted" : "error"
          }
          style={{ gridColumn: "1 / -1" }}
        >
          {msg}
        </p>
      )}

      {write && (
        <div className="card">
          <h2>{t.reps.createTitle}</h2>
          <form onSubmit={onCreate} className="form">
            <label>
              {t.reps.email}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </label>
            <label>
              {t.reps.password}
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={10} required />
            </label>
            <label>
              {t.reps.fullName}
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label>
              {t.reps.phone}
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
            <label>
              {t.reps.carPlate}
              <input value={carPlate} onChange={(e) => setCarPlate(e.target.value)} />
            </label>
            <div>
              <div className="muted small">{t.reps.photo}</div>
              <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(e) => void onPickPhoto(e.target.files?.[0] ?? null)} />
              <span className="muted small">{t.reps.pickPhoto}</span>
              {uploading && <p className="muted small">{t.reps.uploading}</p>}
            </div>
            <div className="muted small">{t.reps.areas}</div>
            <div className="perm-grid">
              {areas.map((a) => (
                <label key={a.id} className="check">
                  <input type="checkbox" checked={picked.includes(a.id)} onChange={() => toggleArea(a.id)} />
                  <span>{a.name}</span>
                </label>
              ))}
            </div>
            <button className="primary" type="submit">
              {t.reps.createBtn}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>{t.reps.titleList}</h2>
        {reps.length > 0 && (
          <PaginationBar
            className="pagination-bar--flush"
            page={repPgn.page}
            totalPages={repPgn.totalPages}
            totalItems={repPgn.total}
            from={repPgn.from}
            to={repPgn.to}
            pageSize={repPgn.pageSize}
            pageSizeOptions={repPgn.pageSizeOptions}
            onPageChange={repPgn.setPage}
            onPageSizeChange={repPgn.setPageSize}
          />
        )}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.reps.colName}</th>
                <th>{t.reps.colEmail}</th>
                <th>{t.reps.colCar}</th>
                <th>{t.reps.colAreas}</th>
                <th>{t.reps.colActive}</th>
                {write && <th>{t.reps.colActions}</th>}
              </tr>
            </thead>
            <tbody>
              {repPgn.slice.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {mediaUrl(r.image_url) && (
                        <img src={mediaUrl(r.image_url)} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} />
                      )}
                      {r.full_name}
                    </div>
                  </td>
                  <td>{r.email}</td>
                  <td>{r.car_plate ?? "—"}</td>
                  <td className="small">{formatAreasCell(r) || "—"}</td>
                  <td>
                    {write ? (
                      <button
                        type="button"
                        className={r.is_active ? "pill on" : "pill off"}
                        onClick={() => void toggleRepActive(r)}
                      >
                        {r.is_active ? t.reps.active : t.reps.disabled}
                      </button>
                    ) : (
                      (r.is_active ? t.reps.active : t.reps.disabled)
                    )}
                  </td>
                  {write && (
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <button type="button" className="ghost" onClick={() => openEdit(r)}>
                          {t.reps.edit}
                        </button>
                        <button type="button" className="ghost danger" onClick={() => void removeRep(r.id)}>
                          {t.reps.delete}
                        </button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editId != null && (
        <div className="modal-backdrop" onClick={() => closeEdit()} role="presentation">
          <div className="modal card" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3>{t.reps.editTitle}</h3>
            <div className="form">
              <label>
                {t.reps.email}
                <input value={eEmail} onChange={(e) => setEEmail(e.target.value)} type="email" required />
              </label>
              <label>
                {t.reps.fullName}
                <input value={eFullName} onChange={(e) => setEFullName(e.target.value)} required />
              </label>
              <label>
                {t.reps.phone}
                <input value={ePhone} onChange={(e) => setEPhone(e.target.value)} required />
              </label>
              <label>
                {t.reps.carPlate}
                <input value={eCarPlate} onChange={(e) => setECarPlate(e.target.value)} />
              </label>
              <label>
                {t.reps.colActive}{" "}
                <input type="checkbox" checked={eIsActive} onChange={(e) => setEIsActive(e.target.checked)} />
              </label>
              <label>
                {t.reps.newPasswordHint}
                <input value={eNewPassword} onChange={(e) => setENewPassword(e.target.value)} type="password" autoComplete="new-password" />
              </label>
              <div>
                <div className="muted small">{t.reps.photo}</div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => void onPickEditPhoto(e.target.files?.[0] ?? null)}
                />
                {eUploading && <p className="muted small">{t.reps.uploading}</p>}
                {mediaUrl(eImagePath) && (
                  <div style={{ marginTop: 8 }}>
                    <img src={mediaUrl(eImagePath)} alt="" style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8 }} />
                    <div>
                      <button type="button" className="ghost small" onClick={() => setEImagePath("")}>
                        {t.products.clearImage}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="muted small">{t.reps.areas}</div>
              <div className="perm-grid">
                {areas.map((a) => (
                  <label key={a.id} className="check">
                    <input type="checkbox" checked={ePicked.includes(a.id)} onChange={() => toggleEArea(a.id)} />
                    <span>{a.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <h4 style={{ marginTop: 16 }}>{t.reps.inventoryTitle}</h4>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.orders.product}</th>
                    <th>{t.reps.inventoryQty}</th>
                  </tr>
                </thead>
                <tbody>
                  {eInventory.map((row, idx) => (
                    <tr key={row.product_id}>
                      <td>{row.name}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={row.quantity}
                          onChange={(e) => {
                            const q = parseInt(e.target.value, 10);
                            setEInventory((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, quantity: Number.isFinite(q) ? q : 0 } : r))
                            );
                          }}
                          style={{ width: 88 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="secondary" style={{ marginTop: 8 }} onClick={() => void saveInventory()}>
              {t.reps.saveInventory}
            </button>
            <div className="row spread" style={{ marginTop: 16 }}>
              <button type="button" className="ghost" onClick={() => closeEdit()}>
                {t.reps.cancel}
              </button>
              <button type="button" className="primary" onClick={() => void saveEdit()}>
                {t.reps.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
