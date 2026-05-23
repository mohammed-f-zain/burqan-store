import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastKind = "success" | "error" | "info";

const palettes: Record<ToastKind, { bg: string; border: string; text: string; label: string }> = {
  success: { bg: "#ecfdf5", border: "#0d9488", text: "#134e4a", label: "✓" },
  error: { bg: "#fff1f2", border: "#e11d48", text: "#9f1239", label: "!" },
  info: { bg: "#f0f9ff", border: "#0284c7", text: "#0c4a6e", label: "i" },
};

type Props = {
  text: string;
  kind: ToastKind;
  onDismiss: () => void;
};

export default function ToastOverlay({ text, kind, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const p = palettes[kind];

  return (
    <View style={[styles.host, { top: insets.top + 8 }]} pointerEvents="box-none">
      <View style={[styles.toast, { backgroundColor: p.bg, borderColor: p.border }]} accessibilityRole="alert">
        <View style={[styles.badge, { borderColor: p.border }]}>
          <Text style={[styles.badgeText, { color: p.border }]}>{p.label}</Text>
        </View>
        <Text style={[styles.message, { color: p.text }]}>{text}</Text>
        <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="إغلاق">
          <Text style={[styles.close, { color: p.text }]}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 200,
    elevation: 200,
  },
  toast: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontWeight: "800", fontSize: 14 },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "right",
    writingDirection: "rtl",
  },
  close: { fontSize: 18, fontWeight: "700", paddingHorizontal: 4 },
});
