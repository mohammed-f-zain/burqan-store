import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useLocale } from "../i18n/LocaleContext";
import { publicApi } from "../publicApi";

type OwnerSummary = {
  store: {
    id: number;
    name: string;
    ownerName: string;
    phone: string;
    deferredPaymentEnabled: boolean;
  };
  totals: {
    deferredPurchases: number;
    cashPurchases: number;
    paymentsRecorded: number;
    balanceDue: number;
  };
  orders: { id: string; payment_type: string; total_amount: string; created_at: string }[];
};

export default function PublicOwner() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const { t, locale } = useLocale();
  const [data, setData] = useState<OwnerSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setErr(t.owner.missingToken);
        return;
      }
      try {
        const res = await publicApi.get<OwnerSummary>("/owner/summary", { params: { t: token } });
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setErr(t.owner.loadErr);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, t.owner.missingToken, t.owner.loadErr]);

  return (
    <div className="card narrow">
      <h1>{t.owner.title}</h1>
      {err && <div className="error">{err}</div>}
      {data && (
        <div style={{ marginTop: 12 }}>
          <h2 className="strong">{data.store.name}</h2>
          <p className="muted">
            {t.owner.owner}: {data.store.ownerName} · {t.owner.phone}: {data.store.phone}
          </p>
          <p>
            {t.owner.deferred}: {data.store.deferredPaymentEnabled ? t.owner.deferredOn : t.owner.deferredOff}
          </p>
          <h3 style={{ marginTop: 16 }}>{t.owner.totals}</h3>
          <ul className="simple-list">
            <li>
              {t.owner.deferredPurchases}: <strong>{data.totals.deferredPurchases}</strong>
            </li>
            <li>
              {t.owner.cashPurchases}: <strong>{data.totals.cashPurchases}</strong>
            </li>
            <li>
              {t.owner.payments}: <strong>{data.totals.paymentsRecorded}</strong>
            </li>
            <li>
              {t.owner.balance}: <strong>{data.totals.balanceDue}</strong>
            </li>
          </ul>
          <h3 style={{ marginTop: 16 }}>{t.owner.ordersTitle}</h3>
          <ul className="simple-list">
            {data.orders.map((o) => (
              <li key={o.id}>
                #{o.id} — {o.payment_type} — {o.total_amount} — {new Date(o.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted" style={{ marginTop: 12 }}>
        {t.owner.hint}
      </p>
    </div>
  );
}
