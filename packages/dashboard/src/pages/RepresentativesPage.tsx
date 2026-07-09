import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import RepRouteScheduleModal from "../components/RepRouteScheduleModal";
import RepRouteScheduleFields, {
  mergeScheduleZones,
  type RouteZoneOption,
  type ScheduleRow,
} from "../components/RepRouteScheduleFields";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import TableFilterBar from "../components/TableFilterBar";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { mediaUrl } from "../lib/mediaUrl";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";
import { uploadAdminImage } from "../lib/uploadAdmin";

type RouteScheduleEntry = { dayOfWeek: number; zoneName: string | null };

type Rep = {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  car_plate: string | null;
  is_active: boolean;
  route_schedule: unknown;
  image_url: string | null;
};

const DAY_SHORT_AR = ["أحد", "إث", "ث", "ر", "خ", "ج", "س"];
const DAY_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function normalizeSchedule(raw: unknown): RouteScheduleEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const dayOfWeek = Number(o.dayOfWeek ?? o.day_of_week);
      const zoneName = typeof o.zoneName === "string" ? o.zoneName : typeof o.zone_name === "string" ? o.zone_name : null;
      if (!Number.isFinite(dayOfWeek)) return null;
      return { dayOfWeek, zoneName };
    })
    .filter((x): x is RouteScheduleEntry => x != null)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

export default function RepresentativesPage() {
  const { can } = useAuth();
  const { t, locale } = useLocale();
  const dayShort = locale === "ar" ? DAY_SHORT_AR : DAY_SHORT_EN;
  const [reps, setReps] = useState<Rep[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [uploading, setUploading] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [eEmail, setEEmail] = useState("");
  const [eFullName, setEFullName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eCarPlate, setECarPlate] = useState("");
  const [eImagePath, setEImagePath] = useState("");
  const [eIsActive, setEIsActive] = useState(true);
  const [eNewPassword, setENewPassword] = useState("");
  const [eUploading, setEUploading] = useState(false);
  const [scheduleRep, setScheduleRep] = useState<{ id: number; name: string } | null>(null);
  const [routeZones, setRouteZones] = useState<RouteZoneOption[]>([]);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const canFillCar = can("fill_car.read") || can("reps.read");

  async function loadRepSchedule(repId: number) {
    setScheduleLoading(true);
    try {
      const { data } = await api.get<{ schedule: ScheduleRow[] }>(`/representatives/${repId}/route-schedule`);
      setScheduleRows(data.schedule);
      const { data: zonesData } = await api.get<{ routeZones: RouteZoneOption[] }>("/route-zones", {
        params: { representativeId: repId },
      });
      setRouteZones(
        mergeScheduleZones(zonesData.routeZones.filter((x) => x.isActive), data.schedule)
      );
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.repSchedule.loadFailed));
      setScheduleRows([]);
      setRouteZones([]);
    } finally {
      setScheduleLoading(false);
    }
  }

  function setZoneForDay(dayOfWeek: number, routeZoneId: number | null) {
    setScheduleRows((prev) =>
      prev.map((r) =>
        r.dayOfWeek === dayOfWeek
          ? {
              ...r,
              routeZoneId,
              routeZoneName: routeZones.find((z) => z.id === routeZoneId)?.name ?? null,
            }
          : r
      )
    );
  }

  async function saveRepSchedule(repId: number) {
    await api.put(`/representatives/${repId}/route-schedule`, {
      entries: scheduleRows.map((r) => ({ dayOfWeek: r.dayOfWeek, routeZoneId: r.routeZoneId })),
    });
  }

  async function load() {
    const r = await api.get<{ representatives: Rep[] }>("/representatives");
    setReps(r.data.representatives);
  }

  async function toggleRepActive(r: Rep) {
    if (!can("reps.write")) return;
    try {
      await api.patch(`/representatives/${r.id}`, { isActive: !r.is_active });
      await load();
      toastSuccess(r.is_active ? t.reps.deactivated : t.reps.activated);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.reps.loadFailed));
    }
  }

  useEffect(() => {
    void load().catch(() => toastError(t.reps.loadFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  async function onPickPhoto(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadAdminImage(file);
      setImagePath(path);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.reps.loadFailed));
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
      toastError(pickAxiosErrorMessage(e, t.reps.loadFailed));
    } finally {
      setEUploading(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/representatives", {
        email,
        password,
        fullName,
        phone,
        carPlate: carPlate || undefined,
        imageUrl: imagePath || undefined,
      });
      setEmail("");
      setPassword("");
      setFullName("");
      setPhone("");
      setCarPlate("");
      setImagePath("");
      await load();
      toastSuccess(t.reps.created);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.reps.createFailed));
    }
  }

  function openEdit(r: Rep) {
    setEditId(r.id);
    setEEmail(r.email);
    setEFullName(r.full_name);
    setEPhone(r.phone);
    setECarPlate(r.car_plate ?? "");
    setEImagePath(r.image_url ?? "");
    setEIsActive(r.is_active);
    setENewPassword("");
    void loadRepSchedule(r.id);
  }

  function closeEdit() {
    setEditId(null);
    setENewPassword("");
    setScheduleRows([]);
  }

  async function saveEdit() {
    if (editId == null) return;
    try {
      await api.patch(`/representatives/${editId}`, {
        email: eEmail,
        fullName: eFullName,
        phone: ePhone,
        carPlate: eCarPlate.trim() || null,
        imageUrl: eImagePath === "" ? null : eImagePath || undefined,
        isActive: eIsActive,
        newPassword: eNewPassword.trim().length >= 10 ? eNewPassword.trim() : undefined,
      });
      await saveRepSchedule(editId);
      closeEdit();
      await load();
      toastSuccess(t.reps.updated);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.reps.saveFailed));
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
    try {
      await api.delete(`/representatives/${id}`);
      if (editId === id) closeEdit();
      await load();
      toastSuccess(t.reps.deleted);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.reps.deleteFailed));
    }
  }

  function formatScheduleCell(r: Rep) {
    const entries = normalizeSchedule(r.route_schedule).filter((e) => e.zoneName);
    if (!entries.length) return "";
    return entries.map((e) => `${dayShort[e.dayOfWeek] ?? e.dayOfWeek}: ${e.zoneName}`).join(" · ");
  }

  const repFilterFields = useMemo(
    () => [
      { id: "name", label: t.reps.colName, type: "text" as const, getValue: (r: Rep) => r.full_name },
      { id: "email", label: t.reps.colEmail, type: "text" as const, getValue: (r: Rep) => r.email },
      { id: "phone", label: t.reps.phone, type: "text" as const, getValue: (r: Rep) => r.phone },
      { id: "car", label: t.reps.colCar, type: "text" as const, getValue: (r: Rep) => r.car_plate },
      { id: "schedule", label: t.reps.colSchedule, type: "text" as const, getValue: (r: Rep) => formatScheduleCell(r) },
      { id: "active", label: t.reps.colActive, type: "boolean" as const, getValue: (r: Rep) => r.is_active },
    ],
    [t.reps.colActive, t.reps.colCar, t.reps.colEmail, t.reps.colName, t.reps.colSchedule, t.reps.phone, dayShort]
  );

  const repTable = useTableFilters(reps, {
    searchAccessors: [
      "full_name",
      "email",
      "phone",
      "car_plate",
      (r) => formatScheduleCell(r),
    ],
    fields: repFilterFields,
  });
  const repPgn = repTable.pagination;

  const write = can("reps.write");

  return (
    <div className="grid">

      {write && (
        <div className="card">
          <h2>{t.reps.createTitle}</h2>
          <p className="muted small">
            {t.reps.scheduleHint}{" "}
            <Link to="/app/route-zones">{t.nav.routeZones}</Link>
          </p>
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
            <button className="primary" type="submit">
              {t.reps.createBtn}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>{t.reps.titleList}</h2>
        <TableFilterBar
          {...repTable}
          onSearchChange={repTable.setSearch}
          onFilterChange={repTable.setFilter}
          onClear={repTable.clearFilters}
          onToggleFilters={() => repTable.setShowFilters((v) => !v)}
          labels={t.tableFilters}
        />
        {repTable.filteredCount > 0 && (
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
                <th>{t.reps.colSchedule}</th>
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
                  <td className="small">{formatScheduleCell(r) || "—"}</td>
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
                        {can("reps.write") ? (
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => setScheduleRep({ id: r.id, name: r.full_name })}
                          >
                            {t.reps.scheduleBtn}
                          </button>
                        ) : null}
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
          <div className="modal wide card" onClick={(e) => e.stopPropagation()} role="dialog">
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
              <div className="form-section">
                <h4>{t.repSchedule.title}</h4>
                <p className="muted small">{t.reps.scheduleHint}</p>
                <RepRouteScheduleFields
                  zones={routeZones}
                  rows={scheduleRows}
                  loading={scheduleLoading}
                  onChange={setZoneForDay}
                />
              </div>
            </div>
            {canFillCar && (
              <p className="muted small" style={{ marginTop: 16 }}>
                <Link to="/app/fill-car">{t.reps.fillCarLink}</Link>
              </p>
            )}
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

      {scheduleRep != null ? (
        <RepRouteScheduleModal
          repId={scheduleRep.id}
          repName={scheduleRep.name}
          onClose={() => {
            setScheduleRep(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
