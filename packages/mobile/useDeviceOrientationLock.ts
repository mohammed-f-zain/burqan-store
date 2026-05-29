import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect } from "react";
import { Dimensions } from "react-native";

import { isTabletDevice } from "./deviceLayout";

/** Phones: portrait. Tablets: landscape. */
export function useDeviceOrientationLock(): void {
  useEffect(() => {
    let sub: { remove: () => void } | undefined;

    const apply = async () => {
      try {
        if (isTabletDevice()) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch {
        /* simulator / unsupported */
      }
    };

    void apply();
    sub = Dimensions.addEventListener("change", () => {
      void apply();
    });

    return () => sub?.remove();
  }, []);
}
