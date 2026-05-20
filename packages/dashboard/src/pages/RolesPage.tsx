import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import { PERMISSION_KEYS } from "../constants/permissions";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";

type Role = { id: number; name: string; slug: string; permissions: string[] };

export default function RolesPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const rolePgn = useClientPagination(roles);

  async function load() {
    const { data } = await api.get<{ roles: Role[] }>("/roles");
    setRoles(data.roles);
  }

  useEffect(() => {
    void load().catch(() => toastError(t.roles.loadFailed));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once; t only affects error copy
  }, []);

  function togglePerm(p: string) {
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/roles", { name, slug, permissions: selected });
      setName("");
      setSlug("");
      setSelected([]);
      await load();
      toastSuccess(t.roles.created);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.roles.createFailed));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      await api.patch(`/roles/${editing.id}`, { name: editing.name, permissions: editing.permissions });
      setEditing(null);
      await load();
      toastSuccess(t.roles.updated);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.roles.saveFailed));
    }
  }

  async function remove(id: number) {
    const ok = await confirmDanger({
      title: t.roles.deleteTitle,
      text: t.roles.confirmDelete,
      confirmText: t.roles.delete,
      cancelText: t.roles.cancel,
    });
    if (!ok) return;
    try {
      await api.delete(`/roles/${id}`);
      await load();
      toastSuccess(t.roles.deleted);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.roles.saveFailed));
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.roles.title}</h2>
        {can("roles.write") && (
          <form onSubmit={onCreate} className="form grid2">
            <div>
              <label>
                {t.roles.name}
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                {t.roles.slug}
                <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
              </label>
              <p className="muted small" style={{ marginTop: 4 }}>
                {t.roles.slugHint}
              </p>
            </div>
            <div>
              <div className="muted small" style={{ marginBottom: 8 }}>
                {t.roles.perms}
              </div>
              <div className="perm-grid">
                {PERMISSION_KEYS.map((p) => (
                  <label key={p} className="check">
                    <input type="checkbox" checked={selected.includes(p)} onChange={() => togglePerm(p)} />
                    <span>{t.permissionLabels[p] ?? p}</span>
                  </label>
                ))}
              </div>
            </div>
            <button className="primary" type="submit">
              {t.roles.createBtn}
            </button>
          </form>
        )}
      </div>

      <div className="card">
        <h3>{t.roles.listTitle}</h3>
        {roles.length > 0 && (
          <PaginationBar
            className="pagination-bar--flush"
            page={rolePgn.page}
            totalPages={rolePgn.totalPages}
            totalItems={rolePgn.total}
            from={rolePgn.from}
            to={rolePgn.to}
            pageSize={rolePgn.pageSize}
            pageSizeOptions={rolePgn.pageSizeOptions}
            onPageChange={rolePgn.setPage}
            onPageSizeChange={rolePgn.setPageSize}
          />
        )}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.roles.colName}</th>
                <th>{t.roles.colSlug}</th>
                <th>{t.roles.colPerms}</th>
                <th>{t.roles.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {rolePgn.slice.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="mono small">{r.slug}</td>
                  <td className="small">{(r.permissions ?? []).length}</td>
                  <td>
                    {can("roles.write") && (
                      <>
                        <button type="button" className="ghost" onClick={() => setEditing({ ...r, permissions: [...(r.permissions ?? [])] })}>
                          {t.roles.edit}
                        </button>{" "}
                        <button type="button" className="ghost danger" onClick={() => remove(r.id)}>
                          {t.roles.delete}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditing(null)}>
          <div className="modal card" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{t.roles.editTitle}</h3>
            <label>
              {t.roles.name}
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <div className="perm-grid" style={{ marginTop: 12 }}>
              {PERMISSION_KEYS.map((p) => (
                <label key={p} className="check">
                  <input
                    type="checkbox"
                    checked={editing.permissions.includes(p)}
                    onChange={() =>
                      setEditing({
                        ...editing,
                        permissions: editing.permissions.includes(p)
                          ? editing.permissions.filter((x) => x !== p)
                          : [...editing.permissions, p],
                      })
                    }
                  />
                  <span>{t.permissionLabels[p] ?? p}</span>
                </label>
              ))}
            </div>
            <div className="row spread" style={{ marginTop: 16 }}>
              <button type="button" className="ghost" onClick={() => setEditing(null)}>
                {t.roles.cancel}
              </button>
              <button type="button" className="primary" onClick={() => void saveEdit()}>
                {t.roles.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
