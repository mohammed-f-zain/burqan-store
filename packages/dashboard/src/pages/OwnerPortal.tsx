import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import LoyaltyBadge from "../components/LoyaltyBadge";
import OwnerLoyaltyExpiryCard from "../components/OwnerLoyaltyExpiryCard";
import OwnerOverviewTab from "../components/OwnerOverviewTab";
import OwnerProductDetailSheet, { type OwnerCatalogProduct } from "../components/OwnerProductDetailSheet";
import { mediaUrl } from "../lib/mediaUrl";
import { ownerFormatMoney } from "../owner/ownerFormat";
import { useOwnerArabic } from "../owner/useOwnerArabic";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";
import { publicApi } from "../publicApi";

type Tab = "overview" | "products" | "prizes" | "visits";

type OwnerPrizeProduct = {
  id: number;
  name: string;
  designation: string | null;
  unitLabel: string | null;
  imageUrl: string | null;
  redeemPointsPerUnit: number;
};

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
    expiryDays: number;
    periodStartedAt: string | null;
    expiresAt: string | null;
    daysRemaining: number | null;
    periodActive: boolean;
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
  const [prizes, setPrizes] = useState<OwnerPrizeProduct[]>([]);
  const [prizesBalance, setPrizesBalance] = useState(0);
  const [prizesLoading, setPrizesLoading] = useState(false);

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

  useEffect(() => {
    if (tab !== "prizes" || !token || prizes.length > 0) return;
    let cancelled = false;
    setPrizesLoading(true);
    (async () => {
      try {
        const res = await publicApi.get<{
          loyaltyPointsBalance: number;
          products: OwnerPrizeProduct[];
        }>("/owner/prizes", { params: { t: token } });
        if (!cancelled) {
          setPrizes(res.data.products ?? []);
          setPrizesBalance(res.data.loyaltyPointsBalance ?? 0);
        }
      } catch {
        if (!cancelled) {
          setPrizes([]);
          setPrizesBalance(data?.loyalty.balance ?? 0);
        }
      } finally {
        if (!cancelled) setPrizesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, token, prizes.length, data?.loyalty.balance]);

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
            <p className="owner-store-sub">{data.store.ownerName}</p>
            <a href={`tel:${data.store.phone}`} className="owner-store-phone">
              {data.store.phone}
            </a>
            <span
              className={`owner-badge${data.store.deferredPaymentEnabled ? " owner-badge--on" : " owner-badge--off"}`}
            >
              {data.store.deferredPaymentEnabled ? t.owner.deferredOn : t.owner.deferredOff}
            </span>
          </div>
        </div>
      </div>

      <nav className="owner-tabs" aria-label={t.owner.tabsAria}>
        {(["overview", "products", "prizes", "visits"] as const).map((key) => (
          <button key={key} type="button" className={`owner-tab${tab === key ? " owner-tab--on" : ""}`} onClick={() => setTab(key)}>
            {t.owner.tabs[key]}
          </button>
        ))}
      </nav>

      <main className="owner-main">
        {tab === "overview" && <OwnerOverviewTab data={data} strings={t.owner} />}

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

        {tab === "prizes" && (
          <section className="owner-section">
            <h2 className="owner-section-title">{t.owner.prizesTitle}</h2>
            <p className="owner-muted" style={{ marginBottom: 12 }}>
              {t.owner.prizesViewOnly}
            </p>
            <div className="owner-loyalty-card-wrap">
              <OwnerLoyaltyExpiryCard data={data.loyalty} strings={t.owner} />
            </div>
            {prizesLoading ? (
              <p className="owner-muted">{t.common.loading}</p>
            ) : prizes.length === 0 ? (
              <p className="owner-empty">{t.owner.emptyPrizes}</p>
            ) : (
              <div className="owner-products-grid">
                {prizes.map((p) => {
                  const img = mediaUrl(p.imageUrl);
                  return (
                    <article key={p.id} className="owner-product owner-product-card" style={{ cursor: "default" }}>
                      {img ? (
                        <img src={img} alt="" className="owner-product-img" />
                      ) : (
                        <div className="owner-product-img owner-product-img--empty">{t.owner.noImage}</div>
                      )}
                      <div className="owner-product-body">
                        <h3 className="owner-product-name">{p.name}</h3>
                        <LoyaltyBadge
                          text={t.owner.redeemPerUnit(p.redeemPointsPerUnit)}
                          variant="pill"
                          icon="star"
                        />
                      </div>
                    </article>
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
