import { useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
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
  const [products, setProducts] = useState<Product[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        api.get<{ products: Product[] }>("/products"),
        can("redeem.read") ? api.get<{ redemptions: Redemption[] }>("/redeem/redemptions?limit=40") : Promise.resolve({ data: { redemptions: [] } }),
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
    if (!can("redeem.write") && !can("products.write")) return;
    try {
      await api.patch(`/products/${id}`, {
        redeemEnabled: patch.redeemEnabled,
        redeemPointsPerUnit: patch.redeemPointsPerUnit,
      });
      toastSuccess(t.redeem.saved);
      await load();
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.redeem.saveFailed));
    }
  }

  const prizeProducts = products.filter((p) => p.is_active);

  return (
    <div className="page">
      <h1>{t.redeem.title}</h1>
      <p className="muted">{t.redeem.subtitle}</p>

      {loading ? <p className="muted">{t.common.loading}</p> : null}

      <section className="dash-section" style={{ marginTop: 20 }}>
        <h2>{t.redeem.catalogTitle}</h2>
        <p className="muted small">{t.redeem.catalogHint}</p>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.redeem.colProduct}</th>
                <th>{t.redeem.colRedeemPoints}</th>
                <th>{t.redeem.colEnabled}</th>
              </tr>
            </thead>
            <tbody>
              {prizeProducts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {p.image_url ? (
                        <img src={mediaUrl(p.image_url)} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} />
                      ) : null}
                      <span>{p.name}</span>
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      style={{ width: 100 }}
                      defaultValue={p.redeem_points_per_unit ?? 0}
                      disabled={!can("redeem.write") && !can("products.write")}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10) || 0;
                        if (v !== (p.redeem_points_per_unit ?? 0)) {
                          void patchProduct(p.id, { redeemPointsPerUnit: v });
                        }
                      }}
                    />
                  </td>
                  <td>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(p.redeem_enabled)}
                        disabled={!can("redeem.write") && !can("products.write")}
                        onChange={(e) => void patchProduct(p.id, { redeemEnabled: e.target.checked })}
                      />
                      <span>{p.redeem_enabled ? t.redeem.enabledYes : t.redeem.enabledNo}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {can("redeem.read") ? (
        <section className="dash-section" style={{ marginTop: 28 }}>
          <h2>{t.redeem.historyTitle}</h2>
          {redemptions.length === 0 ? (
            <p className="muted">{t.redeem.emptyHistory}</p>
          ) : (
            <ul className="list-plain" style={{ marginTop: 12 }}>
              {redemptions.map((r) => (
                <li key={r.id} className="card" style={{ marginBottom: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <strong>
                      {r.storeName} · {t.redeem.pointsSpent(r.totalPointsSpent)}
                    </strong>
                    <span className="muted small">{formatMarketDateTime(r.createdAt, locale)}</span>
                  </div>
                  <p className="muted small" style={{ marginTop: 4 }}>
                    {t.redeem.byRep(r.repName)}
                  </p>
                  <ul className="muted small" style={{ marginTop: 8, paddingRight: 18 }}>
                    {(r.lines as Redemption["lines"]).map((line, i) => (
                      <li key={i}>
                        {line.productName} × {line.quantity} ({t.redeem.pointsSpent(line.pointsSpent)})
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
