import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "./theme";

type Props = {
  children: ReactNode;
  onBack: () => void;
};

type State = { error: Error | null };

export default class RegisterErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("RegisterStoreForm crashed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.box}>
          <Text style={styles.title}>تعذّر فتح شاشة تسجيل المتجر</Text>
          <Text style={styles.msg}>{this.state.error.message}</Text>
          <Pressable style={styles.btn} onPress={this.props.onBack}>
            <Text style={styles.btnText}>العودة للرئيسية</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: {
    margin: 16,
    padding: 20,
    borderRadius: theme.radius.lg,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.line,
  },
  title: { fontSize: 17, fontWeight: "800", color: theme.text, textAlign: "right" },
  msg: { fontSize: 13, color: theme.muted, marginTop: 10, textAlign: "right" },
  btn: {
    marginTop: 16,
    backgroundColor: theme.accent,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: "center",
  },
  btnText: { color: theme.onAccent, fontWeight: "800" },
});
