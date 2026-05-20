import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { toastError, toastSuccess } from "../lib/toast";

type Rep = { id: number; full_name: string; email: string; is_active: boolean };
type InvRow = { product_id: number; name: string; price: string; quantity: number };

export default function FillCarPage() {
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const { t } = useLocale();
  const canRead = can("fill_car.read") || can("reps.read");
  const canWrite = can("fill_car.write") || can("reps.write");

  const [reps, setReps] = useState<Rep[]>([]);
  const [repId, setRepId] = useState("");
  const [inventory, setInventory] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canRead) return;
    void api
      .get<{ representatives: Rep[] }>("/fill-car/representatives")
      .then((r) => {
        const list = r.data.representatives ?? [];
        setReps(list);
        const fromUrl = searchParams.get("repId");
        if (fromUrl && list.some((x) => String(x.id) === fromUrl)) {
          setRepId(fromUrl);
        } else if (list.length && !repId) {
          setRepId(String(list[0]!.id));
        }
      })
      .catch((e) => toastError(pickAxiosErrorMessage(e, t.fillCar.loadFailed)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load
  }, [canRead, searchParams]);

  useEffect(() => {
    if (!canRead || !repId) {
      setInventory([]);
      return;
    }
    setLoading(true);
    void api
      .get<{ inventory: InvRow[] }>(`/representatives/${repId}/inventory`)
      .then((r) => setInventory(r.data.inventory ?? []))
      .catch((e) => toastError(pickAxiosErrorMessage(e, t.fillCar.loadFailed)))
      .finally(() => setLoading(false));
  }, [repId, canRead, t.fillCar.loadFailed]);

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

  const activeReps = reps.filter((r) => r.is_active);

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.fillCar.title}</h2>
        <p className="muted">{t.fillCar.hint}</p>

        <div className="form" style={{ maxWidth: 420 }}>
          <label>
            {t.fillCar.selectRep}
            <select
              value={repId}
              onChange={(e) => setRepId(e.target.value)}
              disabled={!activeReps.length}
            >
              {activeReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name} ({r.email})
                </option>
              ))}
            </select>
          </label>
        </div>

        {!activeReps.length && <p className="muted">{t.fillCar.noReps}</p>}

        {repId && (
          <>
            {loading ? (
              <p className="muted">{t.common.loading}</p>
            ) : (
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t.orders.product}</th>
                      <th>{t.fillCar.qty}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((row, idx) => (
                      <tr key={row.product_id}>
                        <td>{row.name}</td>
                        <td>
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
                              style={{ width: 88 }}
                            />
                          ) : (
                            row.quantity
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {canWrite && inventory.length > 0 && (
              <button
                type="button"
                className="primary"
                style={{ marginTop: 12 }}
                disabled={saving || loading}
                onClick={() => void save()}
              >
                {saving ? t.fillCar.saving : t.fillCar.save}
              </button>
            )}
            {!canWrite && <p className="muted small">{t.fillCar.readOnly}</p>}
          </>
        )}
      </div>
    </div>
  );
}
