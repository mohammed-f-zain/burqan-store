/** Latin digits (0–9) even when the UI language is Arabic. */
const LATIN_NUMBER_LOCALE = "en-GB";

export function formatLatinNumber(
  n: number,
  options: Intl.NumberFormatOptions = {}
): string {
  const amount = Number.isFinite(n) ? n : 0;
  return amount.toLocaleString(LATIN_NUMBER_LOCALE, options);
}

export function ownerFormatMoney(n: number, currency: string) {
  return `${formatLatinNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function ownerOrderHref(orderId: string, token: string, newTab = false) {
  const url = `/owner/order/${orderId}?t=${encodeURIComponent(token)}`;
  if (newTab && typeof window !== "undefined") {
    return url;
  }
  return url;
}

export function openOwnerOrder(orderId: string, token: string) {
  const url = `${window.location.origin}/owner/order/${orderId}?t=${encodeURIComponent(token)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
