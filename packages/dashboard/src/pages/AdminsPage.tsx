import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";

type Admin = {
  id: number;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  is_active: boolean;
  role_id: number | null;
};
type Role = { id: number; name: string };

export default function AdminsPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const adminPgn = useClientPagination(admins);

  async function load() {
    const [a, r] = await Promise.all([api.get<{ admins: Admin[] }>("/accounts"), api.get<{ roles: Role[] }>("/roles")]);
    setAdmins(a.data.admins);
    setRoles(r.data.roles);
  }

  useEffect(() => {
    void load().catch(() => setMsg(t.admins.loadFailed));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    await api.post("/accounts", {
      email,
      password,
      fullName,
      roleId: parseInt(roleId, 10),
    });
    setEmail("");
    setPassword("");
    setFullName("");
    setRoleId("");
    await load();
    setMsg(t.admins.created);
  }

  async function toggleActive(a: Admin) {
    if (a.is_super_admin) return;
    await api.patch(`/accounts/${a.id}`, { isActive: !a.is_active });
    await load();
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.admins.title}</h2>
        {msg && (
          <p className="muted">
            {t.admins.msg} {msg}
          </p>
        )}
        {can("admins.write") && (
          <form onSubmit={onCreate} className="form">
            <h3 className="strong" style={{ marginBottom: 8 }}>
              {t.admins.createTitle}
            </h3>
            <label>
              {t.admins.email}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </label>
            <label>
              {t.admins.password}
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={10} required />
            </label>
            <label>
              {t.admins.fullName}
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label>
              {t.admins.role}
              <select value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
                <option value="">{t.admins.rolePick}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary" type="submit">
              {t.admins.createBtn}
            </button>
          </form>
        )}
      </div>
      <div className="card">
        {admins.length > 0 && (
          <PaginationBar
            className="pagination-bar--flush"
            page={adminPgn.page}
            totalPages={adminPgn.totalPages}
            totalItems={adminPgn.total}
            from={adminPgn.from}
            to={adminPgn.to}
            pageSize={adminPgn.pageSize}
            pageSizeOptions={adminPgn.pageSizeOptions}
            onPageChange={adminPgn.setPage}
            onPageSizeChange={adminPgn.setPageSize}
          />
        )}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.admins.colEmail}</th>
                <th>{t.admins.colName}</th>
                <th>{t.admins.colSuper}</th>
                <th>{t.admins.colActive}</th>
              </tr>
            </thead>
            <tbody>
              {adminPgn.slice.map((a) => (
                <tr key={a.id}>
                  <td>{a.email}</td>
                  <td>{a.full_name}</td>
                  <td>{a.is_super_admin ? t.products.yes : "—"}</td>
                  <td>
                    {a.is_super_admin ? (
                      "—"
                    ) : (
                      <button type="button" className={a.is_active ? "pill on" : "pill off"} onClick={() => void toggleActive(a)}>
                        {a.is_active ? t.admins.active : t.admins.disabled}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
