import type { ReactNode } from "react";
import { ActivityIndicator, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { productImageUrl } from "./productImage";
import { theme } from "./theme";

export type RepProfile = {
  id: number;
  email: string;
  fullName: string;
  phone: string;
  imageUrl: string | null;
  carPlate: string | null;
  areas: { id: number; name: string }[];
  inventory: { skuCount: number; totalUnits: number };
};

type Labels = {
  title: string;
  email: string;
  phone: string;
  carPlate: string;
  areas: string;
  inventory: string;
  sku: string;
  units: string;
  signOut: string;
  retry: string;
  errorHint: string;
  viewInventory: string;
  noAreas: string;
  noCarPlate: string;
};

type Props = {
  profile: RepProfile | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  labels: Labels;
  onRefresh: () => void;
  onSignOut: () => void;
  onOpenInventory: () => void;
};

const { bg, card, text, muted, line, accent, accentSoft, danger, radius, shadow } = theme;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`;
}

export default function ProfileScreen({
  profile,
  loading,
  error,
  refreshing,
  labels,
  onRefresh,
  onSignOut,
  onOpenInventory,
}: Props) {
  const avatarUri = productImageUrl(profile?.imageUrl);
  const areas = profile?.areas ?? [];
  const inventory = profile?.inventory ?? { skuCount: 0, totalUnits: 0 };

  let body: ReactNode;
  if (loading) {
    body = <ActivityIndicator size="large" color={accent} style={{ marginTop: 40 }} />;
  } else if (profile) {
    body = (
      <>
        <View style={styles.hero}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials(profile.fullName)}</Text>
            </View>
          )}
          <Text style={styles.name}>{profile.fullName}</Text>
          <Text style={styles.email}>{profile.email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{labels.title}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{labels.phone}</Text>
            <Pressable onPress={() => void Linking.openURL(`tel:${profile.phone}`)}>
              <Text style={[styles.value, styles.link]}>{profile.phone}</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{labels.email}</Text>
            <Text style={styles.value}>{profile.email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{labels.carPlate}</Text>
            <Text style={styles.value}>{profile.carPlate?.trim() || labels.noCarPlate}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{labels.areas}</Text>
          {areas.length === 0 ? (
            <Text style={styles.muted}>{labels.noAreas}</Text>
          ) : (
            <View style={styles.chips}>
              {areas.map((a) => (
                <View key={a.id} style={styles.chip}>
                  <Text style={styles.chipText}>{a.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Pressable style={styles.card} onPress={onOpenInventory}>
          <View style={styles.inventoryRow}>
            <View>
              <Text style={styles.cardTitle}>{labels.inventory}</Text>
              <Text style={styles.muted}>
                {labels.sku}: {inventory.skuCount} · {labels.units}: {inventory.totalUnits}
              </Text>
            </View>
            <Text style={styles.chevron}>‹</Text>
          </View>
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={onSignOut}>
          <Text style={styles.signOutText}>{labels.signOut}</Text>
        </Pressable>
      </>
    );
  } else if (error) {
    body = (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>{error}</Text>
        <Text style={styles.errorHint}>{labels.errorHint}</Text>
        <Pressable style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryText}>{labels.retry}</Text>
        </Pressable>
        <Pressable style={styles.signOutBtn} onPress={onSignOut}>
          <Text style={styles.signOutText}>{labels.signOut}</Text>
        </Pressable>
      </View>
    );
  } else {
    body = <ActivityIndicator size="large" color={accent} style={{ marginTop: 40 }} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.wrap}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />}
    >
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 24, flexGrow: 1 },
  hero: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: accentSoft,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: accent,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: "800",
    color: accent,
  },
  name: {
    fontSize: 22,
    fontWeight: "800",
    color: text,
    marginTop: 12,
    textAlign: "center",
  },
  email: {
    fontSize: 14,
    color: muted,
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    backgroundColor: card,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: line,
    ...shadow.card,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: text,
    marginBottom: 12,
    textAlign: "right",
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: muted,
    marginBottom: 4,
    textAlign: "right",
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
    color: text,
    textAlign: "right",
  },
  link: {
    color: accent,
  },
  muted: {
    fontSize: 14,
    color: muted,
    textAlign: "right",
  },
  chips: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: accent,
  },
  inventoryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chevron: {
    fontSize: 28,
    color: muted,
  },
  errorBox: {
    marginTop: 24,
    padding: 20,
    borderRadius: radius.lg,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: line,
    alignItems: "stretch",
    ...shadow.card,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: danger,
    textAlign: "center",
    marginBottom: 10,
  },
  errorHint: {
    fontSize: 14,
    color: muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  retryBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: accent,
    alignItems: "center",
    marginBottom: 12,
  },
  retryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  signOutBtn: {
    marginTop: 4,
    paddingVertical: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(225, 29, 72, 0.35)",
    backgroundColor: "rgba(225, 29, 72, 0.06)",
    alignItems: "center",
  },
  signOutText: {
    color: danger,
    fontWeight: "800",
    fontSize: 16,
  },
});
