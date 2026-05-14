import { registerRootComponent } from "expo";
import { I18nManager } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import App from "./App";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);
