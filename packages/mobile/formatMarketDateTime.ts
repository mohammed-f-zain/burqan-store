/**
 * Gregorian business datetimes for Jordan: English short months (Jan, Feb, …),
 * never Hijri (e.g. ar-SA default Islamic calendar).
 */
const formatter = new Intl.DateTimeFormat("en-GB", {
  calendar: "gregory",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMarketDateTime(value: string | number | Date): string {
  return formatter.format(new Date(value));
}
