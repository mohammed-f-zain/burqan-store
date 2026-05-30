import { Suspense, lazy } from "react";
import { ActivityIndicator, View } from "react-native";

import RegisterMapFallback, { type RegisterMapPanelProps } from "./RegisterMapFallback";
import { shouldLoadNativeMapsModule } from "./registerMapConfig";
import { theme } from "./theme";

const RegisterMapNative = lazy(() => import("./RegisterMapNative"));

export type { RegisterMapPanelProps };

export function RegisterMapPanel(props: RegisterMapPanelProps) {
  if (!shouldLoadNativeMapsModule()) {
    return <RegisterMapFallback {...props} />;
  }

  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      }
    >
      <RegisterMapNative {...props} />
    </Suspense>
  );
}
