import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";

type Area = { id: number; name: string };

export default function AreasPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const [areas, setAreas] = useState<Area[]>([]);
  const [name, setName] = useState("");

  const areaPgn = useClientPagination(areas);

  async function load() {
    const { data } = await api.get<{ areas: Area[] }>("/areas");
    setAreas(data.areas);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    await api.post("/areas", { name });
    setName("");
    await load();
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.areas.title}</h2>
        {can("areas.write") && (
          <form onSubmit={onAdd} className="row spread" style={{ gap: 12, alignItems: "flex-end" }}>
            <label style={{ flex: 1 }}>
              {t.areas.newLabel}
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <button className="primary" type="submit">
              {t.areas.add}
            </button>
          </form>
        )}
      </div>
      <div className="card">
        {areas.length > 0 && (
          <PaginationBar
            className="pagination-bar--flush"
            page={areaPgn.page}
            totalPages={areaPgn.totalPages}
            totalItems={areaPgn.total}
            from={areaPgn.from}
            to={areaPgn.to}
            pageSize={areaPgn.pageSize}
            pageSizeOptions={areaPgn.pageSizeOptions}
            onPageChange={areaPgn.setPage}
            onPageSizeChange={areaPgn.setPageSize}
          />
        )}
        <ul className="simple-list">
          {areaPgn.slice.map((a) => (
            <li key={a.id}>
              <strong>{a.name}</strong> <span className="muted small">#{a.id}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
