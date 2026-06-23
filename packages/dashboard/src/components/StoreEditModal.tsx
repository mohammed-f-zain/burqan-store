import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { mediaUrl } from "../lib/mediaUrl";
import { toastError, toastSuccess } from "../lib/toast";
import { uploadAdminImage } from "../lib/uploadAdmin";

export type EditableStore = {
  id: number;
  name: string;
  phone: string;
  owner_name: string;
  location_lat: number;
  location_lng: number;
  address_text: string | null;
  image_url: string | null;
  area_id: number;
  area_name?: string;
};

type Area = { id: number; name: string; governorate: string | null };

type Props = {
  store: EditableStore;
  onClose: () => void;
  onSaved: () => void;
};

export default function StoreEditModal({ store, onClose, onSaved }: Props) {
  const { t } = useLocale();
  const [name, setName] = useState(store.name);
  const [phone, setPhone] = useState(store.phone);
  const [ownerName, setOwnerName] = useState(store.owner_name);
  const [addressText, setAddressText] = useState(store.address_text ?? "");
  const [locationLat, setLocationLat] = useState(String(store.location_lat));
  const [locationLng, setLocationLng] = useState(String(store.location_lng));
  const [areaId, setAreaId] = useState(String(store.area_id));
  const [imagePath, setImagePath] = useState(store.image_url ?? "");
  const [areas, setAreas] = useState<Area[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api
      .get<{ areas: Area[] }>("/areas")
      .then((r) => setAreas(r.data.areas ?? []))
      .catch(() => {
        /* area dropdown optional if areas.read denied */
      });
  }, []);

  async function onPickImage(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadAdminImage(file);
      setImagePath(path);
    } catch (e) {
      toastError(e instanceof Error ? e.message : t.stores.saveFailed);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const lat = parseFloat(locationLat);
    const lng = parseFloat(locationLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toastError(t.stores.invalidCoords);
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/stores/${store.id}`, {
        name: name.trim(),
        phone: phone.trim(),
        ownerName: ownerName.trim(),
        addressText: addressText.trim() || null,
        locationLat: lat,
        locationLng: lng,
        areaId: parseInt(areaId, 10),
        imageUrl: imagePath.trim() || null,
      });
      toastSuccess(t.stores.updated);
      onSaved();
      onClose();
    } catch (err) {
      toastError(pickAxiosErrorMessage(err, t.stores.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal card wide" onClick={(e) => e.stopPropagation()} role="dialog">
        <h3>{t.stores.editTitle}</h3>
        <p className="muted small">
          #{store.id}
          {store.area_name ? ` · ${store.area_name}` : ""}
        </p>
        <form onSubmit={onSubmit} className="form grid2">
          <label>
            {t.stores.colStore}
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={1} />
          </label>
          <label>
            {t.storeDetail.phone}
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label>
            {t.stores.colOwner}
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
          </label>
          <label>
            {t.stores.colArea}
            {areas.length > 0 ? (
              <select value={areaId} onChange={(e) => setAreaId(e.target.value)} required>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.governorate ? ` (${a.governorate})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input value={areaId} onChange={(e) => setAreaId(e.target.value)} type="number" min={1} required />
            )}
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            {t.storeDetail.address}
            <input value={addressText} onChange={(e) => setAddressText(e.target.value)} />
          </label>
          <label>
            {t.stores.latLabel}
            <input
              value={locationLat}
              onChange={(e) => setLocationLat(e.target.value)}
              type="number"
              step="any"
              required
            />
          </label>
          <label>
            {t.stores.lngLabel}
            <input
              value={locationLng}
              onChange={(e) => setLocationLng(e.target.value)}
              type="number"
              step="any"
              required
            />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="muted small" style={{ marginBottom: 6 }}>
              {t.stores.storePhoto}
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
            />
            {uploading && <p className="muted small">{t.products.uploading}</p>}
            {mediaUrl(imagePath) && (
              <div style={{ marginTop: 8 }}>
                <img src={mediaUrl(imagePath)} alt="" style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8 }} />
                <div>
                  <button type="button" className="ghost small" onClick={() => setImagePath("")}>
                    {t.products.clearImage}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="row spread" style={{ gridColumn: "1 / -1", marginTop: 8 }}>
            <button type="button" className="ghost" onClick={onClose} disabled={saving}>
              {t.stores.cancel}
            </button>
            <button type="submit" className="primary" disabled={saving || uploading}>
              {saving ? t.common.loading : t.stores.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
