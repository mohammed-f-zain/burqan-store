import { useEffect, useState } from "react";

import { api } from "../api";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";

type OrderRow = {
  id: string;
  representative_id: number;
  store_id: number;
  payment_type: string;
  total_amount: string;
  created_at: string;
};

type OrderDetail = OrderRow & {
  lines: { productId: number; quantity: number; unitPrice: string; lineTotal: string; productName: string }[];
};

export default function OrdersPage() {
  const { t, locale } = useLocale();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [detail, setDetail] = useState<OrderDetail | null>(null);

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
                <th>{t.orders.colType}</th>
                <th>{t.orders.colTotal}</th>
                <th>{t.orders.colWhen}</th>
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
                  <td>{o.store_id}</td>
                  <td>{o.payment_type}</td>
                  <td>{o.total_amount}</td>
                  <td className="small muted">{new Date(o.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}</td>
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
              {t.orders.colStore} {detail.store_id} · {detail.payment_type} · {detail.total_amount}
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
            <button type="button" className="ghost" style={{ marginTop: 12 }} onClick={() => setDetail(null)}>
              {t.orders.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
