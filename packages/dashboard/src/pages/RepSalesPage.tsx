import { Fragment, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { toastError } from "../lib/toast";

type SalesLine = {
  product_id: number;
  product_name: string;
  quantity: number;
  line_total: string;
};

type RepSales = {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  order_count: number;
  total_sales: string;
  lines: SalesLine[];
};

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function RepSalesPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const canRead = can("reps.read") || can("fill_car.read");
  const canFill = can("fill_car.write") || can("reps.write");

  const [date, setDate] = useState(todayLocal);
  const [reps, setReps] = useState<RepSales[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const { data } = await api.get<{ date: string; representatives: RepSales[] }>(
        "/representatives/sales-daily",
        { params: { date } }
      );
      setReps(data.representatives ?? []);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.repSales.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [canRead, date, t.repSales.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead) {
    return (
      <div className="card">
        <h2>{t.repSales.title}</h2>
        <p className="muted">{t.repSales.denied}</p>
      </div>
    );
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.repSales.title}</h2>
        <p className="muted">{t.repSales.hint}</p>

        <div className="form row spread" style={{ maxWidth: 420, alignItems: "flex-end", gap: 12 }}>
          <label style={{ flex: 1 }}>
            {t.repSales.dateLabel}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button type="button" className="primary" disabled={loading} onClick={() => void load()}>
            {loading ? t.common.loading : t.repSales.refresh}
          </button>
        </div>

        {loading && reps.length === 0 ? (
          <p className="muted">{t.common.loading}</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t.repSales.colRep}</th>
                  <th>{t.repSales.colOrders}</th>
                  <th>{t.repSales.colTotal}</th>
                  <th>{t.repSales.colStatus}</th>
                  <th>{t.repSales.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td>
                        <strong>{r.full_name}</strong>
                        <div className="muted small">{r.email}</div>
                      </td>
                      <td>{r.order_count}</td>
                      <td>{r.total_sales}</td>
                      <td>{r.is_active ? t.reps.active : t.reps.disabled}</td>
                      <td>
                        <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                          >
                            {expandedId === r.id ? t.repSales.hideDetail : t.repSales.showDetail}
                          </button>
                          {canFill && (
                            <Link className="ghost" to={`/app/fill-car?repId=${r.id}`}>
                              {t.repSales.editInventory}
                            </Link>
                          )}
                        </span>
                      </td>
                    </tr>
                    {expandedId === r.id && (
                      <tr>
                        <td colSpan={5}>
                          {r.lines.length === 0 ? (
                            <p className="muted small">{t.repSales.noSales}</p>
                          ) : (
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>{t.orders.product}</th>
                                  <th>{t.orders.qty}</th>
                                  <th>{t.orders.line}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.lines.map((l) => (
                                  <tr key={l.product_id}>
                                    <td>{l.product_name}</td>
                                    <td>{l.quantity}</td>
                                    <td>{l.line_total}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
