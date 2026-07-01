import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import LoyaltyIcon from "../components/LoyaltyIcon";
import PaginationBar from "../components/PaginationBar";
import TableFilterBar from "../components/TableFilterBar";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { toastError, toastSuccess } from "../lib/toast";
import { formatMarketDate } from "../utils/formatMarketDateTime";

type LoyaltyStore = {
  id: number;
  name: string;
  phone: string;
  owner_name: string;
  area_name: string;
  loyalty_points_balance: number;
  first_loyalty_purchase_at: string | null;
  loyalty_period_started_at: string | null;
  days_remaining: number | null;
  would_expire_now: boolean;
  period_mismatch: boolean;
};

type SortKey = "balance" | "name" | "owner" | "phone" | "area" | "daysLeft" | "firstPurchase";

export default function LoyaltyStoresPage() {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [stores, setStores] = useState<LoyaltyStore[]>([]);
  const [expiryDays, setExpiryDays] = useState(120);
  const [expiryDraft, setExpiryDraft] = useState("120");
  const [wouldExpireCount, setWouldExpireCount] = useState(0);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("balance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{
        expiryDays: number;
        stores: {
          storeId: number;
          storeName: string;
          ownerName: string;
          phone: string;
          areaName: string;
          balance: number;
          firstLoyaltyPurchaseAt: string | null;
          periodStartedAt: string | null;
          daysRemaining: number | null;
          wouldExpireNow: boolean;
          periodMismatch: boolean;
        }[];
      }>("/loyalty/period-audit");
      const days = data.expiryDays ?? 120;
      setExpiryDays(days);
      setExpiryDraft(String(days));
      const rows = (data.stores ?? [])
        .filter((s) => s.balance > 0)
        .map((s) => ({
          id: s.storeId,
          name: s.storeName,
          phone: s.phone,
          owner_name: s.ownerName,
          area_name: s.areaName,
          loyalty_points_balance: s.balance,
          first_loyalty_purchase_at: s.firstLoyaltyPurchaseAt,
          loyalty_period_started_at: s.periodStartedAt,
          days_remaining: s.daysRemaining,
          would_expire_now: s.wouldExpireNow,
          period_mismatch: s.periodMismatch,
        }));
      setStores(rows);
      setWouldExpireCount(rows.filter((s) => s.would_expire_now).length);
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

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(expiryDraft, 10);
    if (!Number.isFinite(n) || n < 1 || n > 3650) {
      toastError(t.loyaltyStores.settingsInvalid);
      return;
    }
    setSettingsSaving(true);
    try {
      const { data } = await api.patch<{ expiryDays: number }>("/loyalty/settings", { expiryDays: n });
      setExpiryDays(data.expiryDays);
      setExpiryDraft(String(data.expiryDays));
      toastSuccess(t.loyaltyStores.settingsSaved);
      await load();
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.loyaltyStores.settingsSaveFailed));
    } finally {
      setSettingsSaving(false);
    }
  }

  async function syncPeriods() {
    setSyncing(true);
    try {
      const { data } = await api.post<{ updated: number }>("/loyalty/sync-periods");
      toastSuccess(t.loyaltyStores.syncPeriodsDone(data.updated ?? 0));
      await load();
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.loyaltyStores.syncPeriodsFailed));
    } finally {
      setSyncing(false);
    }
  }

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
        case "daysLeft": {
          const da = a.days_remaining ?? 9999;
          const db = b.days_remaining ?? 9999;
          return (da - db) * dir;
        }
        case "firstPurchase": {
          const da = a.first_loyalty_purchase_at ? new Date(a.first_loyalty_purchase_at).getTime() : 0;
          const db = b.first_loyalty_purchase_at ? new Date(b.first_loyalty_purchase_at).getTime() : 0;
          return (da - db) * dir;
        }
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
      setSortDir(key === "balance" || key === "daysLeft" ? "desc" : "asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return formatMarketDate(iso, locale);
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

        <section className="loyalty-settings-card" aria-labelledby="loyalty-settings-title">
          <div className="loyalty-settings-card-head">
            <h3 id="loyalty-settings-title" className="loyalty-settings-title">
              <LoyaltyIcon kind="star" size={20} />
              {t.loyaltyStores.settingsTitle}
            </h3>
            <p className="muted loyalty-settings-hint">{t.loyaltyStores.settingsHint}</p>
          </div>
          <form className="loyalty-settings-form" onSubmit={(e) => void saveSettings(e)}>
            <label className="loyalty-settings-field">
              <span className="loyalty-settings-label">{t.loyaltyStores.settingsDaysLabel}</span>
              <span className="loyalty-settings-input-wrap">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  className="loyalty-settings-input"
                  value={expiryDraft}
                  onChange={(e) => setExpiryDraft(e.target.value)}
                  disabled={settingsSaving || syncing}
                />
                <span className="loyalty-settings-unit">{t.loyaltyStores.settingsDaysUnit}</span>
              </span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={settingsSaving || syncing}>
              {settingsSaving ? t.common.loading : t.loyaltyStores.settingsSave}
            </button>
            <button type="button" className="btn btn-secondary" disabled={syncing || settingsSaving} onClick={() => void syncPeriods()}>
              {syncing ? t.common.loading : t.loyaltyStores.syncPeriods}
            </button>
          </form>
        </section>

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
          <div className="dash-kpi dash-kpi--loyalty">
            <div className="dash-kpi-label">{t.loyaltyStores.statExpiryDays}</div>
            <div className="dash-kpi-value">
              {expiryDays} {t.loyaltyStores.settingsDaysUnit}
            </div>
          </div>
          {wouldExpireCount > 0 && (
            <div className="dash-kpi dash-kpi--loyalty loyalty-kpi--danger">
              <div className="dash-kpi-label">{t.loyaltyStores.statWouldExpire}</div>
              <div className="dash-kpi-value">{wouldExpireCount}</div>
            </div>
          )}
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
                      <button type="button" className="th-sort" onClick={() => toggleSort("firstPurchase")}>
                        {t.loyaltyStores.colFirstPurchase}
                        {sortIndicator("firstPurchase")}
                      </button>
                    </th>
                    <th>{t.loyaltyStores.colPeriodStart}</th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort("balance")}>
                        {t.loyaltyStores.colBalance}
                        {sortIndicator("balance")}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort("daysLeft")}>
                        {t.loyaltyStores.colDaysLeft}
                        {sortIndicator("daysLeft")}
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
                      <td className="small">{formatDate(s.first_loyalty_purchase_at)}</td>
                      <td className="small">
                        {formatDate(s.loyalty_period_started_at)}
                        {s.period_mismatch ? (
                          <span className="loyalty-mismatch-pill">{t.loyaltyStores.periodMismatch}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className="dash-loyalty-inline">
                          <LoyaltyIcon kind="star" size={16} />
                          {t.overview.loyaltyPoints(s.loyalty_points_balance)}
                        </span>
                      </td>
                      <td>
                        {s.days_remaining != null ? (
                          <span
                            className={`loyalty-days-pill${
                              s.would_expire_now || s.days_remaining <= 14 ? " loyalty-days-pill--warn" : ""
                            }`}
                          >
                            {s.would_expire_now ? t.loyaltyStores.wouldExpireBadge : t.loyaltyStores.daysLeft(s.days_remaining)}
                          </span>
                        ) : (
                          "—"
                        )}
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
