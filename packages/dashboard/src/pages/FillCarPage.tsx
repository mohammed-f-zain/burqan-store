import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { mediaUrl } from "../lib/mediaUrl";
import { toastError, toastSuccess } from "../lib/toast";

type Rep = { id: number; full_name: string; email: string; is_active: boolean };
type SalesLine = { product_id: number; product_name: string; quantity: number; line_total: string };
type RepSales = Rep & { order_count: number; total_sales: string; lines: SalesLine[] };
type InvRow = {
  product_id: number;
  name: string;
  price: string;
  quantity: number;
  designation?: string | null;
  image_url?: string | null;
};

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function FillCarPage() {
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const { t } = useLocale();
  const canRead = can("fill_car.read") || can("reps.read");
  const canWrite = can("fill_car.write") || can("reps.write");

  const [date, setDate] = useState(todayLocal);
  const [salesReps, setSalesReps] = useState<RepSales[]>([]);
  const [repId, setRepId] = useState("");
  const [inventory, setInventory] = useState<InvRow[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [invLoading, setInvLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSales = useCallback(async () => {
    if (!canRead) return;
    setSalesLoading(true);
    try {
      const { data } = await api.get<{ representatives: RepSales[] }>("/representatives/sales-daily", {
        params: { date },
      });
      const list = data.representatives ?? [];
      setSalesReps(list);
      const fromUrl = searchParams.get("repId");
      setRepId((cur) => {
        if (fromUrl && list.some((x) => String(x.id) === fromUrl)) return fromUrl;
        if (cur && list.some((x) => String(x.id) === cur)) return cur;
        return list[0] ? String(list[0].id) : "";
      });
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.fillCar.loadFailed));
    } finally {
      setSalesLoading(false);
    }
  }, [canRead, date, searchParams, t.fillCar.loadFailed]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  useEffect(() => {
    if (!canRead || !repId) {
      setInventory([]);
      return;
    }
    setInvLoading(true);
    void api
      .get<{ inventory: InvRow[] }>(`/representatives/${repId}/inventory`)
      .then((r) => setInventory(r.data.inventory ?? []))
      .catch((e) => toastError(pickAxiosErrorMessage(e, t.fillCar.loadFailed)))
      .finally(() => setInvLoading(false));
  }, [repId, canRead, t.fillCar.loadFailed]);

  const selected = useMemo(
    () => salesReps.find((r) => String(r.id) === repId) ?? null,
    [salesReps, repId]
  );

  async function save() {
    if (!canWrite || !repId) return;
    setSaving(true);
    try {
      await api.put(`/representatives/${repId}/inventory`, {
        items: inventory.map((row) => ({
          productId: row.product_id,
          quantity: row.quantity,
        })),
      });
      toastSuccess(t.fillCar.saved);
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.fillCar.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  if (!canRead) {
    return (
      <div className="card">
        <h2>{t.fillCar.title}</h2>
        <p className="muted">{t.fillCar.denied}</p>
      </div>
    );
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.fillCar.title}</h2>
        <p className="muted">{t.fillCar.hint}</p>

        <div className="form row spread fill-car-toolbar" style={{ alignItems: "flex-end", gap: 12 }}>
          <label style={{ flex: "0 1 200px" }}>
            {t.fillCar.dateLabel}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button type="button" className="secondary" disabled={salesLoading} onClick={() => void loadSales()}>
            {salesLoading ? t.common.loading : t.fillCar.refresh}
          </button>
        </div>

        <h3 className="strong" style={{ marginTop: 20 }}>
          {t.fillCar.allRepsTitle}
        </h3>
        {salesLoading && salesReps.length === 0 ? (
          <p className="muted">{t.common.loading}</p>
        ) : (
          <div className="table-wrap">
            <table className="table table-clickable">
              <thead>
                <tr>
                  <th>{t.fillCar.colRep}</th>
                  <th>{t.fillCar.colOrders}</th>
                  <th>{t.fillCar.colSold}</th>
                  <th>{t.reps.colActive}</th>
                </tr>
              </thead>
              <tbody>
                {salesReps.map((r) => (
                  <tr
                    key={r.id}
                    className={String(r.id) === repId ? "row-selected" : undefined}
                    onClick={() => setRepId(String(r.id))}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <strong>{r.full_name}</strong>
                      <div className="muted small">{r.email}</div>
                    </td>
                    <td>{r.order_count}</td>
                    <td>{r.total_sales}</td>
                    <td>{r.is_active ? t.reps.active : t.reps.disabled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="card">
          <h3>
            {t.fillCar.selectedRep}: {selected.full_name}
          </h3>
          <div className="stat-row" style={{ marginTop: 12 }}>
            <div className="stat-pill">
              <span className="muted small">{t.fillCar.colOrders}</span>
              <strong>{selected.order_count}</strong>
            </div>
            <div className="stat-pill">
              <span className="muted small">{t.fillCar.colSold}</span>
              <strong>{selected.total_sales}</strong>
            </div>
          </div>

          <h4 className="strong" style={{ marginTop: 20 }}>
            {t.fillCar.soldThatDay}
          </h4>
          {selected.lines.length === 0 ? (
            <p className="muted">{t.fillCar.noSales}</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.orders.product}</th>
                    <th>{t.orders.qty}</th>
                    <th>{t.orders.line}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.lines.map((l) => (
                    <tr key={l.product_id}>
                      <td>{l.product_name}</td>
                      <td>{l.quantity}</td>
                      <td>{l.line_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4 className="strong" style={{ marginTop: 24 }}>
            {t.fillCar.inventorySection}
          </h4>
          {invLoading ? (
            <p className="muted">{t.common.loading}</p>
          ) : (
            <div className="fill-car-product-grid">
              {inventory.map((row, idx) => (
                <div key={row.product_id} className="fill-car-product-card">
                  {mediaUrl(row.image_url) ? (
                    <img src={mediaUrl(row.image_url)} alt="" className="fill-car-product-img" />
                  ) : (
                    <div className="fill-car-product-img fill-car-product-img--empty" />
                  )}
                  <div className="fill-car-product-body">
                    <div className="strong">{row.name}</div>
                    {row.designation && <p className="muted small">{row.designation}</p>}
                    <p className="muted small">
                      {row.price} · {t.fillCar.onCar}:{" "}
                      {canWrite ? (
                        <input
                          type="number"
                          min={0}
                          value={row.quantity}
                          onChange={(e) => {
                            const q = parseInt(e.target.value, 10);
                            setInventory((rows) =>
                              rows.map((r, i) =>
                                i === idx ? { ...r, quantity: Number.isFinite(q) ? q : 0 } : r
                              )
                            );
                          }}
                          style={{ width: 72, display: "inline-block" }}
                        />
                      ) : (
                        row.quantity
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {canWrite && inventory.length > 0 && (
            <button
              type="button"
              className="primary"
              style={{ marginTop: 16 }}
              disabled={saving || invLoading}
              onClick={() => void save()}
            >
              {saving ? t.fillCar.saving : t.fillCar.save}
            </button>
          )}
          {!canWrite && <p className="muted small">{t.fillCar.readOnly}</p>}
        </div>
      )}
    </div>
  );
}
