/** Fetch JSON with abort timeout (avoids infinite spinners on bad networks). */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ res: Response; data: T }> {
  const { timeoutMs = 25_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    const data = (await res.json().catch(() => ({}))) as T;
    return { res, data };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("network_timeout");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
