import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import TableFilterBar from "../components/TableFilterBar";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { ownerFormatMoney } from "../owner/ownerFormat";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";

type PageTab = "sales" | "redemptions";

type OrderRow = {
  id: string;
  representative_id: number;
  store_id: number;
  store_name: string;
  rep_name: string;
  payment_type: string;
  total_amount: string;
  created_at: string;
};

type OrderSummary = {
  totalCount: number;
  totalRevenue: number;
  monthOrderCount: number;
  monthRevenue: number;
};

type RedemptionRow = {
  id: string;
  createdAt: string;
  totalPointsSpent: number;
  storeId: number;
  storeName: string;
  repName: string;
  lines: {
    productName: string;
    quantity: number;
    pointsSpent: number;
  }[];
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { t, locale } = useLocale();
  const [pageTab, setPageTab] = useState<PageTab>("sales");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const canDelete = can("orders.delete");
  const canRedeemRead = can("redeem.read");
  const canRedeemDelete = can("redeem.write") || can("orders.delete");

  const repFilterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const o of orders) {
      const n = o.rep_name?.trim();
      if (n) names.add(n);
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, "ar"))
      .map((name) => ({ value: name, label: name }));
  }, [orders]);

  const paymentTypeOptions = useMemo(
    () => [
      { value: "cash", label: t.overview.payCash },
      { value: "deferred", label: t.overview.payDeferred },
    ],
    [t.overview.payCash, t.overview.payDeferred]
  );

  const orderFilterFields = useMemo(
    () => [
      { id: "id", label: t.orders.colId, type: "text" as const, getValue: (o: OrderRow) => o.id },
      { id: "store", label: t.orders.colStore, type: "text" as const, getValue: (o: OrderRow) => o.store_name },
      {
        id: "rep",
        label: t.orders.colRep,
        type: "searchableSelect" as const,
        getValue: (o: OrderRow) => o.rep_name,
        options: repFilterOptions,
      },
      {
        id: "type",
        label: t.orders.colType,
        type: "select" as const,
        getValue: (o: OrderRow) => o.payment_type,
        options: paymentTypeOptions,
      },
      { id: "total", label: t.orders.colTotal, type: "text" as const, getValue: (o: OrderRow) => o.total_amount },
      {
        id: "dateFrom",
        label: t.orders.dateFrom,
        type: "dateFrom" as const,
        getValue: (o: OrderRow) => o.created_at,
      },
      {
        id: "dateTo",
        label: t.orders.dateTo,
        type: "dateTo" as const,
        getValue: (o: OrderRow) => o.created_at,
      },
    ],
    [
      paymentTypeOptions,
      repFilterOptions,
      t.orders.colId,
      t.orders.colRep,
      t.orders.colStore,
      t.orders.colTotal,
      t.orders.colType,
      t.orders.dateFrom,
      t.orders.dateTo,
    ]
  );

  const orderTable = useTableFilters(orders, {
    searchAccessors: [
      "id",
      "store_name",
      "rep_name",
      "payment_type",
      "total_amount",
      (o) => formatMarketDateTime(o.created_at),
    ],
    fields: orderFilterFields,
  });
  const orderPgn = orderTable.pagination;

  const redemptionFilterFields = useMemo(
    () => [
      { id: "id", label: t.orders.colId, type: "text" as const, getValue: (r: RedemptionRow) => r.id },
      { id: "store", label: t.orders.colStore, type: "text" as const, getValue: (r: RedemptionRow) => r.storeName },
      { id: "rep", label: t.orders.colRep, type: "text" as const, getValue: (r: RedemptionRow) => r.repName },
      {
        id: "points",
        label: t.orders.colPoints,
        type: "text" as const,
        getValue: (r: RedemptionRow) => r.totalPointsSpent,
      },
      {
        id: "products",
        label: t.orders.colProducts,
        type: "text" as const,
        getValue: (r: RedemptionRow) => r.lines.map((l) => l.productName).join(", "),
      },
      {
        id: "dateFrom",
        label: t.orders.dateFrom,
        type: "dateFrom" as const,
        getValue: (r: RedemptionRow) => r.createdAt,
      },
      {
        id: "dateTo",
        label: t.orders.dateTo,
        type: "dateTo" as const,
        getValue: (r: RedemptionRow) => r.createdAt,
      },
    ],
    [
      t.orders.colId,
      t.orders.colPoints,
      t.orders.colProducts,
      t.orders.colRep,
      t.orders.colStore,
      t.orders.dateFrom,
      t.orders.dateTo,
    ]
  );

  const redemptionTable = useTableFilters(redemptions, {
    searchAccessors: [
      "id",
      "storeName",
      "repName",
      "totalPointsSpent",
      (r) => formatMarketDateTime(r.createdAt, locale),
      (r) => r.lines.map((l) => `${l.productName} ${l.quantity}`).join(" "),
    ],
    fields: redemptionFilterFields,
  });
  const redemptionPgn = redemptionTable.pagination;

  const filteredTotalAmount = useMemo(
    () => orderTable.filtered.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0),
    [orderTable.filtered]
  );

  const filteredPointsTotal = useMemo(
    () => redemptionTable.filtered.reduce((sum, r) => sum + r.totalPointsSpent, 0),
    [redemptionTable.filtered]
  );

  const formatMoney = (n: number) => ownerFormatMoney(n, t.overview.currency);

  function paymentTypeLabel(type: string): string {
    if (type === "cash") return t.overview.payCash;
    if (type === "deferred") return t.overview.payDeferred;
    return type;
  }

  function formatRedemptionLines(lines: RedemptionRow["lines"]) {
    return lines.map((l) => `${l.productName} ×${l.quantity}`).join(" · ");
  }

  async function loadOrders() {
    const { data } = await api.get<{ orders: OrderRow[]; summary: OrderSummary }>("/orders");
    setOrders(data.orders);
    setSummary(data.summary);
  }

  async function loadRedemptions() {
    if (!canRedeemRead) return;
    setRedemptionsLoading(true);
    try {
      const { data } = await api.get<{ redemptions: RedemptionRow[] }>("/redeem/redemptions", {
        params: { limit: 500 },
      });
      setRedemptions(data.redemptions ?? []);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.orders.redemptionsLoadFailed));
    } finally {
      setRedemptionsLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    if (pageTab === "redemptions" && canRedeemRead) {
      void loadRedemptions();
    }
  }, [pageTab, canRedeemRead]);

  function openOrder(orderId: string) {
    navigate(`/app/orders/${orderId}`);
  }

  async function removeOrder(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!canDelete) return;
    const ok = await confirmDanger({
      title: t.orders.deleteTitle,
      text: t.orders.confirmDelete,
      confirmText: t.orders.delete,
      cancelText: t.orders.cancelDelete,
    });
    if (!ok) return;
    try {
      await api.delete(`/orders/${id}`);
      await loadOrders();
      toastSuccess(t.orders.deleted);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.orders.deleteFailed));
    }
  }

  async function removeRedemption(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!canRedeemDelete) return;
    const ok = await confirmDanger({
      title: t.orders.deleteRedemptionTitle,
      text: t.orders.confirmDeleteRedemption,
      confirmText: t.orders.delete,
      cancelText: t.orders.cancelDelete,
    });
    if (!ok) return;
    try {
      await api.delete(`/redeem/redemptions/${id}`);
      await loadRedemptions();
      toastSuccess(t.orders.deletedRedemption);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.orders.deleteRedemptionFailed));
    }
  }

  const showingFiltered = orderTable.hasActiveFilters;
  const showingRedemptionFiltered = redemptionTable.hasActiveFilters;

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.orders.title}</h2>
        {canRedeemRead ? (
          <div className="orders-page-tabs" role="tablist" aria-label={t.orders.tabsAria}>
            <button
              type="button"
              role="tab"
              aria-selected={pageTab === "sales"}
              className={`orders-page-tab${pageTab === "sales" ? " orders-page-tab--on" : ""}`}
              onClick={() => setPageTab("sales")}
            >
              {t.orders.tabSales}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pageTab === "redemptions"}
              className={`orders-page-tab${pageTab === "redemptions" ? " orders-page-tab--on" : ""}`}
              onClick={() => setPageTab("redemptions")}
            >
              {t.orders.tabRedemptions}
            </button>
          </div>
        ) : null}

        {pageTab === "sales" ? (
          <>
            <p className="muted small">{t.orders.rowHint}</p>
            <TableFilterBar
              {...orderTable}
              onSearchChange={orderTable.setSearch}
              onFilterChange={orderTable.setFilter}
              onClear={orderTable.clearFilters}
              onToggleFilters={() => orderTable.setShowFilters((v) => !v)}
              pinnedFieldIds={["dateFrom", "dateTo", "type", "rep"]}
              labels={t.tableFilters}
            />
            {summary && (
              <div className="orders-filter-totals stat-row">
                <div className="stat-pill">
                  <span className="muted small">
                    {showingFiltered ? t.orders.filteredOrders : t.orders.allOrdersCount}
                  </span>
                  <strong>{showingFiltered ? orderTable.filteredCount : summary.totalCount}</strong>
                </div>
                <div className="stat-pill stat-pill--accent">
                  <span className="muted small">{t.overview.monthRevenue}</span>
                  <strong>{formatMoney(summary.monthRevenue)}</strong>
                  <span className="muted small orders-stat-sub">{t.orders.monthOrdersCount(summary.monthOrderCount)}</span>
                </div>
                <div className="stat-pill">
                  <span className="muted small">
                    {showingFiltered ? t.orders.filteredTotal : t.overview.totalRevenue}
                  </span>
                  <strong>{formatMoney(showingFiltered ? filteredTotalAmount : summary.totalRevenue)}</strong>
                </div>
                {showingFiltered ? (
                  <span className="muted small orders-filter-totals-hint">
                    {t.orders.filteredTotalsHint} · {t.tableFilters.filteredSummary(orderTable.filteredCount, orders.length)}
                  </span>
                ) : (
                  <span className="muted small orders-filter-totals-hint">{t.orders.totalsMatchHome}</span>
                )}
              </div>
            )}
            {orderTable.filteredCount > 0 && (
              <PaginationBar
                className="pagination-bar--flush"
                page={orderPgn.page}
                totalPages={orderPgn.totalPages}
                totalItems={orderPgn.total}
                from={orderPgn.from}
                to={orderPgn.to}
                pageSize={orderPgn.pageSize}
                pageSizeOptions={orderPgn.pageSizeOptions}
                onPageChange={orderPgn.setPage}
                onPageSizeChange={orderPgn.setPageSize}
              />
            )}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.orders.colId}</th>
                    <th>{t.orders.colStore}</th>
                    <th>{t.orders.colRep}</th>
                    <th>{t.orders.colType}</th>
                    <th>{t.orders.colTotal}</th>
                    <th>{t.orders.colWhen}</th>
                    {canDelete && <th>{t.orders.colActions}</th>}
                  </tr>
                </thead>
                <tbody>
                  {orderPgn.slice.map((o) => (
                    <tr
                      key={o.id}
                      className="store-row"
                      onClick={() => openOrder(String(o.id))}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openOrder(String(o.id));
                        }
                      }}
                    >
                      <td className="strong">#{o.id}</td>
                      <td>{o.store_name}</td>
                      <td>{o.rep_name}</td>
                      <td>{paymentTypeLabel(o.payment_type)}</td>
                      <td>{formatMoney(parseFloat(o.total_amount) || 0)}</td>
                      <td className="small muted">{formatMarketDateTime(o.created_at)}</td>
                      {canDelete && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="ghost danger" onClick={(e) => void removeOrder(e, o.id)}>
                            {t.orders.delete}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <p className="muted small">{t.orders.redemptionsHint}</p>
            {redemptionsLoading ? (
              <p className="muted">{t.common.loading}</p>
            ) : (
              <>
                <TableFilterBar
                  {...redemptionTable}
                  onSearchChange={redemptionTable.setSearch}
                  onFilterChange={redemptionTable.setFilter}
                  onClear={redemptionTable.clearFilters}
                  onToggleFilters={() => redemptionTable.setShowFilters((v) => !v)}
                  pinnedFieldIds={["dateFrom", "dateTo", "store", "rep"]}
                  labels={t.tableFilters}
                />
                <div className="orders-filter-totals stat-row">
                  <div className="stat-pill">
                    <span className="muted small">
                      {showingRedemptionFiltered ? t.orders.filteredRedemptions : t.orders.allRedemptionsCount}
                    </span>
                    <strong>
                      {showingRedemptionFiltered ? redemptionTable.filteredCount : redemptions.length}
                    </strong>
                  </div>
                  <div className="stat-pill stat-pill--accent">
                    <span className="muted small">{t.orders.colPoints}</span>
                    <strong>{t.overview.loyaltyPoints(showingRedemptionFiltered ? filteredPointsTotal : redemptions.reduce((s, r) => s + r.totalPointsSpent, 0))}</strong>
                  </div>
                </div>
                {redemptionTable.filteredCount > 0 && (
                  <PaginationBar
                    className="pagination-bar--flush"
                    page={redemptionPgn.page}
                    totalPages={redemptionPgn.totalPages}
                    totalItems={redemptionPgn.total}
                    from={redemptionPgn.from}
                    to={redemptionPgn.to}
                    pageSize={redemptionPgn.pageSize}
                    pageSizeOptions={redemptionPgn.pageSizeOptions}
                    onPageChange={redemptionPgn.setPage}
                    onPageSizeChange={redemptionPgn.setPageSize}
                  />
                )}
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t.orders.colId}</th>
                        <th>{t.orders.colStore}</th>
                        <th>{t.orders.colRep}</th>
                        <th>{t.orders.colProducts}</th>
                        <th>{t.orders.colPoints}</th>
                        <th>{t.orders.colWhen}</th>
                        {canRedeemDelete && <th>{t.orders.colActions}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {redemptionPgn.slice.length === 0 ? (
                        <tr>
                          <td colSpan={canRedeemDelete ? 7 : 6} className="muted">
                            {t.orders.emptyRedemptions}
                          </td>
                        </tr>
                      ) : (
                        redemptionPgn.slice.map((r) => (
                          <tr key={r.id}>
                            <td className="strong">#{r.id}</td>
                            <td>
                              <Link to={`/app/stores/${r.storeId}`} className="linkish" onClick={(e) => e.stopPropagation()}>
                                {r.storeName}
                              </Link>
                            </td>
                            <td>{r.repName}</td>
                            <td className="small">{formatRedemptionLines(r.lines)}</td>
                            <td className="strong">{t.overview.loyaltyPoints(r.totalPointsSpent)}</td>
                            <td className="small muted">{formatMarketDateTime(r.createdAt, locale)}</td>
                            {canRedeemDelete && (
                              <td>
                                <button
                                  type="button"
                                  className="ghost danger"
                                  onClick={(e) => void removeRedemption(e, r.id)}
                                >
                                  {t.orders.delete}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
