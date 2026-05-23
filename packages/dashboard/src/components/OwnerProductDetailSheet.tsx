import { useEffect } from "react";

import LoyaltyBadge from "./LoyaltyBadge";
import { mediaUrl } from "../lib/mediaUrl";
import { ownerFormatMoney } from "../owner/ownerFormat";
import type { ar } from "../i18n/ar";

export type OwnerCatalogProduct = {
  id: number;
  name: string;
  designation: string | null;
  unit_label: string | null;
  carton_spec: string | null;
  dimensions_cm: string | null;
  carton_weight_kg: string | number | null;
  image_url: string | null;
  price: string;
  loyalty_points_per_unit: number;
};

type OwnerStrings = (typeof ar)["owner"];

type Props = {
  product: OwnerCatalogProduct;
  strings: OwnerStrings;
  onClose: () => void;
};

function formatWeight(value: string | number | null | undefined): string | null {
  if (value == null || String(value).trim() === "") return null;
  const n = parseFloat(String(value));
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("ar-JO", { maximumFractionDigits: 3 });
}

export default function OwnerProductDetailSheet({ product, strings: o, onClose }: Props) {
  const img = mediaUrl(product.image_url);
  const price = ownerFormatMoney(parseFloat(product.price), o.currency);
  const weight = formatWeight(product.carton_weight_kg);

  const specs: { label: string; value: string }[] = [];
  if (product.designation?.trim()) specs.push({ label: o.productDesignation, value: product.designation.trim() });
  if (product.unit_label?.trim()) specs.push({ label: o.productUnit, value: product.unit_label.trim() });
  if (product.carton_spec?.trim()) specs.push({ label: o.productCarton, value: product.carton_spec.trim() });
  if (product.dimensions_cm?.trim()) specs.push({ label: o.productDimensions, value: product.dimensions_cm.trim() });
  if (weight) specs.push({ label: o.productWeight, value: `${weight} ${o.weightUnit}` });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="owner-sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="owner-sheet owner-product-detail"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-product-detail-title"
      >
        <header className="owner-sheet-header">
          <h2 id="owner-product-detail-title" className="owner-sheet-title">
            {o.productDetailTitle}
          </h2>
          <button type="button" className="owner-sheet-close" onClick={onClose} aria-label={o.close}>
            ×
          </button>
        </header>

        <div className="owner-product-detail-hero">
          {img ? (
            <img src={img} alt="" className="owner-product-detail-img" />
          ) : (
            <div className="owner-product-detail-img owner-product-detail-img--empty">{o.noImage}</div>
          )}
        </div>

        <div className="owner-product-detail-body">
          <h3 className="owner-product-detail-name">{product.name}</h3>
          <p className="owner-product-detail-price">{price}</p>
          {product.loyalty_points_per_unit > 0 ? (
            <div className="owner-product-detail-loyalty">
              <LoyaltyBadge text={o.loyaltyPerUnit(product.loyalty_points_per_unit)} variant="pill" icon="star" />
            </div>
          ) : null}

          {specs.length > 0 ? (
            <dl className="owner-product-specs">
              {specs.map((row) => (
                <div key={row.label} className="owner-product-spec-row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="owner-muted owner-product-detail-empty">{o.productNoExtraInfo}</p>
          )}
        </div>
      </div>
    </div>
  );
}
