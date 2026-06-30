import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import LoyaltyIcon from "../components/LoyaltyIcon";
import SectionTitleWithIcon from "../components/SectionTitleWithIcon";
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
  noBuyVisits: {
    monthCount: number;
    byReason: { reason: string; count: number }[];
    recent: {
      id: string;
      visitedAt: string;
      reason: string;
      storeId: number;
      storeName: string;
      areaName: string;
      repName: string;
    }[];
  };
};

type StatTile = {
  key: keyof Counts;
  value: number | undefined;
  label: string;
  to?: string;
  accent?: boolean;
};

export default function OverviewPage() {
  const { me, can } = useAuth();
  const { t, locale } = useLocale();
  const [counts, setCounts] = useState<Counts>({});
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const currency = t.overview.currency;
  const money = (n: number) => ownerFormatMoney(n, currency);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Amman",
      }).format(new Date()),
    [locale]
  );

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

  const statTiles: StatTile[] = [
    { key: "stores", value: counts.stores, label: t.overview.stores, to: can("stores.read") ? "/app/stores" : undefined },
    { key: "orders", value: counts.orders, label: t.overview.orders, to: can("orders.read") ? "/app/orders" : undefined, accent: true },
    { key: "reps", value: counts.reps, label: t.overview.reps, to: can("reps.read") ? "/app/representatives" : undefined },
    { key: "products", value: counts.products, label: t.overview.products, to: can("products.read") ? "/app/products" : undefined },
    { key: "areas", value: counts.areas, label: t.overview.areas, to: can("areas.read") ? "/app/areas" : undefined },
    { key: "qrUnassigned", value: counts.qrUnassigned, label: t.overview.qrUnassigned, to: can("qr_pool.read") ? "/app/qr-pool" : undefined },
  ].filter((s) => s.value !== undefined);

  const hasAnalyticsData =
    analytics &&
    (analytics.totals.orderCount > 0 ||
      analytics.topProducts.length > 0 ||
      analytics.loyalty.totalPointsIssued > 0);

  return (
    <div className="overview-page">
      <section className="overview-hero card">
        <div className="overview-hero-body">
          <p className="overview-hero-kicker">{todayLabel}</p>
          <h1 className="overview-hero-title">{t.overview.title}</h1>
          <p className="overview-hero-sub muted">
            {t.overview.signedIn} <strong>{me?.fullName ?? me?.email}</strong>
            {me?.isSuperAdmin ? t.overview.superNote : t.overview.roleNote}
          </p>
        </div>
        {can("stores.read") && (
          <div className="overview-hero-actions">
            <Link to="/app/stores" className="overview-quick-link">
              {t.nav.stores}
            </Link>
            <Link to="/app/loyalty-stores" className="overview-quick-link overview-quick-link--loyalty">
              <LoyaltyIcon kind="star" size={16} />
              {t.nav.loyaltyStores}
            </Link>
            {can("orders.read") && (
              <Link to="/app/orders" className="overview-quick-link">
                {t.nav.orders}
              </Link>
            )}
          </div>
        )}
      </section>

      {statTiles.length > 0 && (
        <section className="overview-stat-row">
          {statTiles.map((tile) => {
            const inner = (
              <>
                <div className={`overview-stat-num${tile.accent ? " overview-stat-num--accent" : ""}`}>{tile.value}</div>
                <div className="overview-stat-label muted">{tile.label}</div>
              </>
            );
            return tile.to ? (
              <Link key={tile.key} to={tile.to} className={`overview-stat-card${tile.accent ? " overview-stat-card--accent" : ""}`}>
                {inner}
              </Link>
            ) : (
              <div key={tile.key} className="overview-stat-card">
                {inner}
              </div>
            );
          })}
        </section>
      )}

      {can("orders.read") && (
        <section className="card overview-analytics">
          <div className="overview-panel-head">
            <h2 className="overview-panel-title">{t.overview.analyticsTitle}</h2>
            {analyticsLoading && <span className="muted small">{t.common.loading}</span>}
          </div>

          {!analyticsLoading && analytics && (
            <>
              <div className="overview-kpi-row">
                <div className="dash-kpi dash-kpi--accent overview-kpi-main">
                  <div className="dash-kpi-label">{t.overview.monthRevenue}</div>
                  <div className="dash-kpi-value">{money(analytics.period.monthRevenue)}</div>
                  <div className="overview-kpi-meta muted small">
                    {t.overview.monthOrders}: {analytics.period.monthOrderCount}
                  </div>
                </div>
                <div className="overview-kpi-side">
                  <div className="dash-kpi dash-kpi--compact">
                    <div className="dash-kpi-label">{t.overview.weekOrders}</div>
                    <div className="dash-kpi-value dash-kpi-value--sm">{analytics.period.weekOrderCount}</div>
                  </div>
                  <div className="dash-kpi dash-kpi--compact">
                    <div className="dash-kpi-label">{t.overview.monthVisits}</div>
                    <div className="dash-kpi-value dash-kpi-value--sm">{analytics.period.monthVisitCount}</div>
                  </div>
                  <div className="dash-kpi dash-kpi--compact">
                    <div className="dash-kpi-label">{t.overview.deferredOutstanding}</div>
                    <div className="dash-kpi-value dash-kpi-value--sm dash-kpi-value--danger">
                      {money(analytics.totals.deferredOutstanding)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="dash-kpi-grid dash-kpi-grid--sub overview-kpi-sub">
                <div className="dash-kpi dash-kpi--compact">
                  <div className="dash-kpi-label">{t.overview.totalRevenue}</div>
                  <div className="dash-kpi-value dash-kpi-value--sm">{money(analytics.totals.revenue)}</div>
                </div>
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
              </div>

              {!hasAnalyticsData && <p className="muted">{t.overview.noAnalytics}</p>}

              <div className="overview-panels-grid">
                <section className="overview-panel overview-panel--loyalty">
                  <div className="dash-section-head">
                    <SectionTitleWithIcon icon={<LoyaltyIcon kind="balance" size={22} />} className="dash-section-title">
                      {t.overview.loyaltyTitle}
                    </SectionTitleWithIcon>
                    {can("stores.read") && (
                      <Link to="/app/loyalty-stores" className="linkish small">
                        {t.overview.loyaltyViewAll}
                      </Link>
                    )}
                  </div>
                  <div className="dash-kpi-grid dash-kpi-grid--loyalty">
                    <div className="dash-kpi dash-kpi--loyalty">
                      <div className="dash-kpi-label">
                        <LoyaltyIcon kind="balance" size={18} />
                        {t.overview.loyaltyTotalIssued}
                      </div>
                      <div className="dash-kpi-value">{t.overview.loyaltyPoints(analytics.loyalty.totalPointsIssued)}</div>
                    </div>
                    <div className="dash-kpi dash-kpi--loyalty">
                      <div className="dash-kpi-label">
                        <LoyaltyIcon kind="earn" size={18} />
                        {t.overview.loyaltyMonthEarned}
                      </div>
                      <div className="dash-kpi-value">{t.overview.loyaltyPoints(analytics.loyalty.monthPointsEarned)}</div>
                    </div>
                  </div>
                  {analytics.topStoresLoyalty.length > 0 ? (
                    <ul className="dash-rank-list">
                      {analytics.topStoresLoyalty.slice(0, 5).map((s, i) => (
                        <li key={s.storeId} className="dash-rank-item">
                          <span className="dash-rank-num">{i + 1}</span>
                          <div className="dash-rank-body">
                            <Link to={`/app/stores/${s.storeId}`} className="dash-rank-name linkish">
                              {s.name}
                            </Link>
                            <div className="dash-rank-sub dash-rank-sub--loyalty">
                              <span>{s.areaName}</span>
                              <span className="dash-loyalty-inline">
                                <LoyaltyIcon kind="star" size={16} />
                                {t.overview.loyaltyPoints(s.balance)}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">{t.overview.loyaltyNoData}</p>
                  )}
                </section>

                {analytics.recentOrders.length > 0 && (
                  <section className="overview-panel">
                    <div className="dash-section-head">
                      <h4 className="dash-section-title">{t.overview.recentOrders}</h4>
                      <Link to="/app/orders" className="linkish small">
                        {t.overview.viewAllOrders}
                      </Link>
                    </div>
                    <ul className="dash-recent-list">
                      {analytics.recentOrders.slice(0, 6).map((o) => (
                        <li key={o.id}>
                          <Link to={`/app/orders/${o.id}`} className="dash-recent-row">
                            <div>
                              <span className="dash-recent-id">#{o.id}</span>
                              <span className="dash-recent-store">{o.storeName}</span>
                            </div>
                            <div className="dash-recent-meta">
                              <span className={`dash-pay-pill${o.paymentType === "cash" ? " dash-pay-pill--cash" : ""}`}>
                                {o.paymentType === "cash" ? t.overview.payCash : t.overview.payDeferred}
                              </span>
                              <strong>{money(o.totalAmount)}</strong>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {analytics.noBuyVisits && (
                <section className="dash-section dash-section--no-buy overview-panel--full">
                  <div className="dash-section-head">
                    <h4 className="dash-section-title">{t.overview.noBuyTitle}</h4>
                    <Link to="/app/visits" className="linkish small">
                      {t.overview.noBuyViewAll}
                    </Link>
                  </div>
                  <p className="muted small">{t.overview.noBuyHint}</p>
                  <div className="dash-kpi-grid dash-kpi-grid--sub" style={{ marginBottom: 12 }}>
                    <div className="dash-kpi dash-kpi--compact">
                      <div className="dash-kpi-label">{t.overview.noBuyMonthCount}</div>
                      <div className="dash-kpi-value dash-kpi-value--sm">{analytics.noBuyVisits.monthCount}</div>
                    </div>
                  </div>
                  <div className="visits-reason-chips visits-reason-chips--overview">
                    {analytics.noBuyVisits.byReason.map((row) => (
                      <span key={row.reason} className="visits-reason-chip">
                        {row.reason}
                        <span className="visits-reason-chip-count">{row.count}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

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
            </>
          )}
        </section>
      )}
    </div>
  );
}
