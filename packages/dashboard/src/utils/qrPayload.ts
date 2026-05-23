const DEFAULT_QR_BASE = "https://burqan.store";

function qrBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_QR_PAYLOAD_BASE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin.replace(/\/$/, "");
  return DEFAULT_QR_BASE;
}

/** Full HTTPS URL encoded in store / card QR (opens owner portal in phone browser). */
export function qrPayload(publicToken: string): string {
  return `${qrBaseUrl()}/r/${encodeURIComponent(publicToken)}`;
}

/** Extract public_token from scanned text (raw token or https://…/r/TOKEN). */
export function parseQrPublicToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const u = new URL(trimmed);
      const m = u.pathname.match(/\/r\/([^/]+)\/?$/i);
      if (m?.[1]) return decodeURIComponent(m[1]);
      const last = u.pathname.split("/").filter(Boolean).pop();
      if (last && last.length >= 16) return decodeURIComponent(last);
    }
    const pathMatch = trimmed.match(/\/r\/([^/?#]+)/i);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
  } catch {
    /* use raw */
  }
  return trimmed;
}

export function hasConfiguredQrBaseUrl(): boolean {
  return Boolean(import.meta.env.VITE_QR_PAYLOAD_BASE_URL?.trim()) || typeof window !== "undefined";
}
