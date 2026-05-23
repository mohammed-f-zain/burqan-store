import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { DailyStoreCard } from "./storeTypes";
import { theme } from "./theme";

type Labels = {
  close: string;
  phone: string;
  owner: string;
  location: string;
  locationUnknown: string;
  openInMaps: string;
  callStore: string;
  deferredOn: string;
  deferredOff: string;
};

type Props = {
  visible: boolean;
  store: DailyStoreCard | null;
  labels: Labels;
  formatLocation: (store: DailyStoreCard) => string;
  onClose: () => void;
};

export default function StorePeekModal(props: Props) {
  const { store, visible, labels } = props;
  if (!store) return null;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${store.location.lat},${store.location.lng}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Pressable onPress={props.onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>{labels.close}</Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{store.name}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {store.deferredPaymentEnabled ? labels.deferredOn : labels.deferredOff}
              </Text>
            </View>
            {store.areaName ? (
              <View style={[styles.badge, styles.badgeMuted]}>
                <Text style={styles.badgeTextMuted}>{store.areaName}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{labels.owner}</Text>
            <Text style={styles.value}>{store.ownerName}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{labels.phone}</Text>
            <Pressable style={styles.ltrWrap} onPress={() => void Linking.openURL(`tel:${store.phone}`)}>
              <Text style={[styles.value, styles.link]} numberOfLines={1}>
                {store.phone}
              </Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{labels.location}</Text>
            <Text style={styles.value}>{props.formatLocation(store)}</Text>
          </View>

          <Pressable style={styles.mapsBtn} onPress={() => void Linking.openURL(mapsUrl)}>
            <Text style={styles.mapsBtnText}>{labels.openInMaps}</Text>
          </Pressable>

          <Pressable style={styles.callBtn} onPress={() => void Linking.openURL(`tel:${store.phone}`)}>
            <Text style={styles.callBtnText}>{labels.callStore}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const { text, muted, line, accent, card } = {
  text: theme.text,
  muted: theme.muted,
  line: theme.line,
  accent: theme.accent,
  card: theme.card,
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  topBar: {
    flexDirection: "row-reverse",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: line,
  },
  closeBtn: { color: accent, fontWeight: "800", fontSize: 16 },
  body: { padding: 20, gap: 4 },
  title: { color: text, fontSize: 22, fontWeight: "800", textAlign: "right", marginBottom: 8 },
  badgeRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accentSoft,
  },
  badgeMuted: { backgroundColor: "#f1f5f9" },
  badgeText: { color: theme.accentDark, fontSize: 12, fontWeight: "700" },
  badgeTextMuted: { color: muted, fontSize: 12, fontWeight: "600" },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: line,
    gap: 6,
  },
  label: { color: muted, fontSize: 13, fontWeight: "600", textAlign: "right" },
  value: { color: text, fontSize: 16, fontWeight: "700", textAlign: "right" },
  link: { color: accent },
  ltrWrap: { direction: "ltr", alignSelf: "stretch" },
  mapsBtn: {
    marginTop: 20,
    backgroundColor: accent,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: "center",
  },
  mapsBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  callBtn: {
    marginTop: 10,
    backgroundColor: card,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: line,
  },
  callBtnText: { color: text, fontWeight: "700", fontSize: 16 },
});
