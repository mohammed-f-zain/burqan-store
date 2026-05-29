import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { NO_BUY_REASONS } from "../constants/noBuyReasons";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { toastError } from "../lib/toast";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";

type VisitRow = {
  id: string;
  visitedAt: string;
  note: string | null;
  isNoBuyReason: boolean;
  storeId: number;
  storeName: string;
  areaName: string;
  repId: number;
  repName: string;
};

export default function VisitsPage() {
  const { t } = useLocale();
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [noBuyOnly, setNoBuyOnly] = useState(true);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ visits: VisitRow[] }>("/visits", {
        params: { noBuyOnly: noBuyOnly ? "1" : "0" },
      });
      setVisits(data.visits ?? []);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.visits.loadFailed));
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filter changes
  }, [noBuyOnly]);

  const pgn = useClientPagination(visits);

  const countsByReason = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of NO_BUY_REASONS) m.set(r, 0);
    for (const v of visits) {
      if (v.isNoBuyReason && v.note) m.set(v.note, (m.get(v.note) ?? 0) + 1);
    }
    return m;
  }, [visits]);

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.visits.title}</h2>
        <p className="muted small">{t.visits.hint}</p>

        <div className="visits-reason-chips">
          {NO_BUY_REASONS.map((reason) => (
            <span key={reason} className="visits-reason-chip">
              {reason}
              <span className="visits-reason-chip-count">{countsByReason.get(reason) ?? 0}</span>
            </span>
          ))}
        </div>

        <label className="visits-filter">
          <input
            type="checkbox"
            checked={noBuyOnly}
            onChange={(e) => setNoBuyOnly(e.target.checked)}
          />
          {t.visits.noBuyOnly}
        </label>

        {loading ? <p className="muted">{t.common.loading}</p> : null}

        {!loading && visits.length > 0 && (
          <PaginationBar
            className="pagination-bar--flush"
            page={pgn.page}
            totalPages={pgn.totalPages}
            totalItems={pgn.total}
            from={pgn.from}
            to={pgn.to}
            pageSize={pgn.pageSize}
            pageSizeOptions={pgn.pageSizeOptions}
            onPageChange={pgn.setPage}
            onPageSizeChange={pgn.setPageSize}
            labels={t.pagination}
          />
        )}

        {!loading && visits.length === 0 ? <p className="muted">{t.visits.empty}</p> : null}

        {!loading && pgn.slice.length > 0 ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t.visits.colTime}</th>
                  <th>{t.visits.colStore}</th>
                  <th>{t.visits.colRep}</th>
                  <th>{t.visits.colReason}</th>
                </tr>
              </thead>
              <tbody>
                {pgn.slice.map((v) => (
                  <tr key={v.id}>
                    <td className="muted small">{formatMarketDateTime(v.visitedAt)}</td>
                    <td>
                      <Link to={`/app/stores/${v.storeId}`} className="linkish">
                        {v.storeName}
                      </Link>
                      <div className="muted small">{v.areaName}</div>
                    </td>
                    <td>{v.repName}</td>
                    <td>
                      {v.isNoBuyReason && v.note ? (
                        <span className="no-buy-pill">{v.note}</span>
                      ) : (
                        <span className="muted">{v.note?.trim() || "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
