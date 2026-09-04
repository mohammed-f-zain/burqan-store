/**
 * Gregorian business datetimes for Jordan (ar-JO), never Hijri calendar.
 */
const formatter = new Intl.DateTimeFormat("ar-JO", {
  calendar: "gregory",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  numberingSystem: "latn",
});

const dateOnlyFormatter = new Intl.DateTimeFormat("ar-JO", {
  calendar: "gregory",
  day: "numeric",
  month: "short",
  year: "numeric",
  numberingSystem: "latn",
  timeZone: "Asia/Amman",
});

export function formatMarketDateTime(value: string | number | Date): string {
  return formatter.format(new Date(value));
}

/** Date only (no time), Amman calendar day. */
export function formatMarketDate(value: string | number | Date): string {
  return dateOnlyFormatter.format(new Date(value));
}
