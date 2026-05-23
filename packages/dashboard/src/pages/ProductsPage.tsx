import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import PaginationBar from "../components/PaginationBar";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { mediaUrl } from "../lib/mediaUrl";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";
import { uploadAdminImage } from "../lib/uploadAdmin";

type Product = {
  id: number;
  name: string;
  designation: string | null;
  unit_label: string | null;
  carton_spec: string | null;
  dimensions_cm: string | null;
  carton_weight_kg: string | null;
  image_url: string | null;
  price: string;
  loyalty_points_per_unit: number;
  is_active: boolean;
};

export default function ProductsPage() {
  const { can } = useAuth();
  const { t } = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [edit, setEdit] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "",
    designation: "",
    unitLabel: "",
    cartonSpec: "",
    dimensionsCm: "",
    cartonWeightKg: "",
    imagePath: "" as string,
    price: "0",
    loyaltyPoints: "0",
  });
  const [uploading, setUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const pgn = useClientPagination(products);

  async function load() {
    const { data } = await api.get<{ products: Product[] }>("/products");
    setProducts(data.products);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onPickImage(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadAdminImage(file);
      setForm((f) => ({ ...f, imagePath: path }));
    } catch (e) {
      toastError(e instanceof Error ? e.message : t.products.saveFailed);
    } finally {
      setUploading(false);
    }
  }

  async function onPickEditImage(file: File | null) {
    if (!file || !edit) return;
    setEditUploading(true);
    try {
      const path = await uploadAdminImage(file);
      setEdit({ ...edit, image_url: path });
    } catch (e) {
      toastError(e instanceof Error ? e.message : t.products.saveFailed);
    } finally {
      setEditUploading(false);
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/products", {
        name: form.name,
        designation: form.designation || undefined,
        unitLabel: form.unitLabel || undefined,
        cartonSpec: form.cartonSpec || undefined,
        dimensionsCm: form.dimensionsCm || undefined,
        cartonWeightKg: form.cartonWeightKg ? parseFloat(form.cartonWeightKg) : undefined,
        imageUrl: form.imagePath || undefined,
        price: parseFloat(form.price),
        loyaltyPointsPerUnit: parseInt(form.loyaltyPoints, 10) || 0,
      });
      setForm({
        name: "",
        designation: "",
        unitLabel: "",
        cartonSpec: "",
        dimensionsCm: "",
        cartonWeightKg: "",
        loyaltyPoints: "0",
        imagePath: "",
        price: "0",
      });
      await load();
      toastSuccess(t.products.updated);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.products.saveFailed));
    }
  }

  async function saveEdit() {
    if (!edit) return;
    try {
      await api.patch(`/products/${edit.id}`, {
        name: edit.name,
        designation: edit.designation,
        unitLabel: edit.unit_label,
        cartonSpec: edit.carton_spec,
        dimensionsCm: edit.dimensions_cm,
        cartonWeightKg: edit.carton_weight_kg != null ? parseFloat(String(edit.carton_weight_kg)) : null,
        imageUrl: edit.image_url === null || edit.image_url === "" ? null : edit.image_url,
        price: parseFloat(edit.price),
        loyaltyPointsPerUnit: edit.loyalty_points_per_unit ?? 0,
        isActive: edit.is_active,
      });
      setEdit(null);
      await load();
      toastSuccess(t.products.updated);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.products.saveFailed));
    }
  }

  async function removeProduct(id: number) {
    const ok = await confirmDanger({
      title: t.products.deleteTitle,
      text: t.products.confirmDelete,
      confirmText: t.products.delete,
      cancelText: t.roles.cancel,
    });
    if (!ok) return;
    try {
      await api.delete(`/products/${id}`);
      if (edit?.id === id) setEdit(null);
      await load();
      toastSuccess(t.products.deleted);
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.products.deleteFailed));
    }
  }

  return (
    <div className="grid">
      {can("products.write") && (
        <div className="card">
          <h2>{t.products.titleAdd}</h2>
          <form onSubmit={onAdd} className="form grid2">
            <label>
              {t.products.name}
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              {t.products.price}
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" step="0.01" />
            </label>
            <label>
              {t.products.loyaltyPoints}
              <input
                value={form.loyaltyPoints}
                onChange={(e) => setForm({ ...form, loyaltyPoints: e.target.value })}
                type="number"
                min={0}
                step={1}
              />
              <span className="muted small">{t.products.loyaltyPointsHint}</span>
            </label>
            <label>
              {t.products.designation}
              <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </label>
            <label>
              {t.products.unit}
              <input value={form.unitLabel} onChange={(e) => setForm({ ...form, unitLabel: e.target.value })} />
            </label>
            <label>
              {t.products.carton}
              <input value={form.cartonSpec} onChange={(e) => setForm({ ...form, cartonSpec: e.target.value })} />
            </label>
            <label>
              {t.products.dimensions}
              <input value={form.dimensionsCm} onChange={(e) => setForm({ ...form, dimensionsCm: e.target.value })} />
            </label>
            <label>
              {t.products.weight}
              <input value={form.cartonWeightKg} onChange={(e) => setForm({ ...form, cartonWeightKg: e.target.value })} />
            </label>
            <div>
              <div className="muted small" style={{ marginBottom: 6 }}>
                {t.products.image}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
              />
              {uploading && <p className="muted small">{t.products.uploading}</p>}
              {form.imagePath && (
                <div style={{ marginTop: 8 }}>
                  <img src={mediaUrl(form.imagePath)} alt="" style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8 }} />
                  <div>
                    <button type="button" className="ghost small" onClick={() => setForm((f) => ({ ...f, imagePath: "" }))}>
                      {t.products.clearImage}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button className="primary" type="submit">
              {t.products.saveProduct}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>{t.products.titleList}</h2>
        {products.length > 0 && (
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
          />
        )}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.products.colName}</th>
                <th>{t.products.colPrice}</th>
                <th>{t.products.colLoyalty}</th>
                <th>{t.products.colActive}</th>
                <th>{t.products.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {pgn.slice.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {mediaUrl(p.image_url) && (
                        <img src={mediaUrl(p.image_url)} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                      )}
                      <div>
                        <div className="strong">{p.name}</div>
                        <div className="muted small">{p.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.price}</td>
                  <td>{p.loyalty_points_per_unit ?? 0}</td>
                  <td>{p.is_active ? t.products.yes : t.products.no}</td>
                  <td>
                    {can("products.write") && (
                      <span className="row" style={{ gap: 8 }}>
                        <button type="button" className="ghost" onClick={() => setEdit({ ...p })}>
                          {t.products.edit}
                        </button>
                        <button type="button" className="ghost danger" onClick={() => void removeProduct(p.id)}>
                          {t.products.delete}
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(null)} role="presentation">
          <div className="modal card" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3>{t.products.editTitle}</h3>
            <div className="form">
              <label>
                {t.products.name}
                <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </label>
              <label>
                {t.products.price}
                <input value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} />
              </label>
              <label>
                {t.products.loyaltyPoints}
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={edit.loyalty_points_per_unit ?? 0}
                  onChange={(e) =>
                    setEdit({ ...edit, loyalty_points_per_unit: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </label>
              <label>
                {t.products.colActive}{" "}
                <input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
              </label>
              <div>
                <div className="muted small">{t.products.imageField}</div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => void onPickEditImage(e.target.files?.[0] ?? null)}
                />
                {editUploading && <p className="muted small">{t.products.uploading}</p>}
                {mediaUrl(edit.image_url) && (
                  <img src={mediaUrl(edit.image_url)} alt="" style={{ maxWidth: 160, marginTop: 8, borderRadius: 8 }} />
                )}
              </div>
            </div>
            <div className="row spread" style={{ marginTop: 16 }}>
              <button type="button" className="ghost" onClick={() => setEdit(null)}>
                {t.roles.cancel}
              </button>
              <button type="button" className="primary" onClick={() => void saveEdit()}>
                {t.products.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
