import { registerRootComponent } from "expo";
import { SafeAreaProvider } from "react-native-safe-area-context";

import App from "./App";

// Do not call I18nManager.forceRTL at startup — it crashes many Android release builds.
// The UI is already RTL via styles (row-reverse, textAlign right).

function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);
