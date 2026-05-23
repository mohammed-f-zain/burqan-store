import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { ar } from "../i18n/ar";
import { mediaUrl } from "../lib/mediaUrl";
import { useOwnerArabic } from "../owner/useOwnerArabic";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";
import { publicApi } from "../publicApi";

type OrderDetail = {
  id: string;
  paymentType: string;
  totalAmount: number;
  createdAt: string;
  repName: string;
  repImageUrl: string | null;
  repPhone: string;
  lines: {
    productId: number;
    name: string;
    designation: string | null;
    unitLabel: string | null;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};

function formatMoney(n: number, currency: string) {
  return `${n.toLocaleString("ar-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export default function OwnerOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const [params] = useSearchParams();
  const token = params.get("t");
  const t = useOwnerArabic();
  const o = ar.owner;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const backHref = token ? `/owner?t=${encodeURIComponent(token)}` : "/owner";

  const load = useCallback(async () => {
    if (!token || !orderId) {
      setErr(o.missingToken);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await publicApi.get<{ order: OrderDetail }>(`/owner/orders/${orderId}`, { params: { t: token } });
      setOrder(res.data.order);
      setErr(null);
    } catch {
      setErr(o.orderLoadErr);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [token, orderId, o.missingToken, o.orderLoadErr]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="owner-shell">
        <div className="owner-loading">
          <p className="owner-muted">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (err || !order) {
    return (
      <div className="owner-shell">
        <div className="owner-detail-top">
          <Link to={backHref} className="owner-back">
            {o.back}
          </Link>
        </div>
        <div className="owner-error-wrap">
          <p className="owner-error">{err ?? o.orderLoadErr}</p>
        </div>
      </div>
    );
  }

  const repImg = mediaUrl(order.repImageUrl);
  const isCash = order.paymentType === "cash";

  return (
    <div className="owner-shell">
      <div className="owner-detail-top">
        <Link to={backHref} className="owner-back">
          ‹ {o.back}
        </Link>
        <span className="owner-detail-id">#{order.id}</span>
      </div>

      <main className="owner-main owner-main--detail">
        <section className="owner-detail-hero">
          <div className="owner-detail-hero-row">
            <div>
              <p className="owner-detail-kicker">{o.orderDetailTitle}</p>
              <p className="owner-detail-date">{formatMarketDateTime(order.createdAt, "ar")}</p>
            </div>
            <span className={`owner-pay-pill${isCash ? " owner-pay-pill--cash" : " owner-pay-pill--deferred"}`}>
              {isCash ? o.payCash : o.payDeferred}
            </span>
          </div>
          <p className="owner-detail-total">{formatMoney(order.totalAmount, o.currency)}</p>
        </section>

        <section className="owner-detail-rep">
          {repImg ? (
            <img src={repImg} alt="" className="owner-rep-avatar" />
          ) : (
            <div className="owner-rep-avatar owner-rep-avatar--empty">{order.repName.slice(0, 1)}</div>
          )}
          <div className="owner-detail-rep-meta">
            <p className="owner-detail-rep-label">{o.repLabel}</p>
            <p className="owner-detail-rep-name">{order.repName}</p>
            <a href={`tel:${order.repPhone}`} className="owner-detail-rep-phone">
              {order.repPhone}
            </a>
          </div>
        </section>

        <section className="owner-section">
          <h2 className="owner-section-title">
            {o.orderLinesTitle} ({order.lines.length})
          </h2>
          <ul className="owner-line-list">
            {order.lines.map((line) => {
              const img = mediaUrl(line.imageUrl);
              return (
                <li key={line.productId} className="owner-line-item">
                  {img ? (
                    <img src={img} alt="" className="owner-line-thumb" />
                  ) : (
                    <div className="owner-line-thumb owner-line-thumb--empty">{o.noImage}</div>
                  )}
                  <div className="owner-line-body">
                    <p className="owner-line-name">{line.name}</p>
                    {line.designation ? <p className="owner-line-desc">{line.designation}</p> : null}
                    {line.unitLabel ? <p className="owner-line-unit">{line.unitLabel}</p> : null}
                    <p className="owner-line-qty">
                      {o.lineQty(line.quantity)} × {formatMoney(line.unitPrice, o.currency)}
                    </p>
                  </div>
                  <p className="owner-line-total">{formatMoney(line.lineTotal, o.currency)}</p>
                </li>
              );
            })}
          </ul>
          <div className="owner-detail-sum">
            <span>{o.orderTotal}</span>
            <strong>{formatMoney(order.totalAmount, o.currency)}</strong>
          </div>
        </section>
      </main>
    </div>
  );
}
