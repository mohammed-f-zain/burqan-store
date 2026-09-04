export type ProspectCard = {
  id: number;
  name: string;
  phone: string;
  ownerName: string;
  location: { lat: number; lng: number };
  addressText?: string | null;
  areaName?: string | null;
  visitedToday?: boolean;
  todayVisitNote?: string | null;
};

export type DailyStoreCard = {
  id: number;
  /** burqan = registered with QR; google = prospect from Google Maps; prospect = manual possible client */
  source?: "burqan" | "google" | "prospect";
  name: string;
  phone: string;
  ownerName: string;
  location: { lat: number; lng: number };
  addressText?: string | null;
  areaName?: string | null;
  deferredPaymentEnabled: boolean;
  visitedToday?: boolean;
  visitNote?: string | null;
  /** ISO timestamp of the most recent visit to this store (any rep), if any. */
  lastVisitedAt?: string | null;
  googleMapsUrl?: string | null;
  googlePlaceId?: string | null;
  /** Nearest-first route tab (meters from rep GPS). */
  distanceM?: number;
  distanceLabel?: string;
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

/** Normalize daily/route store payloads from the API (camelCase or snake_case). */
export function normalizeDailyStoreCard(raw: Record<string, unknown>): DailyStoreCard {
  const loc = (raw.location as { lat?: number; lng?: number } | undefined) ?? {};
  const lastRaw = raw.lastVisitedAt ?? raw.last_visited_at ?? null;
  let lastVisitedAt: string | null = null;
  if (lastRaw != null && lastRaw !== "") {
    const d = new Date(String(lastRaw));
    if (!Number.isNaN(d.getTime())) lastVisitedAt = d.toISOString();
  }
  return {
    id: Number(raw.id),
    source: (raw.source as DailyStoreCard["source"]) ?? "burqan",
    name: String(raw.name ?? ""),
    phone: String(raw.phone ?? ""),
    ownerName: String(raw.ownerName ?? raw.owner_name ?? ""),
    location: {
      lat: Number(loc.lat ?? raw.location_lat ?? 0),
      lng: Number(loc.lng ?? raw.location_lng ?? 0),
    },
    addressText: (raw.addressText ?? raw.address_text ?? null) as string | null,
    areaName: (raw.areaName ?? raw.area_name ?? null) as string | null,
    deferredPaymentEnabled: Boolean(raw.deferredPaymentEnabled ?? raw.deferred_payment_enabled ?? false),
    visitedToday: Boolean(raw.visitedToday ?? raw.visited_today ?? false),
    visitNote: (raw.visitNote ?? raw.visit_note ?? raw.todayVisitNote ?? null) as string | null,
    lastVisitedAt,
    googleMapsUrl: (raw.googleMapsUrl ?? raw.google_maps_url ?? null) as string | null,
    googlePlaceId: (raw.googlePlaceId ?? raw.google_place_id ?? null) as string | null,
    distanceM: raw.distanceM != null ? Number(raw.distanceM) : undefined,
    distanceLabel: raw.distanceLabel != null ? String(raw.distanceLabel) : undefined,
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
