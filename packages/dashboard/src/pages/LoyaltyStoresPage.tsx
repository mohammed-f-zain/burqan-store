import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import LoyaltyIcon from "../components/LoyaltyIcon";
import PaginationBar from "../components/PaginationBar";
import TableFilterBar from "../components/TableFilterBar";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { toastError } from "../lib/toast";

type LoyaltyStore = {
  id: number;
  name: string;
  phone: string;
  owner_name: string;
  area_name: string;
  loyalty_points_balance: number;
};

type SortKey = "balance" | "name" | "owner" | "phone" | "area";

export default function LoyaltyStoresPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [stores, setStores] = useState<LoyaltyStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("balance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ stores: Record<string, unknown>[] }>("/stores");
      const rows = (data.stores ?? [])
        .map((s) => ({
          id: Number(s.id),
          name: String(s.name ?? ""),
          phone: String(s.phone ?? ""),
          owner_name: String(s.owner_name ?? ""),
          area_name: String(s.area_name ?? ""),
          loyalty_points_balance: Number(s.loyalty_points_balance ?? 0),
        }))
        .filter((s) => s.loyalty_points_balance > 0);
      setStores(rows);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.loyaltyStores.loadFailed));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load
  }, []);

  const areaFilterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const s of stores) {
      const n = s.area_name?.trim();
      if (n) names.add(n);
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, "ar"))
      .map((name) => ({ value: name, label: name }));
  }, [stores]);

  const filterFields = useMemo(
    () => [
      { id: "name", label: t.loyaltyStores.colStore, type: "text" as const, getValue: (s: LoyaltyStore) => s.name },
      { id: "owner", label: t.loyaltyStores.colOwner, type: "text" as const, getValue: (s: LoyaltyStore) => s.owner_name },
      { id: "phone", label: t.loyaltyStores.colPhone, type: "text" as const, getValue: (s: LoyaltyStore) => s.phone },
      {
        id: "area",
        label: t.loyaltyStores.colArea,
        type: "searchableSelect" as const,
        getValue: (s: LoyaltyStore) => s.area_name,
        options: areaFilterOptions,
      },
      {
        id: "balance",
        label: t.loyaltyStores.colBalance,
        type: "text" as const,
        getValue: (s: LoyaltyStore) => s.loyalty_points_balance,
      },
    ],
    [areaFilterOptions, t.loyaltyStores.colArea, t.loyaltyStores.colBalance, t.loyaltyStores.colOwner, t.loyaltyStores.colPhone, t.loyaltyStores.colStore]
  );

  const sortedStores = useMemo(() => {
    const list = [...stores];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "balance":
          return (a.loyalty_points_balance - b.loyalty_points_balance) * dir;
        case "name":
          return a.name.localeCompare(b.name, "ar") * dir;
        case "owner":
          return a.owner_name.localeCompare(b.owner_name, "ar") * dir;
        case "phone":
          return a.phone.localeCompare(b.phone, "ar") * dir;
        case "area":
          return a.area_name.localeCompare(b.area_name, "ar") * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [stores, sortKey, sortDir]);

  const table = useTableFilters(sortedStores, {
    searchAccessors: ["name", "owner_name", "phone", "area_name", (s) => s.loyalty_points_balance],
    fields: filterFields,
  });
  const pgn = table.pagination;

  const totalPoints = useMemo(
    () => stores.reduce((sum, s) => sum + s.loyalty_points_balance, 0),
    [stores]
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "balance" ? "desc" : "asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="page-head">
          <div>
            <h2 className="page-head-title">
              <LoyaltyIcon kind="balance" size={26} />
              {t.loyaltyStores.title}
            </h2>
            <p className="muted">{t.loyaltyStores.hint}</p>
          </div>
        </div>

        <div className="dash-kpi-grid dash-kpi-grid--loyalty" style={{ marginBottom: 16 }}>
          <div className="dash-kpi dash-kpi--accent dash-kpi--loyalty">
            <div className="dash-kpi-label">{t.loyaltyStores.statStores}</div>
            <div className="dash-kpi-value">{stores.length}</div>
          </div>
          <div className="dash-kpi dash-kpi--loyalty">
            <div className="dash-kpi-label">
              <LoyaltyIcon kind="star" size={18} />
              {t.loyaltyStores.statTotalBalance}
            </div>
            <div className="dash-kpi-value">{t.overview.loyaltyPoints(totalPoints)}</div>
          </div>
        </div>

        {loading ? (
          <p className="muted">{t.common.loading}</p>
        ) : stores.length === 0 ? (
          <p className="muted">{t.loyaltyStores.empty}</p>
        ) : (
          <>
            <TableFilterBar
              {...table}
              onSearchChange={table.setSearch}
              onFilterChange={table.setFilter}
              onClear={table.clearFilters}
              onToggleFilters={() => table.setShowFilters((v) => !v)}
              pinnedFieldIds={["area"]}
              labels={t.tableFilters}
            />
            {table.filteredCount > 0 && (
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
              />
            )}
            <div className="table-wrap">
              <table className="table table--sortable">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort("name")}>
                        {t.loyaltyStores.colStore}
                        {sortIndicator("name")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort("owner")}>
                        {t.loyaltyStores.colOwner}
                        {sortIndicator("owner")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort("phone")}>
                        {t.loyaltyStores.colPhone}
                        {sortIndicator("phone")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort("area")}>
                        {t.loyaltyStores.colArea}
                        {sortIndicator("area")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort("balance")}>
                        {t.loyaltyStores.colBalance}
                        {sortIndicator("balance")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pgn.slice.map((s) => (
                    <tr
                      key={s.id}
                      className="store-row"
                      onClick={() => navigate(`/app/stores/${s.id}`)}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/app/stores/${s.id}`);
                        }
                      }}
                    >
                      <td className="strong">{s.name}</td>
                      <td>{s.owner_name || "—"}</td>
                      <td dir="ltr" className="mono small">
                        {s.phone || "—"}
                      </td>
                      <td>{s.area_name}</td>
                      <td>
                        <span className="dash-loyalty-inline">
                          <LoyaltyIcon kind="star" size={16} />
                          {t.overview.loyaltyPoints(s.loyalty_points_balance)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {table.filteredCount === 0 && <p className="muted">{t.loyaltyStores.noMatch}</p>}
          </>
        )}
      </div>
    </div>
  );
}
