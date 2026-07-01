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
  loyaltyDaysLeft: (n: number) => string;
  loyaltyExpiresToday: string;
  loyaltyPeriodDays: (n: number) => string;
};

type Props = {
  data: LoyaltyExpiryData;
  strings: Strings;
};

export default function OwnerLoyaltyExpiryCard({ data, strings: o }: Props) {
  const { balance, expiryDays, daysRemaining, periodActive } = data;
  const remainingPct =
    periodActive && daysRemaining != null && expiryDays > 0
      ? Math.min(100, Math.max(0, (daysRemaining / expiryDays) * 100))
      : 0;
  const urgent = daysRemaining != null && daysRemaining <= 14;
  const critical = daysRemaining != null && daysRemaining <= 7;

  return (
    <article
      className={`owner-loyalty-card${urgent ? " owner-loyalty-card--urgent" : ""}${critical ? " owner-loyalty-card--critical" : ""}`}
    >
      <div className="owner-loyalty-card-top">
        <div className="owner-loyalty-card-balance">
          <span className="owner-loyalty-card-kicker">{o.loyaltyBalance}</span>
          <p className="owner-loyalty-card-value">{o.loyaltyPoints(balance)}</p>
        </div>
        <span className="owner-loyalty-card-icon" aria-hidden>
          <LoyaltyIcon kind="balance" size={24} />
        </span>
      </div>

      {periodActive && daysRemaining != null ? (
        <div className="owner-loyalty-progress">
          <div className="owner-loyalty-progress-head">
            <span className="owner-loyalty-progress-title">{o.loyaltyExpiryTitle}</span>
            <span className="owner-loyalty-progress-badge">
              {daysRemaining === 0 ? o.loyaltyExpiresToday : o.loyaltyDaysLeft(daysRemaining)}
            </span>
          </div>
          <div
            className="owner-loyalty-progress-track"
            role="progressbar"
            aria-valuenow={daysRemaining}
            aria-valuemin={0}
            aria-valuemax={expiryDays}
            aria-label={o.loyaltyExpiryTitle}
          >
            <span className="owner-loyalty-progress-fill" style={{ width: `${remainingPct}%` }} />
          </div>
          <div className="owner-loyalty-progress-foot">
            <span>0</span>
            <span>{o.loyaltyPeriodDays(expiryDays)}</span>
          </div>
        </div>
      ) : null}
    </article>
  );
}
