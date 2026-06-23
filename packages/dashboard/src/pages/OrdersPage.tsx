import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

export default function OrdersPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { t } = useLocale();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const canDelete = can("orders.delete");

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

  const filteredTotalAmount = useMemo(
    () => orderTable.filtered.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0),
    [orderTable.filtered]
  );

  const formatMoney = (n: number) =>
    ownerFormatMoney(n, t.overview.currency);

  function paymentTypeLabel(type: string): string {
    if (type === "cash") return t.overview.payCash;
    if (type === "deferred") return t.overview.payDeferred;
    return type;
  }

  async function load() {
    const { data } = await api.get<{ orders: OrderRow[] }>("/orders");
    setOrders(data.orders);
  }

  useEffect(() => {
    void load();
  }, []);

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
      await load();
      toastSuccess(t.orders.deleted);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.orders.deleteFailed));
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.orders.title}</h2>
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
        {orders.length > 0 && (
          <div className="orders-filter-totals stat-row">
            <div className="stat-pill">
              <span className="muted small">{t.orders.filteredOrders}</span>
              <strong>{orderTable.filteredCount}</strong>
            </div>
            <div className="stat-pill stat-pill--accent">
              <span className="muted small">{t.orders.filteredTotal}</span>
              <strong>{formatMoney(filteredTotalAmount)}</strong>
            </div>
            {orderTable.hasActiveFilters && orderTable.filteredCount !== orders.length ? (
              <span className="muted small orders-filter-totals-hint">
                {t.tableFilters.filteredSummary(orderTable.filteredCount, orders.length)}
              </span>
            ) : null}
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
                  <td>{o.total_amount}</td>
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
      </div>
    </div>
  );
}
