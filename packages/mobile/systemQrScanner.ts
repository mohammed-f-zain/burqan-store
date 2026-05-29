import Constants from "expo-constants";
import { CameraView } from "expo-camera";
import { Platform } from "react-native";

import { SYSTEM_QR_BARCODE_TYPES } from "./qrScanner";

type ScanCallback = (data: string) => void;

let listenerInstalled = false;
let activeScanCallback: ScanCallback | null = null;

function extractScanData(ev: { data?: string } | undefined): string {
  const raw = ev?.data;
  return typeof raw === "string" ? raw.trim() : "";
}

/** One app-wide listener — per-open subscriptions break iOS when launchScanner resolves early. */
export function ensureSystemQrScanListener(): void {
  if (listenerInstalled || !CameraView.isModernBarcodeScannerAvailable) return;
  listenerInstalled = true;
  CameraView.onModernBarcodeScanned((ev) => {
    if (!activeScanCallback) return;
    const data = extractScanData(ev);
    if (!data) return;
    const cb = activeScanCallback;
    activeScanCallback = null;
    if (Platform.OS === "ios") {
      void CameraView.dismissScanner().catch(() => {});
    }
    cb(data);
  });
}

/**
 * Present native QR UI (Apple Data Scanner on iOS 16+).
 * Do not clear the callback when launchScanner's promise settles — only after a scan or a new session.
 */
export function presentSystemQrScanner(onScan: ScanCallback): void {
  ensureSystemQrScanListener();
  activeScanCallback = onScan;
  void CameraView.launchScanner({
    barcodeTypes: [...SYSTEM_QR_BARCODE_TYPES],
    ...(Platform.OS === "ios"
      ? { isHighlightingEnabled: true, isGuidanceEnabled: true }
      : {}),
  }).catch(() => {
    if (activeScanCallback === onScan) activeScanCallback = null;
  });
}

export function cancelSystemQrScanSession(): void {
  activeScanCallback = null;
}

/** Expo Go on iOS: launchScanner events are unreliable — use in-app CameraView instead. */
export function shouldUseInAppQrScannerOnIos(): boolean {
  return Platform.OS === "ios" && Constants.appOwnership === "expo";
}
