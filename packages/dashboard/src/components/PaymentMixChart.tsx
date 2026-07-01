type Props = {
  cash: number;
  deferred: number;
  formatMoney: (n: number) => string;
  cashLabel: string;
  deferredLabel: string;
  title: string;
};

export default function PaymentMixChart({ cash, deferred, formatMoney, cashLabel, deferredLabel, title }: Props) {
  const total = cash + deferred;
  if (total <= 0) {
    return <p className="muted small">{title}</p>;
  }

  const cashPct = Math.round((cash / total) * 100);
  const deferredPct = 100 - cashPct;

  return (
    <div className="payment-mix">
      <div className="payment-mix-bar" role="img" aria-label={title}>
        <div className="payment-mix-seg payment-mix-seg--cash" style={{ width: `${cashPct}%` }} />
        <div className="payment-mix-seg payment-mix-seg--deferred" style={{ width: `${deferredPct}%` }} />
      </div>
      <div className="payment-mix-rows">
        <div className="payment-mix-row">
          <span className="payment-mix-dot payment-mix-dot--cash" />
          <span>{cashLabel}</span>
          <strong>{formatMoney(cash)}</strong>
          <span className="muted small">{cashPct}%</span>
        </div>
        <div className="payment-mix-row">
          <span className="payment-mix-dot payment-mix-dot--deferred" />
          <span>{deferredLabel}</span>
          <strong>{formatMoney(deferred)}</strong>
          <span className="muted small">{deferredPct}%</span>
        </div>
      </div>
    </div>
  );
}
