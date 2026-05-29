import Constants from "expo-constants";
import { CameraView } from "expo-camera";
import { Platform } from "react-native";

export { IN_APP_QR_BARCODE_TYPES, SYSTEM_QR_BARCODE_TYPES } from "./qrScannerConfig";

export function isSystemQrScannerAvailable(): boolean {
  return CameraView.isModernBarcodeScannerAvailable;
}

/** Expo Go on iOS: launchScanner events are unreliable — use in-app CameraView instead. */
export function shouldUseInAppQrScannerOnIos(): boolean {
  return Platform.OS === "ios" && Constants.appOwnership === "expo";
}

/** Native full-screen scanner when supported (not Expo Go on iOS). */
export function shouldUseSystemQrScanner(): boolean {
  if (shouldUseInAppQrScannerOnIos()) return false;
  return isSystemQrScannerAvailable();
}
