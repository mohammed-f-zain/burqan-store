import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { mediaUrl } from "../lib/mediaUrl";
import { useOwnerArabic } from "../owner/useOwnerArabic";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";
import { publicApi } from "../publicApi";

type Tab = "overview" | "orders" | "products" | "visits";

type OwnerSummary = {
  store: {
    id: number;
    name: string;
    ownerName: string;
    phone: string;
    imageUrl: string | null;
    deferredPaymentEnabled: boolean;
  };
  totals: {
    deferredPurchases: number;
    cashPurchases: number;
    paymentsRecorded: number;
    balanceDue: number;
  };
  stats: {
    orderCount: number;
    visitCount: number;
    monthOrderCount: number;
    monthOrderTotal: number;
  };
  orders: { id: string; payment_type: string; total_amount: string; created_at: string }[];
  visits: { id: string; visited_at: string; note: string | null; rep_name: string }[];
  topProducts: { productId: number; name: string; imageUrl: string | null; quantity: number; total: number }[];
  monthly: { month: string; total: number; count: number }[];
};

type CatalogProduct = {
  id: number;
  name: string;
  designation: string | null;
  unit_label: string | null;
  image_url: string | null;
  price: string;
};

function formatMoney(n: number, currency: string) {
  return `${n.toLocaleString("ar-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatMonthLabel(isoMonth: string) {
  const d = new Date(isoMonth.includes("T") ? isoMonth : `${isoMonth}T12:00:00`);
  return new Intl.DateTimeFormat("ar-JO", {
    month: "short",
    year: "2-digit",
    calendar: "gregory",
    numberingSystem: "latn",
  }).format(d);
}

export default function OwnerPortal() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const t = useOwnerArabic();

  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<OwnerSummary | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!token) {
      setErr(t.owner.missingToken);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await publicApi.get<OwnerSummary>("/owner/summary", { params: { t: token } });
      setData(res.data);
      setErr(null);
    } catch {
      setErr(t.owner.loadErr);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, t.owner.missingToken, t.owner.loadErr]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (tab !== "products" || !token || products.length > 0) return;
    let cancelled = false;
    setProductsLoading(true);
    (async () => {
      try {
        const res = await publicApi.get<{ products: CatalogProduct[] }>("/owner/products", { params: { t: token } });
        if (!cancelled) setProducts(res.data.products ?? []);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, token, products.length]);

  const chartMax = useMemo(() => {
    if (!data?.monthly.length) return 1;
    return Math.max(...data.monthly.map((m) => m.total), 1);
  }, [data?.monthly]);

  const storeImage = data?.store.imageUrl ? mediaUrl(data.store.imageUrl) : undefined;

  if (loading) {
    return (
      <div className="owner-shell">
        <div className="owner-loading">
          <p className="owner-muted">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="owner-shell">
        <div className="owner-error-wrap">
          <p className="owner-error">{err ?? t.owner.loadErr}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="owner-shell">
      <header className="owner-header">
        <div className="owner-brand">
          <img src="/assets/burqanlogo.png" alt="Burqan" />
          <p className="owner-brand-title">{t.owner.portalBrand}</p>
        </div>
      </header>

      <div className="owner-store-hero">
        <div className="owner-store-card">
          {storeImage ? (
            <img src={storeImage} alt="" className="owner-store-avatar" />
          ) : (
            <div className="owner-store-avatar owner-store-avatar--empty">{data.store.name.slice(0, 1)}</div>
          )}
          <div className="owner-store-meta">
            <h1 className="owner-store-name">{data.store.name}</h1>
            <p className="owner-store-sub">
              {data.store.ownerName} · {data.store.phone}
            </p>
            <span className="owner-badge">
              {data.store.deferredPaymentEnabled ? t.owner.deferredOn : t.owner.deferredOff}
            </span>
          </div>
        </div>
      </div>

      <nav className="owner-tabs" aria-label={t.owner.tabsAria}>
        {(["overview", "orders", "products", "visits"] as const).map((key) => (
          <button key={key} type="button" className={`owner-tab${tab === key ? " owner-tab--on" : ""}`} onClick={() => setTab(key)}>
            {t.owner.tabs[key]}
          </button>
        ))}
      </nav>

      <main className="owner-main">
        {tab === "overview" && (
          <>
            <div className="owner-stats">
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.statOrders}</div>
                <div className="owner-stat-value">{data.stats.orderCount}</div>
              </div>
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.statVisits}</div>
                <div className="owner-stat-value">{data.stats.visitCount}</div>
              </div>
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.statMonthOrders}</div>
                <div className="owner-stat-value owner-stat-value--accent">{data.stats.monthOrderCount}</div>
              </div>
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.statMonthTotal}</div>
                <div className="owner-stat-value owner-stat-value--accent">
                  {formatMoney(data.stats.monthOrderTotal, t.owner.currency)}
                </div>
              </div>
            </div>

            <div className="owner-stats" style={{ marginTop: 12 }}>
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.deferredPurchases}</div>
                <div className="owner-stat-value">{formatMoney(data.totals.deferredPurchases, t.owner.currency)}</div>
              </div>
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.cashPurchases}</div>
                <div className="owner-stat-value">{formatMoney(data.totals.cashPurchases, t.owner.currency)}</div>
              </div>
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.payments}</div>
                <div className="owner-stat-value">{formatMoney(data.totals.paymentsRecorded, t.owner.currency)}</div>
              </div>
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.balance}</div>
                <div className="owner-stat-value owner-stat-value--danger">
                  {formatMoney(data.totals.balanceDue, t.owner.currency)}
                </div>
              </div>
            </div>

            {data.monthly.length > 0 && (
              <section className="owner-section">
                <h2 className="owner-section-title">{t.owner.chartTitle}</h2>
                <div className="owner-chart">
                  {data.monthly.map((m) => (
                    <div key={m.month} className="owner-chart-col">
                      <div className="owner-chart-bar-wrap">
                        <div
                          className="owner-chart-bar"
                          style={{ height: `${Math.max(4, (m.total / chartMax) * 100)}%` }}
                          title={formatMoney(m.total, t.owner.currency)}
                        />
                      </div>
                      <span className="owner-chart-label">{formatMonthLabel(m.month)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.topProducts.length > 0 && (
              <section className="owner-section">
                <h2 className="owner-section-title">{t.owner.topProducts}</h2>
                <ul className="owner-top-list">
                  {data.topProducts.map((p) => {
                    const img = mediaUrl(p.imageUrl);
                    return (
                      <li key={p.productId} className="owner-top-item">
                        {img ? (
                          <img src={img} alt="" className="owner-top-thumb" />
                        ) : (
                          <div className="owner-top-thumb owner-top-thumb--empty" />
                        )}
                        <div className="owner-top-body">
                          <div className="owner-top-name">{p.name}</div>
                          <div className="owner-top-sub">
                            {t.owner.qtyUnits(p.quantity)} · {formatMoney(p.total, t.owner.currency)}
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

        {tab === "orders" && (
          <section className="owner-section">
            <h2 className="owner-section-title">{t.owner.ordersTitle}</h2>
            {data.orders.length === 0 ? (
              <p className="owner-empty">{t.owner.emptyOrders}</p>
            ) : (
              <div className="owner-table-wrap">
                <table className="owner-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t.owner.colPayment}</th>
                      <th>{t.owner.colAmount}</th>
                      <th>{t.owner.colDate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>
                          <span className={o.payment_type === "cash" ? "owner-pay-cash" : "owner-pay-deferred"}>
                            {o.payment_type === "cash" ? t.owner.payCash : t.owner.payDeferred}
                          </span>
                        </td>
                        <td>{formatMoney(parseFloat(o.total_amount), t.owner.currency)}</td>
                        <td>{formatMarketDateTime(o.created_at, "ar")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "products" && (
          <section className="owner-section">
            <h2 className="owner-section-title">{t.owner.productsTitle}</h2>
            {productsLoading ? (
              <p className="owner-muted">{t.common.loading}</p>
            ) : products.length === 0 ? (
              <p className="owner-empty">{t.owner.emptyProducts}</p>
            ) : (
              <div className="owner-products-grid">
                {products.map((p) => {
                  const img = mediaUrl(p.image_url);
                  return (
                    <article key={p.id} className="owner-product">
                      {img ? (
                        <img src={img} alt="" className="owner-product-img" />
                      ) : (
                        <div className="owner-product-img owner-product-img--empty">{t.owner.noImage}</div>
                      )}
                      <div className="owner-product-body">
                        <h3 className="owner-product-name">{p.name}</h3>
                        <p className="owner-product-price">{formatMoney(parseFloat(p.price), t.owner.currency)}</p>
                        {p.designation ? <p className="owner-product-desc">{p.designation}</p> : null}
                        {p.unit_label ? <p className="owner-product-desc">{p.unit_label}</p> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "visits" && (
          <section className="owner-section">
            <h2 className="owner-section-title">{t.owner.visitsTitle}</h2>
            {data.visits.length === 0 ? (
              <p className="owner-empty">{t.owner.emptyVisits}</p>
            ) : (
              <div>
                {data.visits.map((v) => (
                  <div key={v.id} className="owner-visit">
                    <div className="owner-visit-time">{formatMarketDateTime(v.visited_at, "ar")}</div>
                    <div className="owner-visit-rep">{t.owner.repLabel}: {v.rep_name}</div>
                    {v.note ? <div className="owner-visit-note">{v.note}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
