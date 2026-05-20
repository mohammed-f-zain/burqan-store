import { useEffect, useState } from "react";

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

type OrderDetail = OrderRow & {
  lines: { productId: number; quantity: number; unitPrice: string; lineTotal: string; productName: string }[];
};

export default function OrdersPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const canDelete = can("orders.delete");

  const orderPgn = useClientPagination(orders);
  const orderLines = detail?.lines ?? [];
  const linePgn = useClientPagination(orderLines);

  async function load() {
    const { data } = await api.get<{ orders: OrderRow[] }>("/orders");
    setOrders(data.orders);
  }

  useEffect(() => {
    void load();
  }, []);

  async function open(id: string | number) {
    const { data } = await api.get<{ order: OrderDetail }>(`/orders/${String(id)}`);
    setDetail(data.order);
  }

  async function removeOrder(id: string | number) {
    if (!canDelete) return;
    const ok = await confirmDanger({
      title: t.orders.deleteTitle,
      text: t.orders.confirmDelete,
      confirmText: t.orders.delete,
      cancelText: t.orders.cancelDelete,
    });
    if (!ok) return;
    try {
      await api.delete(`/orders/${String(id)}`);
      setDetail((d) => (d && String(d.id) === String(id) ? null : d));
      await load();
      toastSuccess(t.orders.deleted);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.orders.deleteFailed));
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.orders.title}</h2>
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
                <tr key={o.id}>
                  <td>
                    <button type="button" className="linkish" onClick={() => void open(o.id)}>
                      {o.id}
                    </button>
                  </td>
                  <td>{o.store_name}</td>
                  <td>{o.rep_name}</td>
                  <td>{o.payment_type}</td>
                  <td>{o.total_amount}</td>
                  <td className="small muted">{formatMarketDateTime(o.created_at)}</td>
                  {canDelete && (
                    <td>
                      <button type="button" className="ghost danger" onClick={() => void removeOrder(o.id)}>
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

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)} role="presentation">
          <div className="modal card wide" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3>
              {t.orders.detailTitle} {detail.id}
            </h3>
            <p className="muted">
              {t.orders.colStore}: {detail.store_name} · {t.orders.colRep}: {detail.rep_name} · {detail.payment_type}{" "}
              · {detail.total_amount}
            </p>
            {orderLines.length > 0 && (
              <PaginationBar
                className="pagination-bar--flush"
                page={linePgn.page}
                totalPages={linePgn.totalPages}
                totalItems={linePgn.total}
                from={linePgn.from}
                to={linePgn.to}
                pageSize={linePgn.pageSize}
                pageSizeOptions={linePgn.pageSizeOptions}
                onPageChange={linePgn.setPage}
                onPageSizeChange={linePgn.setPageSize}
              />
            )}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.orders.product}</th>
                    <th>{t.orders.qty}</th>
                    <th>{t.orders.unit}</th>
                    <th>{t.orders.line}</th>
                  </tr>
                </thead>
                <tbody>
                  {linePgn.slice.map((l, i) => (
                    <tr key={i}>
                      <td>{l.productName}</td>
                      <td>{l.quantity}</td>
                      <td>{l.unitPrice}</td>
                      <td>{l.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row spread" style={{ marginTop: 12, gap: 8 }}>
              {canDelete && (
                <button type="button" className="ghost danger" onClick={() => void removeOrder(detail.id)}>
                  {t.orders.delete}
                </button>
              )}
              <button type="button" className="ghost" onClick={() => setDetail(null)}>
                {t.orders.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
