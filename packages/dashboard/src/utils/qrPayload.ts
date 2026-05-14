/** Value encoded in printed / scanned store QR (same logic as card pool). */
export function qrPayload(publicToken: string): string {
  const base = import.meta.env.VITE_QR_PAYLOAD_BASE_URL?.trim().replace(/\/$/, "");
  if (base) return `${base}/r/${encodeURIComponent(publicToken)}`;
  return publicToken;
}
