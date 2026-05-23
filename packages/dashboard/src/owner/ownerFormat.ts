/** Shared formatters for owner portal (always Arabic). */

export function ownerFormatMoney(n: number, currency: string) {
  return `${n.toLocaleString("ar-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
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
