import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "./theme";

type Props = {
  children: ReactNode;
  fallbackText?: string;
  height?: number;
};

type State = { failed: boolean };

/** Catches JS map render errors so the rest of the app keeps working. */
export default class MapPanelErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Map panel failed", error.message, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={[styles.fallback, this.props.height ? { height: this.props.height } : null]}>
          <Text style={styles.text}>{this.props.fallbackText ?? "تعذّر تحميل الخريطة — باقي التطبيق يعمل بشكل طبيعي"}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "#0f172a",
    borderRadius: theme.radius.md,
  },
  text: { color: "#cbd5e1", fontSize: 12, textAlign: "center", lineHeight: 18 },
});
