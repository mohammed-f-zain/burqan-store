/** Normalize Arabic / Latin place names for fuzzy matching. */
export function normalizePlaceName(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآٱا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^a-z0-9\u0600-\u06ff\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
