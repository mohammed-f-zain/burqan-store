export type StoreBrief = {
  id: number;
  name: string;
  phone: string;
  ownerName: string;
  location: { lat: number; lng: number };
  deferredPaymentEnabled: boolean;
  ownerPortalUrl?: string;
};
