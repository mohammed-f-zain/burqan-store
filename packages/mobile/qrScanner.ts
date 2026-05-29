import { CameraView } from "expo-camera";
import { Platform } from "react-native";

/**
 * iOS AVFoundation expects the ISO QR symbology id; the shorthand "qr" often never fires
 * `onBarcodeScanned` (Android accepts "qr").
 */
export const QR_BARCODE_TYPES = Platform.OS === "ios" ? (["org.iso.QRCode"] as const) : (["qr"] as const);

/**
 * Android: native Code Scanner when available (works reliably).
 * iOS: in-app CameraView — `launchScanner` / `onModernBarcodeScanned` frequently never delivers a result.
 */
export function shouldUseSystemQrScanner(): boolean {
  return Platform.OS === "android" && CameraView.isModernBarcodeScannerAvailable;
}
