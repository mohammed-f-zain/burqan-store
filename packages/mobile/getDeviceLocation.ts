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

/** GPS fix is too imprecise for store registration or proximity checks. */
export class LocationInaccurateError extends Error {
  readonly accuracyM: number;

  constructor(accuracyM: number) {
    super("location_inaccurate");
    this.name = "LocationInaccurateError";
    this.accuracyM = accuracyM;
  }
}

export type RepPosition = {
  lat: number;
  lng: number;
  /** Horizontal accuracy radius in meters when reported by the OS. */
  accuracyM: number | null;
};

const DEFAULT_TIMEOUT_MS = 15_000;
/** Reject fixes worse than this for register / scan / orders. */
const DEFAULT_MAX_ACCURACY_M = 80;

/** Ask for location before QR resolve so iOS permission sheet is not hidden behind a loading overlay. */
export async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === "granted") return true;
  const next = await Location.requestForegroundPermissionsAsync();
  return next.status === "granted";
}

function toRepPosition(pos: Location.LocationObject): RepPosition {
  const accuracyM =
    pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null;
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM };
}

function assertAccuracy(accuracyM: number | null, maxAccuracyM: number): void {
  if (maxAccuracyM <= 0 || accuracyM == null) return;
  if (accuracyM > maxAccuracyM) throw new LocationInaccurateError(accuracyM);
}

async function readCurrentPosition(
  accuracy: Location.Accuracy,
  timeoutMs: number
): Promise<RepPosition> {
  const posPromise = Location.getCurrentPositionAsync({ accuracy });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LocationTimeoutError()), timeoutMs);
  });
  try {
    const pos = await Promise.race([posPromise, timeoutPromise]);
    return toRepPosition(pos);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Warm GPS in the background — not used for distance checks. */
export async function warmRepPosition(): Promise<void> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== "granted") return;
  void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => {});
}

/**
 * Fresh device GPS for store registration, QR scan, and orders.
 * Does not use stale cached positions (a common cause of 1–2 km errors).
 */
export async function getRepPosition(opts?: {
  timeoutMs?: number;
  maxAccuracyM?: number;
}): Promise<RepPosition> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAccuracyM = opts?.maxAccuracyM ?? DEFAULT_MAX_ACCURACY_M;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new LocationDeniedError();

  const accuracy = Location.Accuracy.High;
  let lastInaccurate: LocationInaccurateError | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const position = await readCurrentPosition(accuracy, timeoutMs);
      assertAccuracy(position.accuracyM, maxAccuracyM);
      return position;
    } catch (e) {
      if (e instanceof LocationInaccurateError) {
        lastInaccurate = e;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1_500));
          continue;
        }
      }
      throw e;
    }
  }

  throw lastInaccurate ?? new LocationTimeoutError();
}
