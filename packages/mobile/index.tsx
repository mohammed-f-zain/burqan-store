import { registerRootComponent } from "expo";
import { SafeAreaProvider } from "react-native-safe-area-context";

import App from "./App";
import { useDeviceOrientationLock } from "./useDeviceOrientationLock";

// Do not call I18nManager.forceRTL at startup — it crashes many Android release builds.
// The UI is already RTL via styles (row-reverse, textAlign right).

function Root() {
  useDeviceOrientationLock();
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);
