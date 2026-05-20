import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";

type Area = { id: number; name: string };

export default function AreasPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const [areas, setAreas] = useState<Area[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const areaPgn = useClientPagination(areas);

  async function load() {
    const { data } = await api.get<{ areas: Area[] }>("/areas");
    setAreas(data.areas);
  }

  useEffect(() => {
    void load().catch(() => toastError(t.areas.addFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/areas", { name: name.trim() });
      setName("");
      await load();
      toastSuccess(t.areas.added);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.areas.addFailed));
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
      await load();
      toastSuccess(t.areas.deleted);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.areas.deleteFailed));
    }
  }

  const write = can("areas.write");

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.areas.title}</h2>
        {write && (
          <form onSubmit={onAdd} className="row spread" style={{ gap: 12, alignItems: "flex-end" }}>
            <label style={{ flex: 1 }}>
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
        <div className="table-wrap" style={{ marginTop: areas.length > 0 ? 12 : 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t.areas.colName}</th>
                {write && <th>{t.areas.colActions}</th>}
              </tr>
            </thead>
            <tbody>
              {areaPgn.slice.map((a) => (
                <tr key={a.id}>
                  <td>
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
                  </td>
                  {write && (
                    <td>
                      {editingId === a.id ? (
                        <div className="row spread" style={{ gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="primary" onClick={() => void saveEdit()}>
                            {t.areas.save}
                          </button>
                          <button type="button" className="ghost" onClick={cancelEdit}>
                            {t.areas.cancel}
                          </button>
                        </div>
                      ) : (
                        <div className="row spread" style={{ gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="ghost" onClick={() => startEdit(a)}>
                            {t.areas.edit}
                          </button>
                          <button type="button" className="ghost danger" onClick={() => void remove(a.id)}>
                            {t.areas.delete}
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
