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

export const PAGE_HORIZONTAL_PADDING = 16;

/** Width used for grids (respects tablet max-width frame). */
export function layoutContentWidth(windowWidth: number, maxWidth?: number): number {
  return Math.min(windowWidth, maxWidth ?? windowWidth);
}

export type ProductGridLayout = {
  columns: number;
  cardWidth: number;
  gap: number;
};

/** Responsive product grid: 2 cols phone, 3–4 cols tablet landscape. */
export function getProductGridLayout(contentWidth: number, isTablet: boolean): ProductGridLayout {
  const gap = 12;
  const inner = contentWidth - PAGE_HORIZONTAL_PADDING * 2;
  let columns = 2;
  if (isTablet) {
    if (inner >= 880) columns = 4;
    else if (inner >= 620) columns = 3;
    else columns = 2;
  }
  const cardWidth = Math.max(120, Math.floor((inner - gap * (columns - 1)) / columns));
  return { columns, cardWidth, gap };
}
