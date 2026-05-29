import { Platform } from "react-native";

/** Apple Data Scanner / Google Code Scanner. */
export const SYSTEM_QR_BARCODE_TYPES = ["qr"] as const;

/** In-app CameraView — iOS needs AVFoundation symbology id. */
export const IN_APP_QR_BARCODE_TYPES =
  Platform.OS === "ios" ? (["org.iso.QRCode", "qr"] as const) : (["qr"] as const);
