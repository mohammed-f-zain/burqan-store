import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

  const orderFilterFields = useMemo(
    () => [
      { id: "id", label: t.orders.colId, type: "text" as const, getValue: (o: OrderRow) => o.id },
      { id: "store", label: t.orders.colStore, type: "text" as const, getValue: (o: OrderRow) => o.store_name },
      { id: "rep", label: t.orders.colRep, type: "text" as const, getValue: (o: OrderRow) => o.rep_name },
      { id: "type", label: t.orders.colType, type: "text" as const, getValue: (o: OrderRow) => o.payment_type },
      { id: "total", label: t.orders.colTotal, type: "text" as const, getValue: (o: OrderRow) => o.total_amount },
      { id: "when", label: t.orders.colWhen, type: "text" as const, getValue: (o: OrderRow) => formatMarketDateTime(o.created_at) },
    ],
    [t.orders.colId, t.orders.colRep, t.orders.colStore, t.orders.colTotal, t.orders.colType, t.orders.colWhen]
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
          labels={t.tableFilters}
        />
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
                  <td>{o.payment_type}</td>
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
