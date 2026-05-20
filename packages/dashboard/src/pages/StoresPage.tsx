import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import StoreMap from "../components/StoreMap";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";
import { toastSuccess } from "../lib/toast";
import { qrPayload } from "../utils/qrPayload";

type Store = {
  id: number;
  name: string;
  phone: string;
  owner_name: string;
  deferred_payment_enabled: boolean;
  area_name: string;
  qr_public_token: string;
  location_lat: number;
  location_lng: number;
};

export default function StoresPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [payStoreId, setPayStoreId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const storePgn = useClientPagination(stores);

  async function load() {
    const { data } = await api.get<{ stores: Store[] }>("/stores");
    setStores(data.stores);
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleDeferred(s: Store) {
    const next = !s.deferred_payment_enabled;
    await api.patch(`/stores/${s.id}/deferred`, { enabled: next });
    await load();
  }

  async function recordPayment(e: FormEvent) {
    e.preventDefault();
    if (!payStoreId) return;
    await api.post(`/stores/${payStoreId}/payments`, {
      amount: parseFloat(payAmount),
      note: payNote || undefined,
    });
    setPayAmount("");
    setPayNote("");
    setPayStoreId(null);
    toastSuccess(t.stores.payDone);
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.stores.title}</h2>
        <p className="muted">{t.stores.hint}</p>
        <p className="muted small">{t.stores.rowHint}</p>
        {stores.length > 0 && (
          <PaginationBar
            className="pagination-bar--flush"
            page={storePgn.page}
            totalPages={storePgn.totalPages}
            totalItems={storePgn.total}
            from={storePgn.from}
            to={storePgn.to}
            pageSize={storePgn.pageSize}
            pageSizeOptions={storePgn.pageSizeOptions}
            onPageChange={storePgn.setPage}
            onPageSizeChange={storePgn.setPageSize}
          />
        )}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.stores.colStore}</th>
                <th>{t.stores.colArea}</th>
                <th>{t.stores.colOwner}</th>
                <th>{t.stores.colLocation}</th>
                <th>{t.stores.colQr}</th>
                <th>{t.stores.colDeferred}</th>
                {can("orders.record_payment") && <th>{t.stores.pay}</th>}
              </tr>
            </thead>
            <tbody>
              {storePgn.slice.map((s) => (
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
                    <div className="strong">{s.name}</div>
                    <div className="muted small">{s.phone}</div>
                  </td>
                  <td>{s.area_name}</td>
                  <td>{s.owner_name}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <StoreMap lat={s.location_lat} lng={s.location_lng} variant="thumb" />
                  </td>
                  <td className="qr-cell qr-cell--stack" onClick={(e) => e.stopPropagation()}>
                    <QRCodeSVG value={qrPayload(s.qr_public_token)} size={72} level="M" includeMargin={false} />
                    <span className="muted small mono break-all" title={s.qr_public_token}>
                      {s.qr_public_token.slice(0, 10)}…
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {can("stores.deferred_toggle") ? (
                      <button type="button" className={s.deferred_payment_enabled ? "pill on" : "pill off"} onClick={() => void toggleDeferred(s)}>
                        {s.deferred_payment_enabled ? t.stores.open : t.stores.closed}
                      </button>
                    ) : s.deferred_payment_enabled ? (
                      t.stores.open
                    ) : (
                      t.stores.closed
                    )}
                  </td>
                  {can("orders.record_payment") && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="ghost" onClick={() => setPayStoreId(s.id)}>
                        {t.stores.pay}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payStoreId != null && (
        <div className="modal-backdrop" onClick={() => setPayStoreId(null)} role="presentation">
          <div className="modal card" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3>
              {t.stores.payTitle} {payStoreId}
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
                <button type="button" className="ghost" onClick={() => setPayStoreId(null)}>
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
