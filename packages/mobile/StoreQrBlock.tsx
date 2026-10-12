import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { qrPayload } from "./qrPayload";
import { theme } from "./theme";

type Props = {
  qrPublicToken: string;
  title: string;
  hint: string;
};

/** Renders the same scan payload as the physical store QR card. */
export default function StoreQrBlock(props: Props) {
  const value = qrPayload(props.qrPublicToken);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{props.title}</Text>
      <View style={styles.card}>
        <QRCode value={value} size={180} backgroundColor="#ffffff" color="#0f172a" />
      </View>
      <Text style={styles.hint}>{props.hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    alignItems: "center",
    gap: 10,
  },
  title: {
    alignSelf: "stretch",
    color: theme.muted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  card: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.line,
  },
  hint: {
    color: theme.muted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
