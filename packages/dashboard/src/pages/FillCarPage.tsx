import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import TableFilterBar from "../components/TableFilterBar";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { mediaUrl } from "../lib/mediaUrl";
import { confirmSave } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";

type Rep = { id: number; full_name: string; email: string; is_active: boolean };
type SalesLine = { product_id: number; product_name: string; quantity: number; line_total: string };
type RepSales = Rep & { order_count: number; total_sales: string; lines: SalesLine[] };
type InvRow = {
  product_id: number;
  name: string;
  price: string;
  catalog_price?: string;
  rep_price?: string | null;
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
  const [baselineQty, setBaselineQty] = useState<Record<number, number>>({});

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
      .then((r) => {
        const inv = r.data.inventory ?? [];
        setInventory(inv);
        setBaselineQty(Object.fromEntries(inv.map((row) => [row.product_id, row.quantity])));
      })
      .catch((e) => toastError(pickAxiosErrorMessage(e, t.fillCar.loadFailed)))
      .finally(() => setInvLoading(false));
  }, [repId, canRead, t.fillCar.loadFailed]);

  const selected = useMemo(
    () => salesReps.find((r) => String(r.id) === repId) ?? null,
    [salesReps, repId]
  );

  const salesFilterFields = useMemo(
    () => [
      { id: "name", label: t.fillCar.colRep, type: "text" as const, getValue: (r: RepSales) => r.full_name },
      { id: "email", label: t.reps.colEmail, type: "text" as const, getValue: (r: RepSales) => r.email },
      { id: "orders", label: t.fillCar.colOrders, type: "text" as const, getValue: (r: RepSales) => r.order_count },
      { id: "sold", label: t.fillCar.colSold, type: "text" as const, getValue: (r: RepSales) => r.total_sales },
      { id: "active", label: t.reps.colActive, type: "boolean" as const, getValue: (r: RepSales) => r.is_active },
    ],
    [t.fillCar.colOrders, t.fillCar.colRep, t.fillCar.colSold, t.reps.colActive, t.reps.colEmail]
  );

  const salesTable = useTableFilters(salesReps, {
    searchAccessors: ["full_name", "email", "order_count", "total_sales", "id"],
    fields: salesFilterFields,
  });

  const soldLines = selected?.lines ?? [];

  const soldFilterFields = useMemo(
    () => [
      { id: "product", label: t.orders.product, type: "text" as const, getValue: (l: SalesLine) => l.product_name },
      { id: "qty", label: t.orders.qty, type: "text" as const, getValue: (l: SalesLine) => l.quantity },
      { id: "total", label: t.orders.line, type: "text" as const, getValue: (l: SalesLine) => l.line_total },
    ],
    [t.orders.line, t.orders.product, t.orders.qty]
  );

  const soldTable = useTableFilters(soldLines, {
    searchAccessors: ["product_name", "quantity", "line_total", "product_id"],
    fields: soldFilterFields,
  });

  const invFilterFields = useMemo(
    () => [
      { id: "name", label: t.orders.product, type: "text" as const, getValue: (r: InvRow) => r.name },
      { id: "price", label: t.products.colPrice, type: "text" as const, getValue: (r: InvRow) => r.price },
      { id: "designation", label: t.products.designation, type: "text" as const, getValue: (r: InvRow) => r.designation },
      { id: "qty", label: t.fillCar.onCar, type: "text" as const, getValue: (r: InvRow) => r.quantity },
    ],
    [t.fillCar.onCar, t.orders.product, t.products.colPrice, t.products.designation]
  );

  const invTable = useTableFilters(inventory, {
    searchAccessors: ["name", "price", "designation", "quantity", "product_id"],
    fields: invFilterFields,
  });

  const soldByProductId = useMemo(() => {
    const m = new Map<number, number>();
    for (const line of selected?.lines ?? []) {
      m.set(line.product_id, line.quantity);
    }
    return m;
  }, [selected?.lines]);

  async function save() {
    if (!canWrite || !repId) return;
    const ok = await confirmSave({
      title: t.fillCar.saveConfirmTitle,
      text: t.fillCar.saveConfirmText,
      confirmText: t.fillCar.save,
      cancelText: t.fillCar.cancelSave,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await api.put(`/representatives/${repId}/inventory`, {
        items: inventory.map((row) => ({
          productId: row.product_id,
          quantity: row.quantity,
          price: parseRepPriceForSave(row),
        })),
      });
      setBaselineQty(Object.fromEntries(inventory.map((row) => [row.product_id, row.quantity])));
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
          <>
            <TableFilterBar
              {...salesTable}
              onSearchChange={salesTable.setSearch}
              onFilterChange={salesTable.setFilter}
              onClear={salesTable.clearFilters}
              onToggleFilters={() => salesTable.setShowFilters((v) => !v)}
              labels={t.tableFilters}
            />
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
                {salesTable.filtered.map((r) => (
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
          </>
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
            <>
              <TableFilterBar
                {...soldTable}
                onSearchChange={soldTable.setSearch}
                onFilterChange={soldTable.setFilter}
                onClear={soldTable.clearFilters}
                onToggleFilters={() => soldTable.setShowFilters((v) => !v)}
                labels={t.tableFilters}
              />
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
                  {soldTable.filtered.map((l) => (
                    <tr key={l.product_id}>
                      <td>{l.product_name}</td>
                      <td>{l.quantity}</td>
                      <td>{l.line_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          <h4 className="strong" style={{ marginTop: 24 }}>
            {t.fillCar.inventorySection}
          </h4>
          <p className="muted small">{t.fillCar.repPriceHint}</p>
          <p className="muted small fill-car-delta-legend">{t.fillCar.deltaLegend}</p>
          {invLoading ? (
            <p className="muted">{t.common.loading}</p>
          ) : (
            <>
              <TableFilterBar
                {...invTable}
                onSearchChange={invTable.setSearch}
                onFilterChange={invTable.setFilter}
                onClear={invTable.clearFilters}
                onToggleFilters={() => invTable.setShowFilters((v) => !v)}
                labels={t.tableFilters}
              />
            <div className="fill-car-product-grid">
              {invTable.filtered.map((row) => {
                const idx = inventory.findIndex((r) => r.product_id === row.product_id);
                const soldQty = soldByProductId.get(row.product_id) ?? 0;
                const baseQty = baselineQty[row.product_id] ?? row.quantity;
                const addedQty = Math.max(0, row.quantity - baseQty);
                const remainingSold = Math.max(0, soldQty - addedQty);
                return (
                <div key={row.product_id} className="fill-car-product-card">
                  {mediaUrl(row.image_url) ? (
                    <img src={mediaUrl(row.image_url)} alt="" className="fill-car-product-img" />
                  ) : (
                    <div className="fill-car-product-img fill-car-product-img--empty" />
                  )}
                  <div className="fill-car-product-body">
                    <div className="fill-car-product-head">
                      <div className="strong">{row.name}</div>
                      {(remainingSold > 0 || addedQty > 0 || row.quantity < baseQty) && (
                        <div className="fill-car-deltas" aria-label={t.fillCar.deltaLegend}>
                          {remainingSold > 0 && (
                            <span className="fill-car-delta fill-car-delta--sold" title={t.fillCar.soldDelta}>
                              −{remainingSold}
                            </span>
                          )}
                          {addedQty > 0 && (
                            <span className="fill-car-delta fill-car-delta--added" title={t.fillCar.addedDelta}>
                              +{addedQty}
                            </span>
                          )}
                          {row.quantity < baseQty && (
                            <span className="fill-car-delta fill-car-delta--sold" title={t.fillCar.addedDelta}>
                              {row.quantity - baseQty}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {row.designation && <p className="muted small">{row.designation}</p>}
                    <p className="muted small">
                      {t.fillCar.catalogPrice}: {row.catalog_price ?? row.price}
                    </p>
                    <p className="muted small">
                      {t.fillCar.repPrice}:{" "}
                      {canWrite ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder={t.fillCar.repPricePlaceholder}
                          value={row.rep_price ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setInventory((rows) =>
                              rows.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      rep_price: raw === "" ? null : raw,
                                      price: raw === "" ? (r.catalog_price ?? r.price) : raw,
                                    }
                                  : r
                              )
                            );
                          }}
                          style={{ width: 96, display: "inline-block" }}
                        />
                      ) : (
                        row.rep_price ?? row.catalog_price ?? row.price
                      )}
                      {!row.rep_price && canWrite ? (
                        <span className="muted"> ({t.fillCar.repPricePlaceholder})</span>
                      ) : null}
                    </p>
                    <p className="muted small">
                      {t.fillCar.onCar}:{" "}
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
              );
              })}
            </div>
            </>
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

function parseRepPriceForSave(row: InvRow): number | null {
  const raw = row.rep_price;
  if (raw == null || raw === "") return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
