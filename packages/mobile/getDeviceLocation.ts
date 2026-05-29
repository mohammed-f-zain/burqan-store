import * as Location from "expo-location";

export class LocationDeniedError extends Error {
  constructor() {
    super("location_denied");
    this.name = "LocationDeniedError";
  }
}

export class LocationTimeoutError extends Error {
  constructor() {
    super("location_timeout");
    this.name = "LocationTimeoutError";
  }
}

const DEFAULT_TIMEOUT_MS = 12_000;

/** Ask for location before QR resolve so iOS permission sheet is not hidden behind a loading overlay. */
export async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === "granted") return true;
  const next = await Location.requestForegroundPermissionsAsync();
  return next.status === "granted";
}

/** Current device GPS for store registration and proximity checks. */
export async function getRepPosition(opts?: { timeoutMs?: number }): Promise<{ lat: number; lng: number }> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new LocationDeniedError();

  const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
  if (last?.coords) {
    return { lat: last.coords.latitude, lng: last.coords.longitude };
  }

  const posPromise = Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LocationTimeoutError()), timeoutMs);
  });

  try {
    const pos = await Promise.race([posPromise, timeoutPromise]);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
