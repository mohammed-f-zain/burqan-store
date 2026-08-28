import { Link } from "react-router-dom";

type DayPoint = {
  date: string;
  revenue: number;
  orderCount: number;
  visitCount: number;
};

type Props = {
  days: DayPoint[];
  formatMoney: (n: number) => string;
  formatDayLabel: (date: string) => string;
  revenueLabel: string;
  ordersLabel: string;
  todayLabel: string;
  dayHref?: (date: string) => string;
};

export default function DailySalesChart({
  days,
  formatMoney,
  formatDayLabel,
  revenueLabel,
  ordersLabel,
  todayLabel,
  dayHref,
}: Props) {
  if (!days.length) return null;

  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);

  return (
    <div className="dash-chart-panel">
      <div className="dash-chart dash-chart--daily" role="img" aria-label={revenueLabel}>
        {days.map((d) => {
          const heightPct = Math.max(6, Math.round((d.revenue / maxRevenue) * 100));
          const isToday = d.date === days[days.length - 1]?.date;
          const title = `${formatDayLabel(d.date)} — ${formatMoney(d.revenue)} · ${d.orderCount} ${ordersLabel}`;
          const bar = (
            <>
              <div className="dash-chart-bar-wrap">
                <div
                  className={`dash-chart-bar${isToday ? " dash-chart-bar--today" : ""}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <div className="dash-chart-value">{d.orderCount > 0 ? formatMoney(d.revenue) : "—"}</div>
              <div className="dash-chart-label">{formatDayLabel(d.date)}</div>
            </>
          );
          const href = dayHref?.(d.date);
          return href ? (
            <Link key={d.date} to={href} className="dash-chart-col dash-chart-col--link" title={title}>
              {bar}
            </Link>
          ) : (
            <div key={d.date} className="dash-chart-col" title={title}>
              {bar}
            </div>
          );
        })}
      </div>
      <div className="dash-chart-legend muted small">
        <span className="dash-chart-legend-item">
          <span className="dash-chart-legend-swatch dash-chart-legend-swatch--bar" />
          {revenueLabel}
        </span>
        <span className="dash-chart-legend-item">
          <span className="dash-chart-legend-swatch dash-chart-legend-swatch--today" />
          {todayLabel}
        </span>
      </div>
    </div>
  );
}
