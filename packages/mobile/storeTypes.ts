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
};

export type StoreBrief = {
  id: number;
  name: string;
  phone: string;
  ownerName: string;
  location: { lat: number; lng: number };
  addressText?: string | null;
  areaName?: string | null;
  deferredPaymentEnabled: boolean;
  ownerPortalUrl?: string;
  loyaltyPointsBalance?: number;
};

export type PrizeProduct = {
  id: number;
  name: string;
  designation?: string | null;
  unit_label?: string | null;
  image_url?: string | null;
  redeemPointsPerUnit: number;
};
