import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";

type OrderDetail = {
  id: string;
  representative_id: number;
  store_id: number;
  store_name: string;
  rep_name: string;
  payment_type: string;
  total_amount: string;
  created_at: string;
  lines: { productId: number; quantity: number; unitPrice: string; lineTotal: string; productName: string }[];
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { t } = useLocale();
  const canDelete = can("orders.delete");

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const lines = order?.lines ?? [];
  const linePgn = useClientPagination(lines);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadFailed(false);
    setLoading(true);
    try {
      const { data } = await api.get<{ order: OrderDetail }>(`/orders/${id}`);
      setOrder(data.order);
    } catch {
      setLoadFailed(true);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeOrder() {
    if (!canDelete || !order) return;
    const ok = await confirmDanger({
      title: t.orders.deleteTitle,
      text: t.orders.confirmDelete,
      confirmText: t.orders.delete,
      cancelText: t.orders.cancelDelete,
    });
    if (!ok) return;
    try {
      await api.delete(`/orders/${order.id}`);
      toastSuccess(t.orders.deleted);
      navigate("/app/orders", { replace: true });
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.orders.deleteFailed));
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p className="muted">{t.orderDetail.loading}</p>
      </div>
    );
  }

  if (loadFailed || !order) {
    return (
      <div className="card">
        <p className="muted">{t.orderDetail.loadFailed}</p>
        <Link to="/app/orders" className="ghost" style={{ marginTop: 12, display: "inline-block" }}>
          {t.orderDetail.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid">
      <div className="card">
        <Link to="/app/orders" className="ghost small">
          ← {t.orderDetail.back}
        </Link>
        <h2 style={{ marginTop: 12 }}>
          {t.orders.detailTitle}
          {order.id}
        </h2>

        <dl className="store-detail-dl" style={{ marginTop: 16 }}>
          <div>
            <dt className="muted small">{t.orders.colStore}</dt>
            <dd>
              <Link to={`/app/stores/${order.store_id}`} className="linkish">
                {order.store_name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="muted small">{t.orders.colRep}</dt>
            <dd>{order.rep_name}</dd>
          </div>
          <div>
            <dt className="muted small">{t.orders.colType}</dt>
            <dd>{order.payment_type}</dd>
          </div>
          <div>
            <dt className="muted small">{t.orders.colTotal}</dt>
            <dd className="strong">{order.total_amount}</dd>
          </div>
          <div>
            <dt className="muted small">{t.orders.colWhen}</dt>
            <dd>{formatMarketDateTime(order.created_at)}</dd>
          </div>
        </dl>

        <h3 className="strong" style={{ marginTop: 24 }}>
          {t.orderDetail.linesTitle}
        </h3>
        {lines.length === 0 ? (
          <p className="muted">{t.orderDetail.noLines}</p>
        ) : (
          <>
            {lines.length > 0 && (
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
                  {linePgn.slice.map((l) => (
                    <tr key={l.productId}>
                      <td>{l.productName}</td>
                      <td>{l.quantity}</td>
                      <td>{l.unitPrice}</td>
                      <td>{l.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="row spread" style={{ marginTop: 20, gap: 8 }}>
          {canDelete && (
            <button type="button" className="ghost danger" onClick={() => void removeOrder()}>
              {t.orders.delete}
            </button>
          )}
          <Link to="/app/orders" className="ghost">
            {t.orderDetail.back}
          </Link>
        </div>
      </div>
    </div>
  );
}
