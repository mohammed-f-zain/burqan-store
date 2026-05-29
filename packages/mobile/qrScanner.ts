import { CameraView } from "expo-camera";
import { Platform } from "react-native";

/** Apple Data Scanner / Google Code Scanner — use shorthand `qr`. */
export const SYSTEM_QR_BARCODE_TYPES = ["qr"] as const;

/**
 * In-app CameraView on iOS needs AVMetadataObject symbology id.
 * Android accepts "qr".
 */
export const IN_APP_QR_BARCODE_TYPES =
  Platform.OS === "ios" ? (["org.iso.QRCode"] as const) : (["qr"] as const);

/** Native full-screen scanner (default camera UI on iPhone 16+ / Android). */
export function isSystemQrScannerAvailable(): boolean {
  return CameraView.isModernBarcodeScannerAvailable;
}
