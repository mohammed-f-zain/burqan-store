import OwnerLoyaltyExpiryCard from "./OwnerLoyaltyExpiryCard";
import LoyaltyIcon from "./LoyaltyIcon";
import LoyaltyBadge from "./LoyaltyBadge";
import SectionTitleWithIcon from "./SectionTitleWithIcon";
import type { ar } from "../i18n/ar";
import { mediaUrl } from "../lib/mediaUrl";
import { ownerFormatMoney } from "../owner/ownerFormat";
import { formatMarketDate, formatMarketDateTime } from "../utils/formatMarketDateTime";

type OverviewData = {
  loyalty: {
    balance: number;
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
  loyaltyRecent: {
    orderId: string;
    createdAt: string;
    productName: string;
    quantity: number;
    points: number;
  }[];
  topProducts: { productId: number; name: string; imageUrl: string | null; quantity: number; total: number }[];
};

type OwnerStrings = (typeof ar)["owner"];

type Props = {
  data: OverviewData;
  strings: OwnerStrings;
};

function DashMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "accent" | "danger";
}) {
  return (
    <div className={`owner-metric owner-metric--${tone}`}>
      <span className="owner-metric-label">{label}</span>
      <span className="owner-metric-value">{value}</span>
    </div>
  );
}

export default function OwnerOverviewTab({ data, strings: o }: Props) {
  const currency = o.currency;

  return (
    <div className="owner-dashboard">
      <div className="owner-dash-hero owner-dash-hero--single">
        <OwnerLoyaltyExpiryCard
          data={data.loyalty}
          strings={o}
          formatDate={(iso) => formatMarketDate(iso, "ar")}
        />
      </div>

      <section className="owner-dash-panel" aria-labelledby="owner-dash-activity">
        <h2 id="owner-dash-activity" className="owner-dash-panel-title">
          {o.overviewActivity}
        </h2>
        <div className="owner-dash-metrics">
          <DashMetric label={o.statOrders} value={data.stats.orderCount} />
          <DashMetric label={o.statVisits} value={data.stats.visitCount} tone="accent" />
        </div>
      </section>

      {data.loyaltyRecent.length > 0 && (
        <section className="owner-dash-panel">
          <SectionTitleWithIcon icon={<LoyaltyIcon kind="earn" size={22} />} className="owner-dash-panel-title owner-dash-panel-title--icon">
            {o.loyaltyRecentTitle}
          </SectionTitleWithIcon>
          <ul className="owner-loyalty-list owner-loyalty-list--dash">
            {data.loyaltyRecent.map((row, i) => (
              <li key={`${row.orderId}-${i}`} className="owner-loyalty-item">
                <span className="owner-loyalty-item-icon" aria-hidden>
                  <LoyaltyIcon kind="plus" size={20} />
                </span>
                <div className="owner-loyalty-main">
                  <span className="owner-loyalty-product">{row.productName}</span>
                  <span className="owner-loyalty-meta">
                    {o.lineQty(row.quantity)} · {formatMarketDateTime(row.createdAt, "ar")}
                  </span>
                </div>
                <LoyaltyBadge text={o.loyaltyLinePoints(row.points)} variant="inline" icon="star" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.topProducts.length > 0 && (
        <section className="owner-dash-panel">
          <h2 className="owner-dash-panel-title">{o.topProducts}</h2>
          <ul className="owner-top-list owner-top-list--ranked">
            {data.topProducts.map((p, index) => {
              const img = mediaUrl(p.imageUrl);
              return (
                <li key={p.productId} className="owner-top-item">
                  <span className={`owner-top-rank${index < 3 ? ` owner-top-rank--${index + 1}` : ""}`}>{index + 1}</span>
                  {img ? (
                    <img src={img} alt="" className="owner-top-thumb" />
                  ) : (
                    <div className="owner-top-thumb owner-top-thumb--empty" />
                  )}
                  <div className="owner-top-body">
                    <div className="owner-top-name">{p.name}</div>
                    <div className="owner-top-sub">
                      {o.qtyUnits(p.quantity)} · {ownerFormatMoney(p.total, currency)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
