import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import TableFilterBar from "../components/TableFilterBar";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";

type Prospect = {
  id: number;
  name: string;
  phone: string;
  owner_name: string;
  area_name: string;
  address_text: string | null;
  status: string;
  created_by_rep_name: string;
  converted_store_id: number | null;
  converted_store_name: string | null;
  last_visit_note: string | null;
  dismiss_reason: string | null;
  created_at: string;
};

export default function PossibleClientsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { t } = useLocale();
  const canWrite = can("stores.write");
  const [statusFilter, setStatusFilter] = useState<"open" | "converted" | "dismissed" | "all">("open");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter === "all" ? {} : { status: statusFilter };
      const { data } = await api.get<{ prospects: Prospect[] }>("/prospect-stores", { params });
      setProspects(data.prospects ?? []);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.prospects.loadFailed));
      setProspects([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t.prospects.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const areaOptions = useMemo(() => {
    const names = new Set<string>();
    for (const p of prospects) {
      const n = p.area_name?.trim();
      if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "ar")).map((name) => ({ value: name, label: name }));
  }, [prospects]);

  const filterFields = useMemo(
    () => [
      { id: "name", label: t.prospects.colName, type: "text" as const, getValue: (p: Prospect) => p.name },
      { id: "phone", label: t.prospects.colPhone, type: "text" as const, getValue: (p: Prospect) => p.phone },
      { id: "owner", label: t.prospects.colOwner, type: "text" as const, getValue: (p: Prospect) => p.owner_name },
      {
        id: "area",
        label: t.prospects.colArea,
        type: "searchableSelect" as const,
        getValue: (p: Prospect) => p.area_name,
        options: areaOptions,
      },
      { id: "rep", label: t.prospects.colRep, type: "text" as const, getValue: (p: Prospect) => p.created_by_rep_name },
      {
        id: "status",
        label: t.prospects.colStatus,
        type: "text" as const,
        getValue: (p: Prospect) => statusLabel(p.status, t),
      },
      {
        id: "reason",
        label: t.prospects.colReason,
        type: "text" as const,
        getValue: (p: Prospect) => prospectReasonText(p, t),
      },
    ],
    [areaOptions, t]
  );

  const table = useTableFilters(prospects, {
    searchAccessors: [
      "id",
      "name",
      "phone",
      "owner_name",
      "area_name",
      "created_by_rep_name",
      "address_text",
      (p) => statusLabel(p.status, t),
      (p) => p.converted_store_name ?? "",
      (p) => prospectReasonText(p, t),
    ],
    fields: filterFields,
  });
  const pgn = table.pagination;

  async function dismiss(id: number) {
    if (!canWrite) return;
    const ok = await confirmDanger({
      title: t.prospects.dismissTitle,
      text: t.prospects.dismissConfirm,
      confirmText: t.prospects.dismiss,
      cancelText: t.stores.cancel,
    });
    if (!ok) return;
    try {
      await api.patch(`/prospect-stores/${id}`, { status: "dismissed" });
      toastSuccess(t.prospects.dismissed);
      await load();
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.prospects.dismissFailed));
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.prospects.title}</h2>
        <p className="muted small">{t.prospects.hint}</p>
        <p className="muted small">{t.prospects.rowHint}</p>

        <div className="form row spread" style={{ alignItems: "flex-end", gap: 12, marginTop: 12 }}>
          <label style={{ flex: "0 1 220px" }}>
            {t.prospects.statusFilter}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="open">{t.prospects.statusOpen}</option>
              <option value="converted">{t.prospects.statusConverted}</option>
              <option value="dismissed">{t.prospects.statusDismissed}</option>
              <option value="all">{t.prospects.statusAll}</option>
            </select>
          </label>
          <button type="button" className="secondary" disabled={loading} onClick={() => void load()}>
            {loading ? t.common.loading : t.prospects.refresh}
          </button>
        </div>

        {loading ? <p className="muted">{t.common.loading}</p> : null}

        {!loading && prospects.length > 0 && (
          <TableFilterBar
            {...table}
            onSearchChange={table.setSearch}
            onFilterChange={table.setFilter}
            onClear={table.clearFilters}
            onToggleFilters={() => table.setShowFilters((v) => !v)}
            labels={t.tableFilters}
          />
        )}

        {!loading && table.filteredCount > 0 && (
          <PaginationBar
            className="pagination-bar--flush"
            page={pgn.page}
            totalPages={pgn.totalPages}
            totalItems={pgn.total}
            from={pgn.from}
            to={pgn.to}
            pageSize={pgn.pageSize}
            pageSizeOptions={pgn.pageSizeOptions}
            onPageChange={pgn.setPage}
            onPageSizeChange={pgn.setPageSize}
            labels={t.pagination}
          />
        )}

        {!loading && prospects.length === 0 ? <p className="muted">{t.prospects.empty}</p> : null}
        {!loading && prospects.length > 0 && table.filteredCount === 0 ? (
          <p className="muted">{t.tableFilters.noResults}</p>
        ) : null}

        {!loading && pgn.slice.length > 0 ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t.prospects.colName}</th>
                  <th>{t.prospects.colPhone}</th>
                  <th>{t.prospects.colOwner}</th>
                  <th>{t.prospects.colArea}</th>
                  <th>{t.prospects.colRep}</th>
                  <th>{t.prospects.colStatus}</th>
                  <th>{t.prospects.colReason}</th>
                  <th>{t.prospects.colCreated}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pgn.slice.map((p) => (
                  <tr
                    key={p.id}
                    className="store-row"
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/app/possible-clients/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/app/possible-clients/${p.id}`);
                      }
                    }}
                  >
                    <td>
                      <strong>{p.name}</strong>
                      {p.address_text ? <div className="muted small">{p.address_text}</div> : null}
                    </td>
                    <td>{p.phone}</td>
                    <td>{p.owner_name}</td>
                    <td>{p.area_name}</td>
                    <td>{p.created_by_rep_name}</td>
                    <td>
                      <span className={`status-pill status-pill--${p.status}`}>
                        {statusLabel(p.status, t)}
                      </span>
                      {p.converted_store_id ? (
                        <div className="muted small">
                          <Link to={`/app/stores/${p.converted_store_id}`} className="linkish">
                            {p.converted_store_name ?? `#${p.converted_store_id}`}
                          </Link>
                        </div>
                      ) : null}
                    </td>
                    <td className="muted small">{prospectReasonText(p, t)}</td>
                    <td className="muted small">{formatMarketDateTime(p.created_at)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {canWrite && p.status === "open" ? (
                        <button type="button" className="ghost danger" onClick={() => void dismiss(p.id)}>
                          {t.prospects.dismiss}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function prospectReasonText(
  p: Prospect,
  t: { prospects: { noReason: string } }
): string {
  if (p.status === "dismissed" && p.dismiss_reason?.trim()) return p.dismiss_reason.trim();
  if (p.last_visit_note?.trim()) return p.last_visit_note.trim();
  return t.prospects.noReason;
}

function statusLabel(status: string, t: { prospects: { statusOpen: string; statusConverted: string; statusDismissed: string } }) {
  if (status === "open") return t.prospects.statusOpen;
  if (status === "converted") return t.prospects.statusConverted;
  if (status === "dismissed") return t.prospects.statusDismissed;
  return status;
}
