import * as Device from "expo-device";
import { Dimensions } from "react-native";

const TABLET_MIN_SHORT_EDGE_DP = 600;

/** Phone vs tablet (works in Expo Go when deviceType is unknown). */
export function isTabletDevice(): boolean {
  if (Device.deviceType === Device.DeviceType.TABLET) return true;
  const { width, height } = Dimensions.get("window");
  return Math.min(width, height) >= TABLET_MIN_SHORT_EDGE_DP;
}

/** Max content width on tablet landscape so UI stays readable. */
export function tabletContentMaxWidth(windowWidth: number, windowHeight: number): number {
  const longEdge = Math.max(windowWidth, windowHeight);
  return Math.min(960, Math.round(longEdge * 0.88));
}
