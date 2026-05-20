import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
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

  const orderPgn = useClientPagination(orders);

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
        {orders.length > 0 && (
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
