import { lazy, Suspense } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { openInGoogleMaps } from "./openGoogleMaps";
import type { ProspectCard } from "./storeTypes";
import { theme } from "./theme";

const RegisterMapPanelLazy = lazy(() =>
  import("./registerMapPanel").then((m) => ({ default: m.RegisterMapPanel }))
);

type Labels = {
  close: string;
  phone: string;
  owner: string;
  location: string;
  address: string;
  area: string;
  coords: string;
  locationUnknown: string;
  openInMaps: string;
  callStore: string;
  linkQr: string;
  prospectPill: string;
  visited: string;
  pending: string;
  mapFallback: string;
  storeLocation: string;
};

type Props = {
  visible: boolean;
  prospect: ProspectCard | null;
  labels: Labels;
  formatLocation: (p: ProspectCard) => string;
  onClose: () => void;
  onLinkQr: (prospect: ProspectCard) => void;
};

export default function ProspectPeekModal(props: Props) {
  const { prospect, visible, labels } = props;
  if (!prospect) return null;

  const { lat, lng } = prospect.location;
  const mapRegion = {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Pressable onPress={props.onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>{labels.close}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{prospect.name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, styles.badgeProspect]}>
              <Text style={styles.badgeProspectText}>{labels.prospectPill}</Text>
            </View>
            {prospect.areaName ? (
              <View style={[styles.badge, styles.badgeMuted]}>
                <Text style={styles.badgeTextMuted}>{prospect.areaName}</Text>
              </View>
            ) : null}
            <View style={[styles.badge, prospect.visitedToday ? styles.badgeVisited : styles.badgeMuted]}>
              <Text style={prospect.visitedToday ? styles.badgeVisitedText : styles.badgeTextMuted}>
                {prospect.visitedToday ? labels.visited : labels.pending}
              </Text>
            </View>
          </View>

          <View style={styles.mapWrap}>
            <Suspense
              fallback={
                <View style={styles.mapLoading}>
                  <ActivityIndicator color={theme.accent} size="large" />
                </View>
              }
            >
              <RegisterMapPanelLazy
                mapRegion={mapRegion}
                lat={lat}
                lng={lng}
                mapAreas={[]}
                labels={{
                  mapFallback: labels.mapFallback,
                  openInMaps: labels.openInMaps,
                  storeLocation: labels.storeLocation,
                }}
              />
            </Suspense>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{labels.owner}</Text>
            <Text style={styles.value}>{prospect.ownerName}</Text>
          </View>

          {prospect.phone ? (
            <View style={styles.row}>
              <Text style={styles.label}>{labels.phone}</Text>
              <Pressable style={styles.ltrWrap} onPress={() => void Linking.openURL(`tel:${prospect.phone}`)}>
                <Text style={[styles.value, styles.link]} numberOfLines={1}>
                  {prospect.phone}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.row}>
            <Text style={styles.label}>{labels.location}</Text>
            <Text style={styles.value}>{props.formatLocation(prospect)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{labels.coords}</Text>
            <Text style={styles.valueCoords}>
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </Text>
          </View>

          {prospect.addressText?.trim() ? (
            <View style={styles.row}>
              <Text style={styles.label}>{labels.address}</Text>
              <Text style={styles.value}>{prospect.addressText.trim()}</Text>
            </View>
          ) : null}

          <Pressable
            style={styles.mapsBtn}
            onPress={() =>
              void openInGoogleMaps({
                lat,
                lng,
                name: prospect.name,
              })
            }
          >
            <Text style={styles.mapsBtnText}>{labels.openInMaps}</Text>
          </Pressable>

          {prospect.phone ? (
            <Pressable style={styles.callBtn} onPress={() => void Linking.openURL(`tel:${prospect.phone}`)}>
              <Text style={styles.callBtnText}>{labels.callStore}</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.linkQrBtn}
            onPress={() => {
              props.onClose();
              props.onLinkQr(prospect);
            }}
          >
            <Text style={styles.linkQrBtnText}>{labels.linkQr}</Text>
          </Pressable>
        </ScrollView>
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
  scroll: { padding: 20, paddingBottom: 32 },
  title: { color: text, fontSize: 22, fontWeight: "800", textAlign: "right", marginBottom: 8 },
  badgeRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accentSoft,
  },
  badgeMuted: { backgroundColor: "#f1f5f9" },
  badgeProspect: { backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#f59e0b" },
  badgeProspectText: { color: "#b45309", fontSize: 12, fontWeight: "800" },
  badgeVisited: { backgroundColor: "#dcfce7" },
  badgeVisitedText: { color: "#16a34a", fontSize: 12, fontWeight: "700" },
  badgeTextMuted: { color: muted, fontSize: 12, fontWeight: "600" },
  mapWrap: {
    height: 220,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: line,
    marginBottom: 8,
  },
  mapLoading: { flex: 1, justifyContent: "center", alignItems: "center", minHeight: 220 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: line,
    gap: 6,
  },
  label: { color: muted, fontSize: 13, fontWeight: "600", textAlign: "right" },
  value: { color: text, fontSize: 16, fontWeight: "700", textAlign: "right" },
  valueCoords: {
    color: text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
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
  linkQrBtn: {
    marginTop: 10,
    backgroundColor: theme.accentSoft,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: accent,
  },
  linkQrBtnText: { color: theme.accentDark, fontWeight: "800", fontSize: 16 },
});
