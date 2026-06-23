import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import StoreEditModal, { type EditableStore } from "../components/StoreEditModal";
import TableFilterBar from "../components/TableFilterBar";
import StoreMap from "../components/StoreMap";
import { useTableFilters } from "../hooks/useTableFilters";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";
import { qrPayload } from "../utils/qrPayload";

type Store = {
  id: number;
  name: string;
  phone: string;
  owner_name: string;
  deferred_payment_enabled: boolean;
  area_id: number;
  area_name: string;
  qr_public_token: string;
  location_lat: number;
  location_lng: number;
  address_text: string | null;
  image_url: string | null;
  registered_by_rep_name: string | null;
};

export default function StoresPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [payStoreId, setPayStoreId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [editStore, setEditStore] = useState<EditableStore | null>(null);

  const areaFilterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const s of stores) {
      const n = s.area_name?.trim();
      if (n) names.add(n);
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, "ar"))
      .map((name) => ({ value: name, label: name }));
  }, [stores]);

  const repFilterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const s of stores) {
      const n = s.registered_by_rep_name?.trim();
      if (n) names.add(n);
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, "ar"))
      .map((name) => ({ value: name, label: name }));
  }, [stores]);

  const storeFilterFields = useMemo(
    () => [
      { id: "name", label: t.stores.colStore, type: "text" as const, getValue: (s: Store) => s.name },
      { id: "phone", label: t.storeDetail.phone, type: "text" as const, getValue: (s: Store) => s.phone },
      {
        id: "area",
        label: t.stores.colArea,
        type: "searchableSelect" as const,
        getValue: (s: Store) => s.area_name,
        options: areaFilterOptions,
      },
      { id: "owner", label: t.stores.colOwner, type: "text" as const, getValue: (s: Store) => s.owner_name },
      {
        id: "rep",
        label: t.stores.colRegisteredBy,
        type: "searchableSelect" as const,
        getValue: (s: Store) => s.registered_by_rep_name,
        options: repFilterOptions,
      },
      { id: "qr", label: t.stores.colQr, type: "text" as const, getValue: (s: Store) => s.qr_public_token },
      {
        id: "deferred",
        label: t.stores.colDeferred,
        type: "boolean" as const,
        getValue: (s: Store) => s.deferred_payment_enabled,
      },
    ],
    [
      areaFilterOptions,
      repFilterOptions,
      t.storeDetail.phone,
      t.stores.colArea,
      t.stores.colDeferred,
      t.stores.colOwner,
      t.stores.colQr,
      t.stores.colRegisteredBy,
      t.stores.colStore,
    ]
  );

  const storeTable = useTableFilters(stores, {
    searchAccessors: [
      "id",
      "name",
      "phone",
      "owner_name",
      "area_name",
      "registered_by_rep_name",
      "qr_public_token",
      (s) => `${s.location_lat},${s.location_lng}`,
    ],
    fields: storeFilterFields,
  });
  const storePgn = storeTable.pagination;
  const canWrite = can("stores.write");

  async function load() {
    const { data } = await api.get<{ stores: Store[] }>("/stores");
    setStores(data.stores);
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleDeferred(s: Store) {
    const next = !s.deferred_payment_enabled;
    await api.patch(`/stores/${s.id}/deferred`, { enabled: next });
    await load();
  }

  async function removeStore(id: number) {
    if (!canWrite) return;
    const ok = await confirmDanger({
      title: t.stores.deleteTitle,
      text: t.stores.confirmDelete,
      confirmText: t.stores.delete,
      cancelText: t.stores.cancelDelete,
    });
    if (!ok) return;
    try {
      await api.delete(`/stores/${id}`);
      toastSuccess(t.stores.deleted);
      await load();
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.stores.deleteFailed));
    }
  }

  function openEdit(s: Store, e: React.MouseEvent) {
    e.stopPropagation();
    setEditStore({
      id: s.id,
      name: s.name,
      phone: s.phone,
      owner_name: s.owner_name,
      location_lat: s.location_lat,
      location_lng: s.location_lng,
      address_text: s.address_text,
      image_url: s.image_url,
      area_id: s.area_id,
      area_name: s.area_name,
    });
  }

  async function recordPayment(e: FormEvent) {
    e.preventDefault();
    if (!payStoreId) return;
    await api.post(`/stores/${payStoreId}/payments`, {
      amount: parseFloat(payAmount),
      note: payNote || undefined,
    });
    setPayAmount("");
    setPayNote("");
    setPayStoreId(null);
    toastSuccess(t.stores.payDone);
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t.stores.title}</h2>
        <p className="muted">{t.stores.hint}</p>
        <p className="muted small">{t.stores.rowHint}</p>
        <TableFilterBar
          {...storeTable}
          onSearchChange={storeTable.setSearch}
          onFilterChange={storeTable.setFilter}
          onClear={storeTable.clearFilters}
          onToggleFilters={() => storeTable.setShowFilters((v) => !v)}
          pinnedFieldIds={["area", "rep"]}
          labels={t.tableFilters}
        />
        {storeTable.filteredCount > 0 && (
          <PaginationBar
            className="pagination-bar--flush"
            page={storePgn.page}
            totalPages={storePgn.totalPages}
            totalItems={storePgn.total}
            from={storePgn.from}
            to={storePgn.to}
            pageSize={storePgn.pageSize}
            pageSizeOptions={storePgn.pageSizeOptions}
            onPageChange={storePgn.setPage}
            onPageSizeChange={storePgn.setPageSize}
          />
        )}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.stores.colStore}</th>
                <th>{t.stores.colArea}</th>
                <th>{t.stores.colOwner}</th>
                <th>{t.stores.colRegisteredBy}</th>
                <th>{t.stores.colLocation}</th>
                <th>{t.stores.colQr}</th>
                <th>{t.stores.colDeferred}</th>
                {can("orders.record_payment") && <th>{t.stores.pay}</th>}
                {canWrite && <th>{t.stores.colActions}</th>}
              </tr>
            </thead>
            <tbody>
              {storePgn.slice.map((s) => (
                <tr
                  key={s.id}
                  className="store-row"
                  onClick={() => navigate(`/app/stores/${s.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/app/stores/${s.id}`);
                    }
                  }}
                >
                  <td>
                    <div className="strong">{s.name}</div>
                    <div className="muted small">{s.phone}</div>
                  </td>
                  <td>{s.area_name}</td>
                  <td>{s.owner_name}</td>
                  <td className="small">{s.registered_by_rep_name ?? "—"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <StoreMap lat={s.location_lat} lng={s.location_lng} variant="thumb" />
                  </td>
                  <td className="qr-cell qr-cell--stack" onClick={(e) => e.stopPropagation()}>
                    <QRCodeSVG value={qrPayload(s.qr_public_token)} size={72} level="M" includeMargin={false} />
                    <span className="muted small mono break-all" title={s.qr_public_token}>
                      {s.qr_public_token.slice(0, 10)}…
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {can("stores.deferred_toggle") ? (
                      <button type="button" className={s.deferred_payment_enabled ? "pill on" : "pill off"} onClick={() => void toggleDeferred(s)}>
                        {s.deferred_payment_enabled ? t.stores.open : t.stores.closed}
                      </button>
                    ) : s.deferred_payment_enabled ? (
                      t.stores.open
                    ) : (
                      t.stores.closed
                    )}
                  </td>
                  {can("orders.record_payment") && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="ghost" onClick={() => setPayStoreId(s.id)}>
                        {t.stores.pay}
                      </button>
                    </td>
                  )}
                  {canWrite && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <span className="row" style={{ gap: 8 }}>
                        <button type="button" className="ghost" onClick={(e) => openEdit(s, e)}>
                          {t.stores.edit}
                        </button>
                        <button type="button" className="ghost danger" onClick={() => void removeStore(s.id)}>
                          {t.stores.delete}
                        </button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editStore && (
        <StoreEditModal
          store={editStore}
          onClose={() => setEditStore(null)}
          onSaved={() => void load()}
        />
      )}

      {payStoreId != null && (
        <div className="modal-backdrop" onClick={() => setPayStoreId(null)} role="presentation">
          <div className="modal card" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3>
              {t.stores.payTitle} {payStoreId}
            </h3>
            <form onSubmit={recordPayment} className="form">
              <label>
                {t.stores.amount}
                <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} type="number" step="0.01" required />
              </label>
              <label>
                {t.stores.note}
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </label>
              <div className="row spread">
                <button type="button" className="ghost" onClick={() => setPayStoreId(null)}>
                  {t.stores.cancel}
                </button>
                <button type="submit" className="primary">
                  {t.stores.submitPay}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
