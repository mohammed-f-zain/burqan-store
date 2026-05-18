import * as Location from "expo-location";

export class LocationDeniedError extends Error {
  constructor() {
    super("location_denied");
    this.name = "LocationDeniedError";
  }
}

/** Current device GPS for store registration and proximity checks. */
export async function getRepPosition(): Promise<{ lat: number; lng: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new LocationDeniedError();
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}
