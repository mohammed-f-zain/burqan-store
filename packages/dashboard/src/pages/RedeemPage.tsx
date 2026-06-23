import { useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import LoyaltyBadge from "../components/LoyaltyBadge";
import LoyaltyIcon from "../components/LoyaltyIcon";
import PaginationBar from "../components/PaginationBar";
import TableFilterBar from "../components/TableFilterBar";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { mediaUrl } from "../lib/mediaUrl";
import { toastError, toastSuccess } from "../lib/toast";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";

type Product = {
  id: number;
  name: string;
  image_url: string | null;
  is_active: boolean;
  redeem_points_per_unit: number;
  redeem_enabled: boolean;
};

type Redemption = {
  id: string;
  createdAt: string;
  totalPointsSpent: number;
  storeName: string;
  repName: string;
  lines: {
    productName: string;
    quantity: number;
    pointsSpent: number;
  }[];
};

export default function RedeemPage() {
  const { can } = useAuth();
  const { t, locale } = useLocale();
  const canWrite = can("redeem.write") || can("products.write");
  const [products, setProducts] = useState<Product[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        api.get<{ products: Product[] }>("/products"),
        can("redeem.read")
          ? api.get<{ redemptions: Redemption[] }>("/redeem/redemptions?limit=40")
          : Promise.resolve({ data: { redemptions: [] } }),
      ]);
      setProducts(pRes.data.products ?? []);
      setRedemptions(rRes.data.redemptions ?? []);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.redeem.loadFailed));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patchProduct(id: number, patch: { redeemEnabled?: boolean; redeemPointsPerUnit?: number }) {
    if (!canWrite) return;
    setSavingId(id);
    try {
      await api.patch(`/products/${id}`, {
        redeemEnabled: patch.redeemEnabled,
        redeemPointsPerUnit: patch.redeemPointsPerUnit,
      });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                redeem_enabled: patch.redeemEnabled ?? p.redeem_enabled,
                redeem_points_per_unit: patch.redeemPointsPerUnit ?? p.redeem_points_per_unit,
              }
            : p
        )
      );
      toastSuccess(t.redeem.saved);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.redeem.saveFailed));
      await load();
    } finally {
      setSavingId(null);
    }
  }

  const activeProducts = useMemo(() => products.filter((p) => p.is_active), [products]);
  const enabledCount = useMemo(() => activeProducts.filter((p) => p.redeem_enabled).length, [activeProducts]);
  const totalPointsRedeemed = useMemo(
    () => redemptions.reduce((s, r) => s + r.totalPointsSpent, 0),
    [redemptions]
  );

  const catalogFilterFields = useMemo(
    () => [
      { id: "name", label: t.redeem.colProduct, type: "text" as const, getValue: (p: Product) => p.name },
      { id: "points", label: t.redeem.colRedeemPoints, type: "text" as const, getValue: (p: Product) => p.redeem_points_per_unit },
      { id: "enabled", label: t.redeem.colEnabled, type: "boolean" as const, getValue: (p: Product) => p.redeem_enabled },
    ],
    [t.redeem.colEnabled, t.redeem.colProduct, t.redeem.colRedeemPoints]
  );

  const catalogTable = useTableFilters(activeProducts, {
    searchAccessors: ["id", "name", "redeem_points_per_unit"],
    fields: catalogFilterFields,
  });
  const catalogPgn = catalogTable.pagination;

  const redemptionFilterFields = useMemo(
    () => [
      { id: "store", label: t.orders.colStore, type: "text" as const, getValue: (r: Redemption) => r.storeName },
      { id: "rep", label: t.orders.colRep, type: "text" as const, getValue: (r: Redemption) => r.repName },
      { id: "points", label: t.redeem.statPointsRedeemed, type: "text" as const, getValue: (r: Redemption) => r.totalPointsSpent },
      { id: "when", label: t.orders.colWhen, type: "text" as const, getValue: (r: Redemption) => formatMarketDateTime(r.createdAt, locale) },
      { id: "lines", label: t.redeem.colProduct, type: "text" as const, getValue: (r: Redemption) => r.lines.map((l) => l.productName).join(", ") },
    ],
    [locale, t.orders.colRep, t.orders.colStore, t.orders.colWhen, t.redeem.colProduct, t.redeem.statPointsRedeemed]
  );

  const historyTable = useTableFilters(redemptions, {
    searchAccessors: [
      "id",
      "storeName",
      "repName",
      "totalPointsSpent",
      (r) => formatMarketDateTime(r.createdAt, locale),
      (r) => r.lines.map((l) => `${l.productName} ${l.quantity}`).join(" "),
    ],
    fields: redemptionFilterFields,
  });

  return (
    <div className="grid redeem-page">
      <header className="redeem-page-header card">
        <div className="redeem-page-header-text">
          <h1 className="redeem-page-title">
            <LoyaltyIcon kind="star" size={28} />
            {t.redeem.title}
          </h1>
          <p className="muted">{t.redeem.subtitle}</p>
        </div>
        <div className="dash-kpi-grid dash-kpi-grid--loyalty redeem-page-kpis">
          <div className="dash-kpi dash-kpi--loyalty">
            <div className="dash-kpi-label">
              <LoyaltyIcon kind="balance" size={18} />
              {t.redeem.statEnabled}
            </div>
            <div className="dash-kpi-value">{enabledCount}</div>
          </div>
          <div className="dash-kpi dash-kpi--loyalty">
            <div className="dash-kpi-label">
              <LoyaltyIcon kind="earn" size={18} />
              {t.redeem.statRedemptions}
            </div>
            <div className="dash-kpi-value">{redemptions.length}</div>
          </div>
          <div className="dash-kpi dash-kpi--accent dash-kpi--loyalty">
            <div className="dash-kpi-label">
              <LoyaltyIcon kind="star" size={18} />
              {t.redeem.statPointsRedeemed}
            </div>
            <div className="dash-kpi-value">{t.overview.loyaltyPoints(totalPointsRedeemed)}</div>
          </div>
        </div>
      </header>

      <div className="card">
        <h2>{t.redeem.catalogTitle}</h2>
        <p className="muted small">{t.redeem.catalogHint}</p>

        {loading ? (
          <p className="muted redeem-page-loading">{t.common.loading}</p>
        ) : (
          <>
            <TableFilterBar
              {...catalogTable}
              onSearchChange={catalogTable.setSearch}
              onFilterChange={catalogTable.setFilter}
              onClear={catalogTable.clearFilters}
              onToggleFilters={() => catalogTable.setShowFilters((v) => !v)}
              labels={t.tableFilters}
            />
            {catalogTable.filteredCount > 0 && (
              <PaginationBar
                className="pagination-bar--flush"
                page={catalogPgn.page}
                totalPages={catalogPgn.totalPages}
                totalItems={catalogPgn.total}
                from={catalogPgn.from}
                to={catalogPgn.to}
                pageSize={catalogPgn.pageSize}
                pageSizeOptions={catalogPgn.pageSizeOptions}
                onPageChange={catalogPgn.setPage}
                onPageSizeChange={catalogPgn.setPageSize}
              />
            )}
            <div className="table-wrap">
              <table className="table redeem-catalog-table">
                <thead>
                  <tr>
                    <th>{t.redeem.colProduct}</th>
                    <th>{t.redeem.colRedeemPoints}</th>
                    <th>{t.redeem.colEnabled}</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogPgn.slice.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted">
                        —
                      </td>
                    </tr>
                  ) : (
                    catalogPgn.slice.map((p) => {
                      const img = mediaUrl(p.image_url);
                      const isSaving = savingId === p.id;
                      return (
                        <tr
                          key={p.id}
                          className={p.redeem_enabled ? "redeem-row redeem-row--on" : "redeem-row redeem-row--off"}
                        >
                          <td>
                            <div className="redeem-product-cell">
                              {img ? (
                                <img src={img} alt="" className="redeem-product-thumb" />
                              ) : (
                                <div className="redeem-product-thumb redeem-product-thumb--empty" aria-hidden>
                                  ?
                                </div>
                              )}
                              <div>
                                <div className="strong">{p.name}</div>
                                {!p.redeem_enabled ? (
                                  <span className="muted small">{t.redeem.inactiveProduct}</span>
                                ) : p.redeem_points_per_unit > 0 ? (
                                  <LoyaltyBadge
                                    text={t.owner.redeemPerUnit(p.redeem_points_per_unit)}
                                    variant="inline"
                                    icon="star"
                                  />
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td>
                            <label className="redeem-points-field">
                              <input
                                aria-label={t.redeem.colRedeemPoints}
                                type="number"
                                min={0}
                                step={1}
                                className="redeem-points-input"
                                defaultValue={p.redeem_points_per_unit ?? 0}
                                disabled={!canWrite || isSaving}
                                onBlur={(e) => {
                                  const v = parseInt(e.target.value, 10) || 0;
                                  if (v !== (p.redeem_points_per_unit ?? 0)) {
                                    void patchProduct(p.id, { redeemPointsPerUnit: v });
                                  }
                                }}
                              />
                              <span className="redeem-points-suffix muted small">{t.redeem.pointsPerUnitLabel}</span>
                            </label>
                          </td>
                          <td>
                            {canWrite ? (
                              <button
                                type="button"
                                className={p.redeem_enabled ? "pill on" : "pill off"}
                                disabled={isSaving}
                                onClick={() =>
                                  void patchProduct(p.id, { redeemEnabled: !p.redeem_enabled })
                                }
                              >
                                {p.redeem_enabled ? t.redeem.toggleDisable : t.redeem.toggleEnable}
                              </button>
                            ) : (
                              <span className={p.redeem_enabled ? "redeem-status-pill redeem-status-pill--on" : "redeem-status-pill"}>
                                {p.redeem_enabled ? t.redeem.enabledYes : t.redeem.enabledNo}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {can("redeem.read") ? (
        <div className="card">
          <h2>{t.redeem.historyTitle}</h2>
          <TableFilterBar
            {...historyTable}
            onSearchChange={historyTable.setSearch}
            onFilterChange={historyTable.setFilter}
            onClear={historyTable.clearFilters}
            onToggleFilters={() => historyTable.setShowFilters((v) => !v)}
            labels={t.tableFilters}
          />
          {redemptions.length === 0 ? (
            <p className="muted">{t.redeem.emptyHistory}</p>
          ) : historyTable.filteredCount === 0 ? (
            <p className="muted">{t.tableFilters.noResults}</p>
          ) : (
            <ul className="redeem-history-list">
              {historyTable.filtered.map((r) => (
                <li key={r.id} className="redeem-history-item">
                  <div className="redeem-history-item-head">
                    <div>
                      <span className="redeem-history-store">{r.storeName}</span>
                      <p className="muted small redeem-history-rep">{t.redeem.byRep(r.repName)}</p>
                    </div>
                    <div className="redeem-history-meta">
                      <LoyaltyBadge text={t.redeem.pointsSpent(r.totalPointsSpent)} variant="earn" icon="earn" />
                      <time className="muted small">{formatMarketDateTime(r.createdAt, locale)}</time>
                    </div>
                  </div>
                  <ul className="redeem-history-lines">
                    {r.lines.map((line, i) => (
                      <li key={i}>
                        <span className="redeem-history-line-name">{line.productName}</span>
                        <span className="muted small">
                          × {line.quantity} · {t.redeem.pointsSpent(line.pointsSpent)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
