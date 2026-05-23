/** Extract qr_codes.public_token from a scan (raw token or https://…/r/TOKEN). */
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
