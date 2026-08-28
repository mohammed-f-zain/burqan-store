import { Link } from "react-router-dom";

type Props = {
  cash: number;
  deferred: number;
  formatMoney: (n: number) => string;
  cashLabel: string;
  deferredLabel: string;
  title: string;
  cashHref?: string;
  deferredHref?: string;
};

export default function PaymentMixChart({
  cash,
  deferred,
  formatMoney,
  cashLabel,
  deferredLabel,
  title,
  cashHref,
  deferredHref,
}: Props) {
  const total = cash + deferred;
  if (total <= 0) {
    return <p className="muted small">{title}</p>;
  }

  const cashPct = Math.round((cash / total) * 100);
  const deferredPct = 100 - cashPct;

  const cashRow = (
    <>
      <span className="payment-mix-dot payment-mix-dot--cash" />
      <span>{cashLabel}</span>
      <strong>{formatMoney(cash)}</strong>
      <span className="muted small">{cashPct}%</span>
    </>
  );
  const deferredRow = (
    <>
      <span className="payment-mix-dot payment-mix-dot--deferred" />
      <span>{deferredLabel}</span>
      <strong>{formatMoney(deferred)}</strong>
      <span className="muted small">{deferredPct}%</span>
    </>
  );

  return (
    <div className="payment-mix">
      <div className="payment-mix-bar" role="img" aria-label={title}>
        <div className="payment-mix-seg payment-mix-seg--cash" style={{ width: `${cashPct}%` }} />
        <div className="payment-mix-seg payment-mix-seg--deferred" style={{ width: `${deferredPct}%` }} />
      </div>
      <div className="payment-mix-rows">
        {cashHref ? (
          <Link to={cashHref} className="payment-mix-row payment-mix-row--link">
            {cashRow}
          </Link>
        ) : (
          <div className="payment-mix-row">{cashRow}</div>
        )}
        {deferredHref ? (
          <Link to={deferredHref} className="payment-mix-row payment-mix-row--link">
            {deferredRow}
          </Link>
        ) : (
          <div className="payment-mix-row">{deferredRow}</div>
        )}
      </div>
    </div>
  );
}
