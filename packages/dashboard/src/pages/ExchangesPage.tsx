import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import TableFilterBar from "../components/TableFilterBar";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { filtersFromSearchParams } from "../lib/filterTableRows";
import { toastError } from "../lib/toast";
import { ownerFormatMoney } from "../owner/ownerFormat";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";

type ExchangeRow = {
  id: string;
  storeId: number;
  storeName: string;
  representativeId: number;
  repName: string;
  returnTotal: string;
  giveTotal: string;
  cashDifference: string;
  note: string | null;
  createdAt: string;
  returnSummary: string;
  giveSummary: string;
};

type ExchangeDetail = {
  id: string;
  storeId: number;
  storeName: string;
  representativeId: number;
  repName: string;
  returnTotal: string;
  giveTotal: string;
  cashDifference: string;
  note: string | null;
  createdAt: string;
  returnLines: {
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
  giveLines: {
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
};

export default function ExchangesPage() {
  const { can } = useAuth();
  const { t, locale } = useLocale();
  const [searchParams] = useSearchParams();
  const canRead = can("fill_car.read") || can("reps.read") || can("orders.read");
  const [rows, setRows] = useState<ExchangeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExchangeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const currency = t.overview.currency;
  const money = (n: string | number) =>
    ownerFormatMoney(typeof n === "number" ? n : parseFloat(n) || 0, currency);

  const initialFilters = useMemo(
    () => filtersFromSearchParams(searchParams, ["dateFrom", "dateTo", "store", "rep", "id", "cash"]),
    [searchParams]
  );

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const { data } = await api.get<{ exchanges: ExchangeRow[] }>("/exchanges");
      setRows(data.exchanges ?? []);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.exchanges.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [canRead, t.exchanges.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const filterFields = useMemo(
    () => [
      { id: "id", label: t.exchanges.colId, type: "text" as const, getValue: (r: ExchangeRow) => r.id },
      {
        id: "store",
        label: t.exchanges.colStore,
        type: "text" as const,
        getValue: (r: ExchangeRow) => r.storeName,
      },
      {
        id: "rep",
        label: t.exchanges.colRep,
        type: "text" as const,
        getValue: (r: ExchangeRow) => r.repName,
      },
      {
        id: "cash",
        label: t.exchanges.colCash,
        type: "text" as const,
        getValue: (r: ExchangeRow) => r.cashDifference,
      },
      {
        id: "dateFrom",
        label: t.orders.dateFrom,
        type: "dateFrom" as const,
        getValue: (r: ExchangeRow) => r.createdAt,
      },
      {
        id: "dateTo",
        label: t.orders.dateTo,
        type: "dateTo" as const,
        getValue: (r: ExchangeRow) => r.createdAt,
      },
    ],
    [t.exchanges, t.orders.dateFrom, t.orders.dateTo]
  );

  const table = useTableFilters(rows, {
    searchAccessors: [
      "id",
      "storeName",
      "repName",
      "returnSummary",
      "giveSummary",
      "returnTotal",
      "giveTotal",
      "cashDifference",
      "note",
      (r) => formatMarketDateTime(r.createdAt, locale),
    ],
    fields: filterFields,
    initialFilters,
  });
  const pgn = table.pagination;

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const { data } = await api.get<{ exchange: ExchangeDetail }>(`/exchanges/${id}`);
      setDetail(data.exchange);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.exchanges.loadFailed));
      setExpandedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  if (!canRead) {
    return (
      <div className="grid">
        <div className="card">
          <h2>{t.exchanges.title}</h2>
          <p className="muted">{t.exchanges.denied}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="row spread" style={{ alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2>{t.exchanges.title}</h2>
            <p className="muted small">{t.exchanges.hint}</p>
          </div>
          <button type="button" className="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? t.common.loading : t.exchanges.refresh}
          </button>
        </div>

        {!loading && (rows.length > 0 || table.hasActiveFilters) ? (
          <TableFilterBar
            {...table}
            onSearchChange={table.setSearch}
            onFilterChange={table.setFilter}
            onClear={table.clearFilters}
            onToggleFilters={() => table.setShowFilters((v) => !v)}
            pinnedFieldIds={["dateFrom", "dateTo"]}
            labels={t.tableFilters}
          />
        ) : null}

        {loading ? <p className="muted">{t.common.loading}</p> : null}

        {!loading && table.filteredCount === 0 ? <p className="muted">{t.exchanges.empty}</p> : null}

        {!loading && table.filteredCount > 0 ? (
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
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.exchanges.colTime}</th>
                    <th>{t.exchanges.colId}</th>
                    <th>{t.exchanges.colStore}</th>
                    <th>{t.exchanges.colRep}</th>
                    <th>{t.exchanges.colReturn}</th>
                    <th>{t.exchanges.colGive}</th>
                    <th>{t.exchanges.colCash}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pgn.pageItems.map((r) => {
                    const cash = parseFloat(r.cashDifference) || 0;
                    const open = expandedId === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr className={cash > 0 ? "exchange-row--cash" : undefined}>
                          <td>{formatMarketDateTime(r.createdAt, locale)}</td>
                          <td className="mono">{r.id}</td>
                          <td>
                            <Link to={`/app/stores/${r.storeId}`} className="linkish">
                              {r.storeName}
                            </Link>
                          </td>
                          <td>{r.repName}</td>
                          <td>{money(r.returnTotal)}</td>
                          <td>{money(r.giveTotal)}</td>
                          <td>
                            {cash > 0 ? (
                              <span className="exchange-cash-pill">{money(r.cashDifference)}</span>
                            ) : (
                              money(0)
                            )}
                          </td>
                          <td>
                            <button type="button" className="ghost" onClick={() => void toggleExpand(r.id)}>
                              {open ? t.exchanges.hideDetails : t.exchanges.showDetails}
                            </button>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="exchange-detail-row">
                            <td colSpan={8}>
                              {detailLoading || !detail || detail.id !== r.id ? (
                                <p className="muted small">{t.common.loading}</p>
                              ) : (
                                <div className="exchange-detail">
                                  <div className="exchange-detail-cols">
                                    <div>
                                      <h4 className="strong">{t.exchanges.returnLines}</h4>
                                      <ul className="exchange-line-list">
                                        {detail.returnLines.map((l) => (
                                          <li key={`r-${l.productId}`}>
                                            {l.productName} ×{l.quantity} — {money(l.lineTotal)}
                                          </li>
                                        ))}
                                      </ul>
                                      <p className="muted small">
                                        {t.exchanges.colReturn}: {money(detail.returnTotal)}
                                      </p>
                                    </div>
                                    <div>
                                      <h4 className="strong">{t.exchanges.giveLines}</h4>
                                      <ul className="exchange-line-list">
                                        {detail.giveLines.map((l) => (
                                          <li key={`g-${l.productId}`}>
                                            {l.productName} ×{l.quantity} — {money(l.lineTotal)}
                                          </li>
                                        ))}
                                      </ul>
                                      <p className="muted small">
                                        {t.exchanges.colGive}: {money(detail.giveTotal)}
                                      </p>
                                    </div>
                                  </div>
                                  {detail.note ? (
                                    <p className="muted small" style={{ marginTop: 8 }}>
                                      {t.exchanges.note}: {detail.note}
                                    </p>
                                  ) : null}
                                  {cash > 0 ? (
                                    <p className="exchange-cash-note">
                                      {t.exchanges.cashCollected}: {money(detail.cashDifference)}
                                    </p>
                                  ) : null}
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
