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

export function formatMarketDateTime(value: string | number | Date): string {
  return formatter.format(new Date(value));
}
