export type ProspectCard = {
  id: number;
  name: string;
  phone: string;
  ownerName: string;
  location: { lat: number; lng: number };
  addressText?: string | null;
  areaName?: string | null;
  visitedToday?: boolean;
};

export type DailyStoreCard = {
  id: number;
  /** burqan = registered with QR; google = prospect from Google Maps */
  source?: "burqan" | "google";
  name: string;
  phone: string;
  ownerName: string;
  location: { lat: number; lng: number };
  addressText?: string | null;
  areaName?: string | null;
  deferredPaymentEnabled: boolean;
  visitedToday?: boolean;
  visitNote?: string | null;
  googleMapsUrl?: string | null;
  googlePlaceId?: string | null;
};

export type StoreBrief = {
  id: number;
  name: string;
  phone: string;
  ownerName: string;
  location: { lat: number; lng: number };
  addressText?: string | null;
  areaName?: string | null;
  imageUrl?: string | null;
  deferredPaymentEnabled: boolean;
  ownerPortalUrl?: string;
  loyaltyPointsBalance?: number;
};

/** Normalize API store payload (camelCase or legacy snake_case). */
export function normalizeStoreBrief(raw: Record<string, unknown>): StoreBrief {
  const loc = raw.location as { lat?: number; lng?: number } | undefined;
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    phone: String(raw.phone ?? ""),
    ownerName: String(raw.ownerName ?? raw.owner_name ?? ""),
    location: {
      lat: Number(loc?.lat ?? raw.location_lat ?? 0),
      lng: Number(loc?.lng ?? raw.location_lng ?? 0),
    },
    addressText: (raw.addressText ?? raw.address_text ?? null) as string | null,
    areaName: (raw.areaName ?? raw.area_name ?? null) as string | null,
    imageUrl: (raw.imageUrl ?? raw.image_url ?? null) as string | null,
    deferredPaymentEnabled: Boolean(raw.deferredPaymentEnabled ?? raw.deferred_payment_enabled ?? false),
    ownerPortalUrl: (raw.ownerPortalUrl ?? raw.owner_portal_url) as string | undefined,
    loyaltyPointsBalance:
      raw.loyaltyPointsBalance != null || raw.loyalty_points_balance != null
        ? Number(raw.loyaltyPointsBalance ?? raw.loyalty_points_balance ?? 0)
        : undefined,
  };
}

export type PrizeProduct = {
  id: number;
  name: string;
  designation?: string | null;
  unit_label?: string | null;
  image_url?: string | null;
  redeemPointsPerUnit: number;
};
