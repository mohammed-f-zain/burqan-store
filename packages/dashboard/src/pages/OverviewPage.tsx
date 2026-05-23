import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { mediaUrl } from "../lib/mediaUrl";
import { toastError } from "../lib/toast";
import { ownerFormatMoney } from "../owner/ownerFormat";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";

type Counts = {
  stores?: number;
  products?: number;
  reps?: number;
  orders?: number;
  areas?: number;
  qrUnassigned?: number;
};

type Analytics = {
  totals: {
    orderCount: number;
    visitCount: number;
    revenue: number;
    cashRevenue: number;
    deferredRevenue: number;
    paymentsRecorded: number;
    deferredOutstanding: number;
  };
  period: {
    monthOrderCount: number;
    monthRevenue: number;
    monthVisitCount: number;
    weekOrderCount: number;
  };
  topProducts: {
    productId: number;
    name: string;
    imageUrl: string | null;
    quantity: number;
    revenue: number;
  }[];
  topStores: {
    storeId: number;
    name: string;
    areaName: string;
    orderCount: number;
    revenue: number;
  }[];
  topReps: {
    repId: number;
    name: string;
    imageUrl: string | null;
    orderCount: number;
    revenue: number;
  }[];
  loyalty: {
    totalPointsIssued: number;
    monthPointsEarned: number;
  };
  topStoresLoyalty: {
    storeId: number;
    name: string;
    areaName: string;
    balance: number;
  }[];
  recentOrders: {
    id: string;
    storeId: number;
    storeName: string;
    paymentType: string;
    totalAmount: number;
    createdAt: string;
    repName: string;
  }[];
};

export default function OverviewPage() {
  const { me, can } = useAuth();
  const { t, locale } = useLocale();
  const [counts, setCounts] = useState<Counts>({});
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const currency = t.overview.currency;
  const money = (n: number) => ownerFormatMoney(n, currency);

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
        if (!cancelled) toastError(t.overview.loadErr);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when permissions change only
  }, [can]);

  useEffect(() => {
    if (!can("orders.read")) {
      setAnalytics(null);
      return;
    }
    let cancelled = false;
    setAnalyticsLoading(true);
    (async () => {
      try {
        const { data } = await api.get<Analytics>("/analytics/overview");
        if (!cancelled) setAnalytics(data);
      } catch {
        if (!cancelled) {
          setAnalytics(null);
          toastError(t.overview.analyticsLoadErr);
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [can, t.overview.analyticsLoadErr]);

  const hasAnalyticsData =
    analytics &&
    (analytics.totals.orderCount > 0 ||
      analytics.topProducts.length > 0 ||
      analytics.loyalty.totalPointsIssued > 0);

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.overview.title}</h2>
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

      {can("orders.read") && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t.overview.analyticsTitle}</h3>
          {analyticsLoading && <p className="muted">{t.common.loading}</p>}
          {!analyticsLoading && analytics && (
            <>
              <div className="dash-kpi-grid">
                <div className="dash-kpi dash-kpi--accent">
                  <div className="dash-kpi-label">{t.overview.monthRevenue}</div>
                  <div className="dash-kpi-value">{money(analytics.period.monthRevenue)}</div>
                </div>
                <div className="dash-kpi">
                  <div className="dash-kpi-label">{t.overview.monthOrders}</div>
                  <div className="dash-kpi-value">{analytics.period.monthOrderCount}</div>
                </div>
                <div className="dash-kpi">
                  <div className="dash-kpi-label">{t.overview.weekOrders}</div>
                  <div className="dash-kpi-value">{analytics.period.weekOrderCount}</div>
                </div>
                <div className="dash-kpi">
                  <div className="dash-kpi-label">{t.overview.monthVisits}</div>
                  <div className="dash-kpi-value">{analytics.period.monthVisitCount}</div>
                </div>
                <div className="dash-kpi">
                  <div className="dash-kpi-label">{t.overview.totalRevenue}</div>
                  <div className="dash-kpi-value dash-kpi-value--sm">{money(analytics.totals.revenue)}</div>
                </div>
                <div className="dash-kpi">
                  <div className="dash-kpi-label">{t.overview.deferredOutstanding}</div>
                  <div className="dash-kpi-value dash-kpi-value--sm dash-kpi-value--danger">
                    {money(analytics.totals.deferredOutstanding)}
                  </div>
                </div>
              </div>

              <div className="dash-kpi-grid dash-kpi-grid--sub" style={{ marginTop: 12 }}>
                <div className="dash-kpi dash-kpi--compact">
                  <div className="dash-kpi-label">{t.overview.cashSales}</div>
                  <div className="dash-kpi-value dash-kpi-value--sm">{money(analytics.totals.cashRevenue)}</div>
                </div>
                <div className="dash-kpi dash-kpi--compact">
                  <div className="dash-kpi-label">{t.overview.deferredSales}</div>
                  <div className="dash-kpi-value dash-kpi-value--sm">{money(analytics.totals.deferredRevenue)}</div>
                </div>
                <div className="dash-kpi dash-kpi--compact">
                  <div className="dash-kpi-label">{t.overview.paymentsRecorded}</div>
                  <div className="dash-kpi-value dash-kpi-value--sm">{money(analytics.totals.paymentsRecorded)}</div>
                </div>
                <div className="dash-kpi dash-kpi--compact">
                  <div className="dash-kpi-label">{t.overview.totalVisits}</div>
                  <div className="dash-kpi-value dash-kpi-value--sm">{analytics.totals.visitCount}</div>
                </div>
              </div>

              {!hasAnalyticsData && <p className="muted">{t.overview.noAnalytics}</p>}

              <section className="dash-section">
                <h4 className="dash-section-title">{t.overview.loyaltyTitle}</h4>
                <div className="dash-kpi-grid" style={{ marginBottom: 12 }}>
                  <div className="dash-kpi dash-kpi--accent">
                    <div className="dash-kpi-label">{t.overview.loyaltyTotalIssued}</div>
                    <div className="dash-kpi-value">{t.overview.loyaltyPoints(analytics.loyalty.totalPointsIssued)}</div>
                  </div>
                  <div className="dash-kpi">
                    <div className="dash-kpi-label">{t.overview.loyaltyMonthEarned}</div>
                    <div className="dash-kpi-value">{t.overview.loyaltyPoints(analytics.loyalty.monthPointsEarned)}</div>
                  </div>
                </div>
                {analytics.topStoresLoyalty.length > 0 ? (
                  <ul className="dash-rank-list">
                    {analytics.topStoresLoyalty.map((s, i) => (
                      <li key={s.storeId} className="dash-rank-item">
                        <span className="dash-rank-num">{i + 1}</span>
                        <div className="dash-rank-body">
                          <Link to={`/app/stores/${s.storeId}`} className="dash-rank-name linkish">
                            {s.name}
                          </Link>
                          <div className="dash-rank-sub">
                            {s.areaName} · {t.overview.loyaltyPoints(s.balance)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">{t.overview.loyaltyNoData}</p>
                )}
              </section>

              <div className="dash-two-col">
                {analytics.topProducts.length > 0 && (
                  <section className="dash-section">
                    <h4 className="dash-section-title">{t.overview.topProducts}</h4>
                    <ul className="dash-rank-list">
                      {analytics.topProducts.map((p, i) => {
                        const img = mediaUrl(p.imageUrl);
                        return (
                          <li key={p.productId} className="dash-rank-item">
                            <span className="dash-rank-num">{i + 1}</span>
                            {img ? (
                              <img src={img} alt="" className="dash-rank-thumb" />
                            ) : (
                              <div className="dash-rank-thumb dash-rank-thumb--empty" />
                            )}
                            <div className="dash-rank-body">
                              <div className="dash-rank-name">{p.name}</div>
                              <div className="dash-rank-sub">
                                {t.overview.qtyUnits(p.quantity)} · {money(p.revenue)}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {analytics.topStores.length > 0 && (
                  <section className="dash-section">
                    <h4 className="dash-section-title">{t.overview.topStores}</h4>
                    <ul className="dash-rank-list">
                      {analytics.topStores.map((s, i) => (
                        <li key={s.storeId} className="dash-rank-item">
                          <span className="dash-rank-num">{i + 1}</span>
                          <div className="dash-rank-body">
                            <Link to={`/app/stores/${s.storeId}`} className="dash-rank-name linkish">
                              {s.name}
                            </Link>
                            <div className="dash-rank-sub">
                              {s.areaName} · {t.overview.ordersCount(s.orderCount)} · {money(s.revenue)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {analytics.topReps.length > 0 && (
                <section className="dash-section">
                  <h4 className="dash-section-title">{t.overview.topReps}</h4>
                  <ul className="dash-rank-list dash-rank-list--inline">
                    {analytics.topReps.map((r, i) => {
                      const img = mediaUrl(r.imageUrl);
                      return (
                        <li key={r.repId} className="dash-rank-item">
                          <span className="dash-rank-num">{i + 1}</span>
                          {img ? (
                            <img src={img} alt="" className="dash-rank-thumb dash-rank-thumb--round" />
                          ) : (
                            <div className="dash-rank-thumb dash-rank-thumb--round dash-rank-thumb--empty" />
                          )}
                          <div className="dash-rank-body">
                            <div className="dash-rank-name">{r.name}</div>
                            <div className="dash-rank-sub">
                              {t.overview.ordersCount(r.orderCount)} · {money(r.revenue)}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {analytics.recentOrders.length > 0 && (
                <section className="dash-section">
                  <h4 className="dash-section-title">{t.overview.recentOrders}</h4>
                  <ul className="dash-recent-list">
                    {analytics.recentOrders.map((o) => (
                      <li key={o.id}>
                        <Link to={`/app/orders/${o.id}`} className="dash-recent-row">
                          <div>
                            <span className="dash-recent-id">#{o.id}</span>
                            <span className="dash-recent-store">{o.storeName}</span>
                          </div>
                          <div className="dash-recent-meta">
                            <span
                              className={`dash-pay-pill${o.paymentType === "cash" ? " dash-pay-pill--cash" : ""}`}
                            >
                              {o.paymentType === "cash" ? t.overview.payCash : t.overview.payDeferred}
                            </span>
                            <strong>{money(o.totalAmount)}</strong>
                            <span className="muted small">{formatMarketDateTime(o.createdAt)}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
