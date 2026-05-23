import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import LoyaltyBadge from "../components/LoyaltyBadge";
import LoyaltyIcon from "../components/LoyaltyIcon";
import OwnerProductDetailSheet, { type OwnerCatalogProduct } from "../components/OwnerProductDetailSheet";
import SectionTitleWithIcon from "../components/SectionTitleWithIcon";
import { mediaUrl } from "../lib/mediaUrl";
import { openOwnerOrder, ownerFormatMoney } from "../owner/ownerFormat";
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
    loyaltyPointsBalance: number;
  };
  loyalty: {
    balance: number;
    monthPointsEarned: number;
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
  orders: {
    id: string;
    payment_type: string;
    total_amount: string;
    created_at: string;
    rep_name: string;
    rep_image_url: string | null;
    rep_phone: string;
    line_count: number;
    item_qty: number;
    products_preview: string | null;
  }[];
  visits: {
    id: string;
    visited_at: string;
    note: string | null;
    rep_name: string;
    rep_image_url: string | null;
    rep_phone: string;
  }[];
  topProducts: { productId: number; name: string; imageUrl: string | null; quantity: number; total: number }[];
  loyaltyRecent: {
    orderId: string;
    createdAt: string;
    productName: string;
    quantity: number;
    points: number;
  }[];
};

export default function OwnerPortal() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const t = useOwnerArabic();

  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<OwnerSummary | null>(null);
  const [products, setProducts] = useState<OwnerCatalogProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<OwnerCatalogProduct | null>(null);
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
        const res = await publicApi.get<{ products: OwnerCatalogProduct[] }>("/owner/products", { params: { t: token } });
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
          <img src="/assets/burqanlogo.png" alt="برقان" />
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
                  {ownerFormatMoney(data.stats.monthOrderTotal, t.owner.currency)}
                </div>
              </div>
            </div>

            <section className="owner-loyalty-panel" aria-label={t.owner.loyaltyBalance}>
              <div className="owner-loyalty-card owner-loyalty-card--balance">
                <div className="owner-loyalty-card-icon" aria-hidden>
                  <LoyaltyIcon kind="balance" size={32} />
                </div>
                <div className="owner-loyalty-card-body">
                  <p className="owner-loyalty-card-label">{t.owner.loyaltyBalance}</p>
                  <p className="owner-loyalty-card-value">{t.owner.loyaltyPoints(data.loyalty.balance)}</p>
                </div>
              </div>
            </section>

            <div className="owner-stats" style={{ marginTop: 12 }}>
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.deferredPurchases}</div>
                <div className="owner-stat-value">{ownerFormatMoney(data.totals.deferredPurchases, t.owner.currency)}</div>
              </div>
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.cashPurchases}</div>
                <div className="owner-stat-value">{ownerFormatMoney(data.totals.cashPurchases, t.owner.currency)}</div>
              </div>
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.payments}</div>
                <div className="owner-stat-value">{ownerFormatMoney(data.totals.paymentsRecorded, t.owner.currency)}</div>
              </div>
              <div className="owner-stat">
                <div className="owner-stat-label">{t.owner.balance}</div>
                <div className="owner-stat-value owner-stat-value--danger">
                  {ownerFormatMoney(data.totals.balanceDue, t.owner.currency)}
                </div>
              </div>
            </div>

            {data.loyaltyRecent.length > 0 && (
              <section className="owner-section">
                <SectionTitleWithIcon icon={<LoyaltyIcon kind="earn" size={22} />} className="owner-section-title">
                  {t.owner.loyaltyRecentTitle}
                </SectionTitleWithIcon>
                <ul className="owner-loyalty-list">
                  {data.loyaltyRecent.map((row, i) => (
                    <li key={`${row.orderId}-${i}`} className="owner-loyalty-item">
                      <span className="owner-loyalty-item-icon" aria-hidden>
                        <LoyaltyIcon kind="plus" size={20} />
                      </span>
                      <div className="owner-loyalty-main">
                        <span className="owner-loyalty-product">{row.productName}</span>
                        <span className="owner-loyalty-meta">
                          {t.owner.lineQty(row.quantity)} · {formatMarketDateTime(row.createdAt, "ar")}
                        </span>
                      </div>
                      <LoyaltyBadge text={t.owner.loyaltyLinePoints(row.points)} variant="inline" icon="star" />
                    </li>
                  ))}
                </ul>
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
                            {t.owner.qtyUnits(p.quantity)} · {ownerFormatMoney(p.total, t.owner.currency)}
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
          <section className="owner-section owner-section--flush">
            <h2 className="owner-section-title">{t.owner.ordersTitle}</h2>
            {data.orders.length === 0 ? (
              <p className="owner-empty">{t.owner.emptyOrders}</p>
            ) : (
              <ul className="owner-order-list">
                {data.orders.map((order) => {
                  const repImg = mediaUrl(order.rep_image_url);
                  const isCash = order.payment_type === "cash";
                  return (
                    <li key={order.id}>
                      <button
                        type="button"
                        className="owner-order-card"
                        onClick={() => token && openOwnerOrder(order.id, token)}
                      >
                        <div className="owner-order-card-top">
                          <div className="owner-order-card-id">
                            <span className="owner-order-hash">#{order.id}</span>
                            <span
                              className={`owner-pay-pill${isCash ? " owner-pay-pill--cash" : " owner-pay-pill--deferred"}`}
                            >
                              {isCash ? t.owner.payCash : t.owner.payDeferred}
                            </span>
                          </div>
                          <p className="owner-order-amount">
                            {ownerFormatMoney(parseFloat(order.total_amount), t.owner.currency)}
                          </p>
                        </div>
                        <p className="owner-order-date">{formatMarketDateTime(order.created_at, "ar")}</p>
                        {order.products_preview ? (
                          <p className="owner-order-preview">{order.products_preview}</p>
                        ) : null}
                        <div className="owner-order-meta">
                          <span>{t.owner.itemsCount(order.line_count)}</span>
                          <span>·</span>
                          <span>{t.owner.unitsCount(order.item_qty)}</span>
                        </div>
                        <div className="owner-order-rep">
                          {repImg ? (
                            <img src={repImg} alt="" className="owner-rep-avatar owner-rep-avatar--sm" />
                          ) : (
                            <div className="owner-rep-avatar owner-rep-avatar--sm owner-rep-avatar--empty">
                              {order.rep_name.slice(0, 1)}
                            </div>
                          )}
                          <div className="owner-order-rep-text">
                            <span className="owner-order-rep-name">{order.rep_name}</span>
                            <span className="owner-order-rep-phone">{order.rep_phone}</span>
                          </div>
                        </div>
                        <span className="owner-order-cta">{t.owner.viewOrder} ‹</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
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
                    <button
                      key={p.id}
                      type="button"
                      className="owner-product owner-product-card"
                      onClick={() => setSelectedProduct(p)}
                    >
                      {img ? (
                        <img src={img} alt="" className="owner-product-img" />
                      ) : (
                        <div className="owner-product-img owner-product-img--empty">{t.owner.noImage}</div>
                      )}
                      <div className="owner-product-body">
                        <h3 className="owner-product-name">{p.name}</h3>
                        <p className="owner-product-price">{ownerFormatMoney(parseFloat(p.price), t.owner.currency)}</p>
                        {p.loyalty_points_per_unit > 0 ? (
                          <LoyaltyBadge
                            text={t.owner.loyaltyPerUnit(p.loyalty_points_per_unit)}
                            variant="inline"
                            icon="star"
                          />
                        ) : null}
                        <span className="owner-product-cta">{t.owner.viewProduct} ‹</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "visits" && (
          <section className="owner-section owner-section--flush">
            <h2 className="owner-section-title">{t.owner.visitsTitle}</h2>
            {data.visits.length === 0 ? (
              <p className="owner-empty">{t.owner.emptyVisits}</p>
            ) : (
              <ul className="owner-visit-list">
                {data.visits.map((visit) => {
                  const repImg = mediaUrl(visit.rep_image_url);
                  return (
                    <li key={visit.id} className="owner-visit-card">
                      <div className="owner-visit-card-inner">
                        {repImg ? (
                          <img src={repImg} alt="" className="owner-rep-avatar" />
                        ) : (
                          <div className="owner-rep-avatar owner-rep-avatar--empty">{visit.rep_name.slice(0, 1)}</div>
                        )}
                        <div className="owner-visit-body">
                          <div className="owner-visit-head">
                            <p className="owner-visit-rep-name">{visit.rep_name}</p>
                            <a href={`tel:${visit.rep_phone}`} className="owner-visit-phone" onClick={(e) => e.stopPropagation()}>
                              {visit.rep_phone}
                            </a>
                          </div>
                          <p className="owner-visit-kicker">{t.owner.visitAt}</p>
                          <p className="owner-visit-time">{formatMarketDateTime(visit.visited_at, "ar")}</p>
                          <p className={`owner-visit-note${visit.note ? "" : " owner-visit-note--muted"}`}>
                            {visit.note || t.owner.noNote}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>

      {selectedProduct && (
        <OwnerProductDetailSheet
          product={selectedProduct}
          strings={t.owner}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
