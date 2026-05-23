/**
 * Gregorian business datetimes for Jordan — never Hijri (e.g. ar-SA default Islamic calendar).
 */
const formatters = {
  en: new Intl.DateTimeFormat("en-GB", {
    calendar: "gregory",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }),
  ar: new Intl.DateTimeFormat("ar-JO", {
    calendar: "gregory",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: "latn",
  }),
};

export function formatMarketDateTime(value: string | number | Date, locale: "ar" | "en" = "en"): string {
  return formatters[locale].format(new Date(value));
}
