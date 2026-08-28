import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import TableFilterBar from "../components/TableFilterBar";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { toastError, toastSuccess } from "../lib/toast";
import { ownerFormatMoney } from "../owner/ownerFormat";
import { formatMarketDate } from "../utils/formatMarketDateTime";

type DeferredStore = {
  id: number;
  name: string;
  owner_name: string;
  phone: string;
  area_name: string;
  deferred_total: number;
  paid_total: number;
  outstanding: number;
  deferred_order_count: number;
  last_payment_at: string | null;
};

type ApiRow = {
  storeId: number;
  storeName: string;
  ownerName: string;
  phone: string;
  areaName: string;
  deferredTotal: number;
  paidTotal: number;
  outstanding: number;
  deferredOrderCount: number;
  lastPaymentAt: string | null;
};

export default function DeferredStoresPage() {
  const { can } = useAuth();
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const canRead = can("stores.read");
  const canPay = can("orders.record_payment");

  const [stores, setStores] = useState<DeferredStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [owingOnly, setOwingOnly] = useState(true);
  const [payStore, setPayStore] = useState<DeferredStore | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const currency = t.overview.currency;
  const money = (n: number) => ownerFormatMoney(n, currency);

  async function load() {
    if (!canRead) return;
    setLoading(true);
    try {
      const { data } = await api.get<{ stores: ApiRow[] }>("/stores/deferred-balances");
      setStores(
        (data.stores ?? []).map((s) => ({
          id: s.storeId,
          name: s.storeName,
          owner_name: s.ownerName,
          phone: s.phone,
          area_name: s.areaName,
          deferred_total: s.deferredTotal,
          paid_total: s.paidTotal,
          outstanding: s.outstanding,
          deferred_order_count: s.deferredOrderCount,
          last_payment_at: s.lastPaymentAt,
        }))
      );
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.deferredStores.loadFailed));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [canRead]);

  const visible = useMemo(
    () => (owingOnly ? stores.filter((s) => s.outstanding > 0.004) : stores),
    [stores, owingOnly]
  );

  const areaFilterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const s of visible) {
      const n = s.area_name?.trim();
      if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "ar")).map((name) => ({ value: name, label: name }));
  }, [visible]);

  const filterFields = useMemo(
    () => [
      { id: "store", label: t.deferredStores.colStore, type: "text" as const, getValue: (s: DeferredStore) => s.name },
      { id: "owner", label: t.deferredStores.colOwner, type: "text" as const, getValue: (s: DeferredStore) => s.owner_name },
      { id: "phone", label: t.deferredStores.colPhone, type: "text" as const, getValue: (s: DeferredStore) => s.phone },
      {
        id: "area",
        label: t.deferredStores.colArea,
        type: "searchableSelect" as const,
        getValue: (s: DeferredStore) => s.area_name,
        options: areaFilterOptions,
      },
    ],
    [areaFilterOptions, t.deferredStores.colArea, t.deferredStores.colOwner, t.deferredStores.colPhone, t.deferredStores.colStore]
  );

  const table = useTableFilters(visible, {
    searchAccessors: ["name", "owner_name", "phone", "area_name", (s) => s.outstanding, (s) => s.paid_total],
    fields: filterFields,
  });
  const pgn = table.pagination;

  const summary = useMemo(() => {
    const source = visible;
    return {
      storeCount: source.length,
      owingCount: source.filter((s) => s.outstanding > 0.004).length,
      deferredTotal: source.reduce((sum, s) => sum + s.deferred_total, 0),
      paidTotal: source.reduce((sum, s) => sum + s.paid_total, 0),
      outstanding: source.reduce((sum, s) => sum + s.outstanding, 0),
    };
  }, [visible]);

  async function recordPayment(e: FormEvent) {
    e.preventDefault();
    if (!payStore) return;
    const amount = parseFloat(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    try {
      await api.post(`/stores/${payStore.id}/payments`, {
        amount,
        note: payNote.trim() || undefined,
      });
      setPayStore(null);
      setPayAmount("");
      setPayNote("");
      toastSuccess(t.stores.payDone);
      await load();
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.deferredStores.loadFailed));
    }
  }

  if (!canRead) {
    return (
      <div className="card">
        <h2>{t.deferredStores.title}</h2>
        <p className="muted">{t.deferredStores.denied}</p>
      </div>
    );
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="page-head">
          <div>
            <h2>{t.deferredStores.title}</h2>
            <p className="muted">{t.deferredStores.hint}</p>
          </div>
        </div>

        <div className="stat-row deferred-stat-row">
          <div className="stat-pill">
            <span className="muted small">{t.deferredStores.statStores}</span>
            <strong>{summary.storeCount}</strong>
          </div>
          <div className="stat-pill">
            <span className="muted small">{t.deferredStores.statOwing}</span>
            <strong>{summary.owingCount}</strong>
          </div>
          <div className="stat-pill">
            <span className="muted small">{t.deferredStores.statDeferred}</span>
            <strong>{money(summary.deferredTotal)}</strong>
          </div>
          <div className="stat-pill">
            <span className="muted small">{t.deferredStores.statPaid}</span>
            <strong>{money(summary.paidTotal)}</strong>
          </div>
          <div className="stat-pill">
            <span className="muted small">{t.deferredStores.statOutstanding}</span>
            <strong className="text-danger">{money(summary.outstanding)}</strong>
          </div>
        </div>

        <label className="deferred-owing-toggle">
          <input type="checkbox" checked={owingOnly} onChange={(e) => setOwingOnly(e.target.checked)} />
          {t.deferredStores.outstandingOnly}
        </label>

        {loading ? (
          <p className="muted">{t.common.loading}</p>
        ) : stores.length === 0 ? (
          <p className="muted">{t.deferredStores.empty}</p>
        ) : (
          <>
            <TableFilterBar
              {...table}
              onSearchChange={table.setSearch}
              onFilterChange={table.setFilter}
              onClear={table.clearFilters}
              onToggleFilters={() => table.setShowFilters((v) => !v)}
              labels={t.tableFilters}
            />
            {table.filteredCount === 0 ? (
              <p className="muted">{t.deferredStores.noMatch}</p>
            ) : (
              <>
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
                <div className="table-wrap">
                  <table className="table table-clickable">
                    <thead>
                      <tr>
                        <th>{t.deferredStores.colStore}</th>
                        <th>{t.deferredStores.colOwner}</th>
                        <th>{t.deferredStores.colArea}</th>
                        <th>{t.deferredStores.colDeferred}</th>
                        <th>{t.deferredStores.colPaid}</th>
                        <th>{t.deferredStores.colOutstanding}</th>
                        <th>{t.deferredStores.colOrders}</th>
                        <th>{t.deferredStores.colLastPay}</th>
                        {canPay && <th>{t.stores.pay}</th>}
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
                          <td>
                            <strong>{s.name}</strong>
                            {s.phone ? <div className="muted small">{s.phone}</div> : null}
                          </td>
                          <td>{s.owner_name}</td>
                          <td>{s.area_name}</td>
                          <td>{money(s.deferred_total)}</td>
                          <td>{money(s.paid_total)}</td>
                          <td>
                            {s.outstanding > 0.004 ? (
                              <strong className="text-danger">{money(s.outstanding)}</strong>
                            ) : (
                              <span className="muted">{t.deferredStores.settled}</span>
                            )}
                          </td>
                          <td>{s.deferred_order_count}</td>
                          <td className="muted small">
                            {s.last_payment_at ? formatMarketDate(s.last_payment_at, locale) : "—"}
                          </td>
                          {canPay && (
                            <td onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => {
                                  setPayStore(s);
                                  setPayAmount("");
                                  setPayNote("");
                                }}
                              >
                                {t.stores.pay}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {payStore && (
        <div className="modal-backdrop" onClick={() => setPayStore(null)} role="presentation">
          <div className="modal card" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3>
              {t.stores.payTitle} {payStore.name}
            </h3>
            <p className="muted small">
              {t.deferredStores.colOutstanding}: {money(payStore.outstanding)}
            </p>
            <form onSubmit={(e) => void recordPayment(e)} className="form">
              <label>
                {t.stores.amount}
                <input
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  type="number"
                  step="0.01"
                  min={0.01}
                  required
                />
              </label>
              <label>
                {t.stores.note}
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </label>
              <div className="row spread">
                <button type="button" className="ghost" onClick={() => setPayStore(null)}>
                  {t.stores.cancel}
                </button>
                <button type="submit" className="primary">
                  {t.stores.submitPay}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
