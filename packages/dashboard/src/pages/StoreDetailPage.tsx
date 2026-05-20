import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import StoreMap from "../components/StoreMap";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { mediaUrl } from "../lib/mediaUrl";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";
import { qrPayload } from "../utils/qrPayload";

type StoreDetail = {
  id: number;
  name: string;
  phone: string;
  owner_name: string;
  location_lat: number;
  location_lng: number;
  address_text: string | null;
  image_url: string | null;
  area_name: string;
  deferred_payment_enabled: boolean;
  qr_public_token: string;
  owner_portal_token: string;
  registered_by_rep_name: string | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  payment_type: string;
  total_amount: string;
  created_at: string;
  representative_id: number;
  rep_name: string;
};

type VisitRow = { id: string; visited_at: string; note: string | null; rep_name: string };
type PaymentRow = { id: string; amount: string; note: string | null; created_at: string };

function ownerPortalUrl(token: string): string {
  const base = import.meta.env.VITE_OWNER_PORTAL_BASE_URL?.trim().replace(/\/$/, "");
  if (base) return `${base}/owner?t=${encodeURIComponent(token)}`;
  return `${window.location.origin}/owner?t=${encodeURIComponent(token)}`;
}

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { t } = useLocale();
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const canDeleteOrder = can("orders.delete");

  const load = useCallback(async () => {
    if (!id) return;
    setLoadFailed(false);
    try {
      const [storeRes, ordersRes, visitsRes, paymentsRes] = await Promise.all([
        api.get<{ store: StoreDetail }>(`/stores/${id}`),
        api.get<{ orders: OrderRow[] }>("/orders", { params: { storeId: id } }),
        api.get<{ visits: VisitRow[] }>(`/stores/${id}/visits`),
        api.get<{ payments: PaymentRow[] }>(`/stores/${id}/payments`),
      ]);
      setStore(storeRes.data.store);
      setOrders(ordersRes.data.orders);
      setVisits(visitsRes.data.visits);
      setPayments(paymentsRes.data.payments);
    } catch {
      setLoadFailed(true);
      toastError(t.storeDetail.loadFailed);
    }
  }, [id, t.storeDetail.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleDeferred() {
    if (!store) return;
    const next = !store.deferred_payment_enabled;
    await api.patch(`/stores/${store.id}/deferred`, { enabled: next });
    await load();
  }

  async function removeOrder(orderId: string) {
    if (!canDeleteOrder) return;
    const ok = await confirmDanger({
      title: t.orders.deleteTitle,
      text: t.orders.confirmDelete,
      confirmText: t.orders.delete,
      cancelText: t.orders.cancelDelete,
    });
    if (!ok) return;
    try {
      await api.delete(`/orders/${orderId}`);
      await load();
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.orders.deleteFailed));
    }
  }

  async function recordPayment(e: FormEvent) {
    e.preventDefault();
    if (!store) return;
    await api.post(`/stores/${store.id}/payments`, {
      amount: parseFloat(payAmount),
      note: payNote || undefined,
    });
    setPayAmount("");
    setPayNote("");
    setPayOpen(false);
    toastSuccess(t.stores.payDone);
    await load();
  }

  if (loadFailed) {
    return (
      <div className="card">
        <p className="muted">{t.storeDetail.loadFailed}</p>
        <Link to="/app/stores" className="ghost" style={{ marginTop: 12, display: "inline-block" }}>
          {t.storeDetail.back}
        </Link>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="card">
        <p className="muted">{t.storeDetail.loading}</p>
      </div>
    );
  }

  const photo = mediaUrl(store.image_url);
  const portalUrl = ownerPortalUrl(store.owner_portal_token);

  return (
    <div className="grid store-detail">
      <div className="card">
        <div className="row spread" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <Link to="/app/stores" className="muted small" style={{ display: "inline-block", marginBottom: 8 }}>
              ← {t.storeDetail.back}
            </Link>
            <h2 style={{ margin: 0 }}>{store.name}</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              #{store.id} · {store.area_name}
            </p>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {can("stores.deferred_toggle") && (
              <button type="button" className={store.deferred_payment_enabled ? "pill on" : "pill off"} onClick={() => void toggleDeferred()}>
                {store.deferred_payment_enabled ? t.stores.open : t.stores.closed}
              </button>
            )}
            {can("orders.record_payment") && (
              <button type="button" className="primary" onClick={() => setPayOpen(true)}>
                {t.stores.pay}
              </button>
            )}
          </div>
        </div>

        <div className="store-detail-grid">
          <div className="store-detail-info">
            {photo && (
              <img src={photo} alt="" className="store-detail-photo" />
            )}
            <dl className="store-detail-dl">
              <dt>{t.storeDetail.owner}</dt>
              <dd>{store.owner_name}</dd>
              <dt>{t.storeDetail.phone}</dt>
              <dd>{store.phone}</dd>
              {store.address_text && (
                <>
                  <dt>{t.storeDetail.address}</dt>
                  <dd>{store.address_text}</dd>
                </>
              )}
              <dt>{t.storeDetail.coords}</dt>
              <dd className="mono small">
                {Number(store.location_lat).toFixed(5)}, {Number(store.location_lng).toFixed(5)}
              </dd>
              {store.registered_by_rep_name && (
                <>
                  <dt>{t.storeDetail.registeredBy}</dt>
                  <dd>{store.registered_by_rep_name}</dd>
                </>
              )}
              <dt>{t.storeDetail.registeredAt}</dt>
              <dd>{formatMarketDateTime(store.created_at)}</dd>
              <dt>{t.storeDetail.ownerPortal}</dt>
              <dd>
                <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="linkish break-all">
                  {portalUrl}
                </a>
              </dd>
            </dl>
            <div className="store-detail-qr">
              <p className="muted small" style={{ margin: 0 }}>
                {t.stores.colQr}
              </p>
              <QRCodeSVG value={qrPayload(store.qr_public_token)} size={120} level="M" includeMargin={false} />
              <span className="muted small mono break-all">{store.qr_public_token}</span>
            </div>
          </div>
          <div className="store-detail-map-card">
            <p className="muted small" style={{ margin: 0 }}>
              {t.storeDetail.map}
            </p>
            <StoreMap lat={store.location_lat} lng={store.location_lng} variant="large" />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>{t.storeDetail.ordersTitle}</h3>
        {orders.length === 0 ? (
          <p className="muted">{t.storeDetail.noOrders}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.orders.colId}</th>
                  <th>{t.orders.colType}</th>
                  <th>{t.orders.colTotal}</th>
                  <th>{t.storeDetail.rep}</th>
                  <th>{t.orders.colWhen}</th>
                  {canDeleteOrder && <th>{t.orders.colActions}</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{o.payment_type}</td>
                    <td>{o.total_amount}</td>
                    <td>{o.rep_name}</td>
                    <td className="small muted">{formatMarketDateTime(o.created_at)}</td>
                    {canDeleteOrder && (
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
        )}
      </div>

      <div className="card">
        <h3>{t.storeDetail.visitsTitle}</h3>
        {visits.length === 0 ? (
          <p className="muted">{t.storeDetail.noVisits}</p>
        ) : (
          <ul className="simple-list">
            {visits.map((v) => (
              <li key={v.id}>
                <strong>{formatMarketDateTime(v.visited_at)}</strong>
                {v.rep_name ? ` · ${v.rep_name}` : ""}
                {v.note ? <span className="muted"> — {v.note}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>{t.storeDetail.paymentsTitle}</h3>
        {payments.length === 0 ? (
          <p className="muted">{t.storeDetail.noPayments}</p>
        ) : (
          <ul className="simple-list">
            {payments.map((p) => (
              <li key={p.id}>
                <strong>{p.amount}</strong>
                {p.note ? <span className="muted"> — {p.note}</span> : null}
                <span className="muted small"> · {formatMarketDateTime(p.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {payOpen && (
        <div className="modal-backdrop" onClick={() => setPayOpen(false)} role="presentation">
          <div className="modal card" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3>
              {t.stores.payTitle} {store.id}
            </h3>
            <form onSubmit={recordPayment} className="form">
              <label>
                {t.stores.amount}
                <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} type="number" step="0.01" required />
              </label>
              <label>
                {t.stores.note}
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </label>
              <div className="row spread">
                <button type="button" className="ghost" onClick={() => setPayOpen(false)}>
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
