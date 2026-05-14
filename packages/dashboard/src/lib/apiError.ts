/** First API `error` string, then first Zod `fieldErrors` message if present. */
export function pickAxiosErrorMessage(err: unknown, fallback: string): string {
  if (typeof err !== "object" || err === null || !("response" in err)) return fallback;
  const data = (err as { response?: { data?: { error?: string; details?: { fieldErrors?: Record<string, string[]> } } } })
    .response?.data;
  if (!data?.error) return fallback;
  const fe = data.details?.fieldErrors;
  if (fe && typeof fe === "object") {
    for (const msgs of Object.values(fe)) {
      if (Array.isArray(msgs) && msgs[0]) return `${data.error} — ${msgs[0]}`;
    }
  }
  return data.error;
}
