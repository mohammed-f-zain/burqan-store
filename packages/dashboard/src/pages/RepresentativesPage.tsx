import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";
import { uploadAdminImage } from "../lib/uploadAdmin";

type Rep = {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  is_active: boolean;
  area_ids: number[];
  image_url: string | null;
};
type Area = { id: number; name: string };

export default function RepresentativesPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const [reps, setReps] = useState<Rep[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [imagePath, setImagePath] = useState("");
  const [uploading, setUploading] = useState(false);

  const repPgn = useClientPagination(reps);

  async function load() {
    const [r, a] = await Promise.all([
      api.get<{ representatives: Rep[] }>("/representatives"),
      api.get<{ areas: Area[] }>("/areas"),
    ]);
    setReps(r.data.representatives);
    setAreas(a.data.areas);
  }

  useEffect(() => {
    void load().catch(() => {});
  }, []);

  function toggleArea(id: number) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function onPickPhoto(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadAdminImage(file);
      setImagePath(path);
    } catch (e) {
      alert(e instanceof Error ? e.message : "فشل الرفع");
    } finally {
      setUploading(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await api.post("/representatives", {
      email,
      password,
      fullName,
      phone,
      carPlate: carPlate || undefined,
      imageUrl: imagePath || undefined,
      areaIds: picked.length ? picked : [areas[0]?.id].filter(Boolean),
    });
    setEmail("");
    setPassword("");
    setFullName("");
    setPhone("");
    setCarPlate("");
    setPicked([]);
    setImagePath("");
    await load();
    alert(t.reps.created);
  }

  return (
    <div className="grid">
      {can("reps.write") && (
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
                <th>{t.reps.colAreas}</th>
              </tr>
            </thead>
            <tbody>
              {repPgn.slice.map((r) => (
                <tr key={r.id}>
                  <td>{r.full_name}</td>
                  <td>{r.email}</td>
                  <td className="mono small">{JSON.stringify(r.area_ids)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
