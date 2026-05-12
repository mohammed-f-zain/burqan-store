import { useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useLocale } from "../i18n/LocaleContext";

type Counts = {
  stores?: number;
  products?: number;
  reps?: number;
  orders?: number;
  areas?: number;
  qrUnassigned?: number;
};

export default function OverviewPage() {
  const { me, can } = useAuth();
  const { t } = useLocale();
  const [counts, setCounts] = useState<Counts>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tasks: Promise<void>[] = [];
      if (can("stores.read"))
        tasks.push(
          api.get("/stores").then((r) => {
            if (!cancelled) setCounts((c) => ({ ...c, stores: r.data.stores?.length ?? 0 }));
          })
        );
      if (can("products.read"))
        tasks.push(
          api.get("/products").then((r) => {
            if (!cancelled) setCounts((c) => ({ ...c, products: r.data.products?.length ?? 0 }));
          })
        );
      if (can("reps.read"))
        tasks.push(
          api.get("/representatives").then((r) => {
            if (!cancelled) setCounts((c) => ({ ...c, reps: r.data.representatives?.length ?? 0 }));
          })
        );
      if (can("orders.read"))
        tasks.push(
          api.get("/orders").then((r) => {
            if (!cancelled) setCounts((c) => ({ ...c, orders: r.data.orders?.length ?? 0 }));
          })
        );
      if (can("areas.read"))
        tasks.push(
          api.get("/areas").then((r) => {
            if (!cancelled) setCounts((c) => ({ ...c, areas: r.data.areas?.length ?? 0 }));
          })
        );
      if (can("qr_pool.read"))
        tasks.push(
          api.get<{ unassignedCount: number }>("/qr-pool", { params: { limit: 1 } }).then((r) => {
            if (!cancelled) setCounts((c) => ({ ...c, qrUnassigned: r.data.unassignedCount }));
          })
        );
      try {
        await Promise.all(tasks);
      } catch {
        if (!cancelled) setErr(t.overview.loadErr);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when permissions change only
  }, [can]);

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.overview.title}</h2>
        {err && <div className="error">{err}</div>}
        <p className="muted">
          {t.overview.signedIn} <strong>{me?.email}</strong>
          {me?.isSuperAdmin ? t.overview.superNote : t.overview.roleNote}
        </p>
        <div className="stat-grid">
          {counts.stores !== undefined && (
            <div className="stat">
              <div className="stat-num">{counts.stores}</div>
              <div className="muted">{t.overview.stores}</div>
            </div>
          )}
          {counts.products !== undefined && (
            <div className="stat">
              <div className="stat-num">{counts.products}</div>
              <div className="muted">{t.overview.products}</div>
            </div>
          )}
          {counts.reps !== undefined && (
            <div className="stat">
              <div className="stat-num">{counts.reps}</div>
              <div className="muted">{t.overview.reps}</div>
            </div>
          )}
          {counts.orders !== undefined && (
            <div className="stat">
              <div className="stat-num">{counts.orders}</div>
              <div className="muted">{t.overview.orders}</div>
            </div>
          )}
          {counts.areas !== undefined && (
            <div className="stat">
              <div className="stat-num">{counts.areas}</div>
              <div className="muted">{t.overview.areas}</div>
            </div>
          )}
          {counts.qrUnassigned !== undefined && (
            <div className="stat">
              <div className="stat-num">{counts.qrUnassigned}</div>
              <div className="muted">{t.overview.qrUnassigned}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
