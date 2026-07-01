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
  loyaltyDaysRemainingLabel: string;
  loyaltyDaysFraction: (remaining: number, total: number) => string;
  loyaltyExpiresOnDate: (date: string) => string;
  loyaltyExpiresToday: string;
  loyaltyPeriodChip: (days: number) => string;
  loyaltyPercentRemaining: (n: number) => string;
};

type Props = {
  data: LoyaltyExpiryData;
  strings: Strings;
  formatDate: (iso: string) => string;
};

export default function OwnerLoyaltyExpiryCard({ data, strings: o, formatDate }: Props) {
  const { balance, expiryDays, expiresAt, daysRemaining, periodActive } = data;
  const remainingPct =
    periodActive && daysRemaining != null && expiryDays > 0
      ? Math.min(100, Math.max(0, (daysRemaining / expiryDays) * 100))
      : 0;
  const urgent = daysRemaining != null && daysRemaining <= 14;
  const critical = daysRemaining != null && daysRemaining <= 7;
  const showExpiry = periodActive && daysRemaining != null;
  const percentLabel = o.loyaltyPercentRemaining(Math.round(remainingPct));

  return (
    <article
      className={`owner-loyalty-card${urgent ? " owner-loyalty-card--urgent" : ""}${critical ? " owner-loyalty-card--critical" : ""}${showExpiry ? "" : " owner-loyalty-card--solo"}`}
      aria-label={o.loyaltyBalance}
    >
      <div className="owner-loyalty-split">
        <section className="owner-loyalty-pane owner-loyalty-pane--balance">
          <div className="owner-loyalty-pane-deco" aria-hidden>
            <LoyaltyIcon kind="star" size={64} />
          </div>
          <div className="owner-loyalty-balance-head">
            <div className="owner-loyalty-pane-balance-text">
              <span className="owner-loyalty-pane-kicker">{o.loyaltyBalance}</span>
              <p className="owner-loyalty-pane-value">{o.loyaltyPoints(balance)}</p>
            </div>
            <span className="owner-loyalty-pane-icon" aria-hidden>
              <LoyaltyIcon kind="balance" size={22} />
            </span>
          </div>
          {showExpiry ? (
            <span className="owner-loyalty-period-chip">{o.loyaltyPeriodChip(expiryDays)}</span>
          ) : null}
        </section>

        {showExpiry ? (
          <section className="owner-loyalty-pane owner-loyalty-pane--timer" aria-label={o.loyaltyDaysRemainingLabel}>
            <div className="owner-loyalty-timer-row">
              <div
                className="owner-loyalty-ring"
                style={{ "--loyalty-pct": `${remainingPct}%` }}
                aria-hidden
              >
                <span className="owner-loyalty-ring-label">{percentLabel}</span>
              </div>
              <div className="owner-loyalty-timer-body">
                <div className="owner-loyalty-countdown">
                  <span className="owner-loyalty-countdown-number">
                    {daysRemaining === 0 ? "0" : daysRemaining}
                  </span>
                  <span className="owner-loyalty-countdown-label">
                    {daysRemaining === 0 ? o.loyaltyExpiresToday : o.loyaltyDaysRemainingLabel}
                  </span>
                </div>
                <div
                  className="owner-loyalty-progress-track"
                  role="progressbar"
                  aria-valuenow={daysRemaining}
                  aria-valuemin={0}
                  aria-valuemax={expiryDays}
                  aria-label={o.loyaltyDaysFraction(daysRemaining, expiryDays)}
                >
                  <span className="owner-loyalty-progress-fill" style={{ width: `${remainingPct}%` }} />
                </div>
                <p className="owner-loyalty-progress-fraction">
                  {o.loyaltyDaysFraction(daysRemaining, expiryDays)}
                </p>
                {expiresAt && daysRemaining > 0 ? (
                  <p className="owner-loyalty-expires-on">{o.loyaltyExpiresOnDate(formatDate(expiresAt))}</p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}
