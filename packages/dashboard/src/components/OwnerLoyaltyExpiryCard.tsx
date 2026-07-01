import LoyaltyIcon from "./LoyaltyIcon";

export type LoyaltyExpiryData = {
  balance: number;
  expiryDays: number;
  periodStartedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  periodActive: boolean;
};

type Strings = {
  loyaltyBalance: string;
  loyaltyPoints: (n: number) => string;
  loyaltyExpiryTitle: string;
  loyaltyExpiryHint: (days: number) => string;
  loyaltyDaysLeft: (n: number) => string;
  loyaltyExpiresToday: string;
  loyaltyPeriodStart: string;
  loyaltyExpiresOn: string;
  loyaltyNoActivePeriod: string;
};

type Props = {
  data: LoyaltyExpiryData;
  strings: Strings;
  formatDate: (iso: string) => string;
};

export default function OwnerLoyaltyExpiryCard({ data, strings: o, formatDate }: Props) {
  const { balance, expiryDays, periodStartedAt, expiresAt, daysRemaining, periodActive } = data;
  const progress =
    periodActive && daysRemaining != null && expiryDays > 0
      ? Math.min(100, Math.max(0, ((expiryDays - daysRemaining) / expiryDays) * 100))
      : 0;
  const urgent = daysRemaining != null && daysRemaining <= 14;
  const critical = daysRemaining != null && daysRemaining <= 7;

  return (
    <article
      className={`owner-dash-hero-card owner-dash-hero-card--loyalty owner-loyalty-expiry${urgent ? " owner-loyalty-expiry--urgent" : ""}${critical ? " owner-loyalty-expiry--critical" : ""}`}
    >
      <div className="owner-dash-hero-card-top">
        <span className="owner-dash-hero-kicker">{o.loyaltyBalance}</span>
        <span className="owner-dash-hero-icon owner-dash-hero-icon--loyalty" aria-hidden>
          <LoyaltyIcon kind="balance" size={22} />
        </span>
      </div>
      <p className="owner-dash-hero-value">{o.loyaltyPoints(balance)}</p>

      {periodActive && daysRemaining != null ? (
        <div className="owner-loyalty-expiry-body">
          <div className="owner-loyalty-expiry-head">
            <span className="owner-loyalty-expiry-label">{o.loyaltyExpiryTitle}</span>
            <span className="owner-loyalty-expiry-count">
              {daysRemaining === 0 ? o.loyaltyExpiresToday : o.loyaltyDaysLeft(daysRemaining)}
            </span>
          </div>
          <div className="owner-loyalty-expiry-track" role="progressbar" aria-valuenow={daysRemaining} aria-valuemin={0} aria-valuemax={expiryDays}>
            <span className="owner-loyalty-expiry-fill" style={{ width: `${100 - progress}%` }} />
          </div>
          <p className="owner-loyalty-expiry-meta">
            {periodStartedAt ? (
              <>
                {o.loyaltyPeriodStart}: {formatDate(periodStartedAt)}
                {expiresAt ? (
                  <>
                    {" · "}
                    {o.loyaltyExpiresOn}: {formatDate(expiresAt)}
                  </>
                ) : null}
              </>
            ) : null}
          </p>
          <p className="owner-loyalty-expiry-hint">{o.loyaltyExpiryHint(expiryDays)}</p>
        </div>
      ) : balance > 0 ? (
        <p className="owner-loyalty-expiry-hint">{o.loyaltyNoActivePeriod}</p>
      ) : (
        <p className="owner-loyalty-expiry-hint">{o.loyaltyExpiryHint(expiryDays)}</p>
      )}
    </article>
  );
}
