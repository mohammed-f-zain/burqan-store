import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { downloadQrPoolExcel } from "../lib/exportQrPoolExcel";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";
import { toastInfo, toastError, toastSuccess } from "../lib/toast";
import { hasConfiguredQrBaseUrl, qrPayload } from "../utils/qrPayload";

type Item = { id: string; publicToken: string; createdAt: string };

const GENERATE_PRESETS = [10, 25, 50, 100] as const;
const MAX_GENERATE = 500;

export default function QrPoolPage() {
  const { t } = useLocale();
  const { can } = useAuth();
  const canRead = can("qr_pool.read");
  const canGenerate = can("qr_pool.write");
  const [items, setItems] = useState<Item[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [unassignedCount, setUnassignedCount] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateCount, setGenerateCount] = useState("50");
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const qrPgn = useClientPagination(items);

  const load = useCallback(async (cursor: number | null, append: boolean) => {
    setLoadFailed(false);
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
        if (!cancelled) {
          setLoadFailed(true);
          toastError(t.qrPool.loadFailed);
        }
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
      toastInfo(t.qrPool.copied);
    } catch {
      /* ignore */
    }
  }

  async function submitGenerate(e: FormEvent) {
    e.preventDefault();
    const count = parseInt(generateCount, 10);
    if (!Number.isFinite(count) || count < 1 || count > MAX_GENERATE) return;
    setGenerating(true);
    try {
      const { data } = await api.post<{ inserted: number; unassignedCount: number }>("/qr-pool/generate", {
        count,
      });
      setUnassignedCount(data.unassignedCount);
      setGenerateOpen(false);
      toastSuccess(t.qrPool.generateSuccess.replace("{count}", String(data.inserted)));
      setLoading(true);
      await load(null, false);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.qrPool.generateFailed));
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const { data } = await api.get<{
        items: { id: string; publicToken: string; scanUrl: string; createdAt: string }[];
        exportedCount: number;
      }>("/qr-pool/export");
      if (!data.items.length) {
        toastInfo(t.qrPool.exportEmpty);
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadQrPoolExcel(
        data.items,
        {
          id: t.qrPool.exportColId,
          token: t.qrPool.exportColToken,
          qr: t.qrPool.exportColQr,
          scanUrl: t.qrPool.exportColScanUrl,
          created: t.qrPool.exportColCreated,
        },
        t.qrPool.exportSheetName,
        `burqan-qr-cards-${stamp}`
      );
      toastSuccess(t.qrPool.exportSuccess.replace("{count}", String(data.exportedCount)));
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.qrPool.exportFailed));
    } finally {
      setExporting(false);
    }
  }

  const hasBaseUrl = useMemo(() => hasConfiguredQrBaseUrl(), []);

  return (
    <div className="grid">
      <div className="card">
        <div className="row spread" style={{ alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 style={{ marginTop: 0 }}>{t.qrPool.title}</h2>
            <p className="muted">{t.qrPool.intro}</p>
            {!hasBaseUrl && <p className="muted small">{t.qrPool.envHint}</p>}
            {unassignedCount != null && (
              <p>
                <strong>{unassignedCount}</strong> — {t.qrPool.unassignedCount}
              </p>
            )}
            {loading && <p className="muted">{t.common.loading}</p>}
          </div>
          <div className="row" style={{ gap: 8, flexShrink: 0 }}>
            {canRead && (
              <button type="button" className="ghost" disabled={exporting || loading} onClick={() => void exportExcel()}>
                {exporting ? t.common.loading : t.qrPool.exportExcel}
              </button>
            )}
            {canGenerate && (
              <button type="button" className="primary" onClick={() => setGenerateOpen(true)}>
                {t.qrPool.generate}
              </button>
            )}
          </div>
        </div>
      </div>

      {!loading && items.length === 0 && !loadFailed && (
        <div className="card">
          <p className="muted">{t.qrPool.none}</p>
          {canGenerate && (
            <button type="button" className="primary" style={{ marginTop: 12 }} onClick={() => setGenerateOpen(true)}>
              {t.qrPool.generate}
            </button>
          )}
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
                      <td className="small muted">{formatMarketDateTime(row.createdAt)}</td>
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

      {generateOpen && (
        <div className="modal-backdrop" onClick={() => !generating && setGenerateOpen(false)} role="presentation">
          <div className="modal card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="qr-generate-title">
            <h3 id="qr-generate-title">{t.qrPool.generateTitle}</h3>
            <p className="muted small">{t.qrPool.generateHint}</p>
            <form onSubmit={(ev) => void submitGenerate(ev)} className="form">
              <label>
                {t.qrPool.generateCount}
                <input
                  type="number"
                  min={1}
                  max={MAX_GENERATE}
                  step={1}
                  value={generateCount}
                  onChange={(e) => setGenerateCount(e.target.value)}
                  required
                  disabled={generating}
                />
              </label>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {GENERATE_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="ghost small"
                    disabled={generating}
                    onClick={() => setGenerateCount(String(n))}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="row spread">
                <button type="button" className="ghost" disabled={generating} onClick={() => setGenerateOpen(false)}>
                  {t.qrPool.generateCancel}
                </button>
                <button type="submit" className="primary" disabled={generating}>
                  {generating ? t.common.loading : t.qrPool.generateSubmit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
