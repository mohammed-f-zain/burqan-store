import { CameraView } from "expo-camera";
import { Platform } from "react-native";

import { shouldUseInAppQrScannerOnIos } from "./systemQrScanner";

/** Apple Data Scanner / Google Code Scanner. */
export const SYSTEM_QR_BARCODE_TYPES = ["qr"] as const;

/** In-app CameraView — iOS needs AVFoundation symbology id. */
export const IN_APP_QR_BARCODE_TYPES =
  Platform.OS === "ios" ? (["org.iso.QRCode", "qr"] as const) : (["qr"] as const);

export function isSystemQrScannerAvailable(): boolean {
  return CameraView.isModernBarcodeScannerAvailable;
}

/** Native full-screen scanner when supported (not Expo Go on iOS). */
export function shouldUseSystemQrScanner(): boolean {
  if (shouldUseInAppQrScannerOnIos()) return false;
  return isSystemQrScannerAvailable();
}
