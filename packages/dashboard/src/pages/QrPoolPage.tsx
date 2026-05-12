import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { api } from "../api";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";

type Item = { id: string; publicToken: string; createdAt: string };

function qrPayload(publicToken: string): string {
  const base = import.meta.env.VITE_QR_PAYLOAD_BASE_URL?.trim().replace(/\/$/, "");
  if (base) return `${base}/r/${encodeURIComponent(publicToken)}`;
  return publicToken;
}

export default function QrPoolPage() {
  const { t } = useLocale();
  const [items, setItems] = useState<Item[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [unassignedCount, setUnassignedCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const qrPgn = useClientPagination(items);

  const load = useCallback(async (cursor: number | null, append: boolean) => {
    setErr(null);
    const params: Record<string, string> = { limit: "80" };
    if (cursor != null) params.cursor = String(cursor);
    const { data } = await api.get<{ items: Item[]; nextCursor: number | null; unassignedCount: number }>("/qr-pool", {
      params,
    });
    setUnassignedCount(data.unassignedCount);
    setNextCursor(data.nextCursor);
    setItems((prev) => (append ? [...prev, ...data.items] : data.items));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load(null, false);
      } catch {
        if (!cancelled) setErr(t.qrPool.loadFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  async function copyToken(tok: string) {
    try {
      await navigator.clipboard.writeText(tok);
      alert(t.qrPool.copied);
    } catch {
      /* ignore */
    }
  }

  const hasBaseUrl = useMemo(() => Boolean(import.meta.env.VITE_QR_PAYLOAD_BASE_URL?.trim()), []);

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.qrPool.title}</h2>
        <p className="muted">{t.qrPool.intro}</p>
        {!hasBaseUrl && <p className="muted small">{t.qrPool.envHint}</p>}
        {unassignedCount != null && (
          <p>
            <strong>{unassignedCount}</strong> — {t.qrPool.unassignedCount}
          </p>
        )}
        {err && <div className="error">{err}</div>}
        {loading && <p className="muted">{t.common.loading}</p>}
      </div>

      {!loading && items.length === 0 && !err && (
        <div className="card">
          <p className="muted">{t.qrPool.none}</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="card">
          <p className="muted small">{t.qrPool.payloadHint}</p>
          {items.length > 0 && (
            <PaginationBar
              className="pagination-bar--flush"
              page={qrPgn.page}
              totalPages={qrPgn.totalPages}
              totalItems={qrPgn.total}
              from={qrPgn.from}
              to={qrPgn.to}
              pageSize={qrPgn.pageSize}
              pageSizeOptions={qrPgn.pageSizeOptions}
              onPageChange={qrPgn.setPage}
              onPageSizeChange={qrPgn.setPageSize}
            />
          )}
          <div className="table-wrap">
            <table className="table qr-pool-table">
              <thead>
                <tr>
                  <th>{t.qrPool.colId}</th>
                  <th>{t.qrPool.colToken}</th>
                  <th>{t.qrPool.colQr}</th>
                  <th>{t.qrPool.colCreated}</th>
                </tr>
              </thead>
              <tbody>
                {qrPgn.slice.map((row) => {
                  const payload = qrPayload(row.publicToken);
                  return (
                    <tr key={row.id}>
                      <td className="mono small">{row.id}</td>
                      <td>
                        <span className="mono small break-all">{row.publicToken}</span>
                        <div style={{ marginTop: 6 }}>
                          <button type="button" className="ghost small" onClick={() => void copyToken(row.publicToken)}>
                            {t.qrPool.copy}
                          </button>
                        </div>
                      </td>
                      <td className="qr-cell">
                        <QRCodeSVG value={payload} size={96} level="M" includeMargin={false} />
                      </td>
                      <td className="small muted">{new Date(row.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {nextCursor != null && (
            <button type="button" className="primary" style={{ marginTop: 14 }} onClick={() => void load(nextCursor, true)}>
              {t.qrPool.loadMore}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
