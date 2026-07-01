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

  const expiryCaption =
    daysRemaining === 0
      ? o.loyaltyExpiresToday
      : [
          o.loyaltyDaysFraction(daysRemaining!, expiryDays),
          expiresAt && daysRemaining! > 0 ? o.loyaltyExpiresOnDate(formatDate(expiresAt)) : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <section
      className={`owner-loyalty-panel${urgent ? " owner-loyalty-panel--urgent" : ""}${critical ? " owner-loyalty-panel--critical" : ""}`}
      aria-label={o.loyaltyBalance}
    >
      <div className={`owner-loyalty-panel__main${showExpiry ? "" : " owner-loyalty-panel__main--solo"}`}>
        <div className="owner-loyalty-panel__balance">
          <span className="owner-loyalty-panel__icon" aria-hidden>
            <LoyaltyIcon kind="balance" size={22} />
          </span>
          <div className="owner-loyalty-panel__balance-text">
            <span className="owner-loyalty-panel__kicker">{o.loyaltyBalance}</span>
            <p className="owner-loyalty-panel__value">{o.loyaltyPoints(balance)}</p>
          </div>
        </div>

        {showExpiry ? (
          <>
            <div className="owner-loyalty-panel__divider" aria-hidden />
            <div className="owner-loyalty-panel__expiry">
              <div className="owner-loyalty-panel__days">
                <span className="owner-loyalty-panel__days-num">
                  {daysRemaining === 0 ? "0" : daysRemaining}
                </span>
                <span className="owner-loyalty-panel__days-label">
                  {daysRemaining === 0 ? o.loyaltyExpiresToday : o.loyaltyDaysRemainingLabel}
                </span>
              </div>
              <div
                className="owner-loyalty-panel__track"
                role="progressbar"
                aria-valuenow={daysRemaining}
                aria-valuemin={0}
                aria-valuemax={expiryDays}
                aria-label={expiryCaption}
              >
                <span className="owner-loyalty-panel__fill" style={{ width: `${remainingPct}%` }} />
              </div>
              <p className="owner-loyalty-panel__caption">{expiryCaption}</p>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
