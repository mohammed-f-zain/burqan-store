import { NativeModules } from "react-native";

/** Public API (TLS). Set EXPO_PUBLIC_API_URL at build time to override (e.g. staging). */
export const DEFAULT_PRODUCTION_API = "https://api.burqan.store";

function normalizeApiUrl(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t.replace(/\/$/, "");
}

function isLikelyLanOrEmulatorHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "10.0.2.2") return true; // Android emulator → host machine
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return false;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * In dev, Metro serves the JS bundle from the dev machine — same host should run the API.
 * Avoids a wrong copy-pasted EXPO_PUBLIC_API_URL (e.g. 192.168.1.42) on a different subnet.
 * Returns null for localhost (simulator), Expo tunnels, or non-HTTP bundle URLs.
 */
function inferHostFromMetroBundle(): string | null {
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
    if (!scriptURL || typeof scriptURL !== "string") return null;
    const m = scriptURL.match(/^https?:\/\/([^/:?]+)(?::\d+)?/i);
    const host = m?.[1];
    if (!host) return null;
    const h = host.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1") return null;
    // Expo tunnel / cloud — API is not reachable at host:4000 from the phone
    if (h.endsWith(".exp.direct") || h.endsWith(".expo.io")) return null;
    if (!isLikelyLanOrEmulatorHost(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/** True when the app targets a LAN/localhost API (not the public production host). */
export function isLocalApiBase(base: string): boolean {
  try {
    const u = new URL(base);
    if (u.protocol !== "http:") return false;
    return isLikelyLanOrEmulatorHost(u.hostname) || u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * - **Release builds** (`__DEV__` false): `EXPO_PUBLIC_API_URL` if set, else {@link DEFAULT_PRODUCTION_API}.
 * - **Development (default)**: same live API as production — no local Mac/firewall required.
 * - **Local API in dev**: set `EXPO_PUBLIC_API_USE_LOCAL=1` to use Metro LAN host :4000 (or `EXPO_PUBLIC_API_URL`).
 * - `EXPO_PUBLIC_API_FORCE_ENV=1` + `EXPO_PUBLIC_API_URL` always wins in dev (staging, tunnel, etc.).
 */
export function resolveApiBase(): string {
  const envUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
  const forceEnv = process.env.EXPO_PUBLIC_API_FORCE_ENV === "1";
  const useLocal = process.env.EXPO_PUBLIC_API_USE_LOCAL === "1";
  const inferredHost = __DEV__ && useLocal ? inferHostFromMetroBundle() : null;
  const inferred = inferredHost ? `http://${inferredHost}:4000` : null;

  if (!__DEV__) {
    return envUrl ?? DEFAULT_PRODUCTION_API;
  }

  if (forceEnv && envUrl) return envUrl;
  if (useLocal) {
    if (inferred) return inferred;
    if (envUrl) return envUrl;
    return "http://127.0.0.1:4000";
  }
  return envUrl ?? DEFAULT_PRODUCTION_API;
}
