import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "./theme";

type Props = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

/** Prominent full-width control to end the current store visit. */
export default function EndVisitBar(props: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.wrapPressed]}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.title}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="log-out-outline" size={22} color="#fff" />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{props.title}</Text>
        <Text style={styles.subtitle}>{props.subtitle}</Text>
      </View>
      <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.85)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.accentDark,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.35)",
    ...theme.shadow.card,
  },
  wrapPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1, gap: 4 },
  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
  },
  subtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    lineHeight: 18,
  },
});
