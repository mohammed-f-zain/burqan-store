const DEFAULT_QR_BASE = "https://burqan.store";

function qrBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_QR_PAYLOAD_BASE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return DEFAULT_QR_BASE;
}

/** Full HTTPS URL encoded in store / card QR (same payload as printed cards). */
export function qrPayload(publicToken: string): string {
  return `${qrBaseUrl()}/r/${encodeURIComponent(publicToken)}`;
}
