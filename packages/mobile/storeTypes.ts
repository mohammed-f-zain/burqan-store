export type DailyStoreCard = {
  id: number;
  name: string;
  phone: string;
  ownerName: string;
  location: { lat: number; lng: number };
  addressText?: string | null;
  areaName?: string | null;
  deferredPaymentEnabled: boolean;
  visitedToday?: boolean;
  visitNote?: string | null;
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
};
