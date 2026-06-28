import * as ImagePicker from "expo-image-picker";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchJson } from "./fetchJson";
import RegisterMapFallback from "./RegisterMapFallback";
import type { MapRegion } from "./registerMapConfig";
import { shouldLoadNativeMapsModule } from "./registerMapConfig";
import { getRepPosition, LocationDeniedError, LocationTimeoutError } from "./getDeviceLocation";
import { productImageUrl } from "./productImage";
import type { StoreBrief } from "./storeTypes";
import { theme } from "./theme";
import { voronoiGeoJsonToCells, type VoronoiMapCell } from "./voronoiMapGeo";

const RegisterMapPanelLazy = lazy(() =>
  import("./registerMapPanel").then((m) => ({ default: m.RegisterMapPanel }))
);

const labels = {
  title: "تعديل بيانات المتجر",
  areaAuto: "المنطقة",
  areaDetecting: "جاري تحديد المنطقة…",
  areaOutsideRep: "خارج مناطقك",
  areaInRep: "ضمن مناطقك",
  refreshLocation: "تحديث الموقع من GPS",
  storeName: "اسم المتجر",
  storePhone: "هاتف المتجر",
  ownerName: "اسم صاحب المتجر",
  location: "الموقع",
  address: "العنوان (اختياري)",
  storePhoto: "صورة المتجر",
  pickPhoto: "اختر صورة",
  takePhoto: "التقاط صورة",
  photoChoiceTitle: "صورة المتجر",
  cancel: "إلغاء",
  saveStore: "حفظ التعديلات",
  locating: "جاري تحديد موقعك…",
  locationDenied: "يلزم تفعيل الموقع لتحديث الإحداثيات",
  photosPermission: "يلزم إذن الوصول إلى الصور",
  cameraDenied: "يلزم إذن الكاميرا",
  uploadFailed: "فشل رفع الصورة",
  saveFailed: "فشل حفظ التعديلات",
  storeSaved: "تم تحديث بيانات المتجر.",
  mapLoadFailed: "تعذّر تحميل خريطة المناطق",
  mapFallback: "معاينة الخريطة غير متاحة — الموقع يُحدَّد من GPS.",
  openInMaps: "فتح في خرائط Google",
  storeLocation: "موقع المتجر",
};

const JORDAN_REGION: MapRegion = {
  latitude: 31.25,
  longitude: 36.5,
  latitudeDelta: 4.8,
  longitudeDelta: 4.2,
};

type Props = {
  visible: boolean;
  store: StoreBrief;
  headers: Record<string, string>;
  apiBase: string;
  authToken: string;
  onClose: () => void;
  onNotice: (msg: string) => void;
  onSaved: (store: StoreBrief) => void;
};

async function uploadRepImage(apiBase: string, bearer: string, uri: string, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append("file", { uri, name: "upload.jpg", type: mimeType } as unknown as Blob);
  const res = await fetch(`${apiBase}/api/v1/rep/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : labels.uploadFailed);
  return data.path as string;
}

export default function EditStoreForm(props: Props) {
  const { store, visible } = props;
  const [name, setName] = useState(store.name);
  const [phone, setPhone] = useState(store.phone);
  const [ownerName, setOwnerName] = useState(store.ownerName);
  const [lat, setLat] = useState<number | null>(store.location.lat);
  const [lng, setLng] = useState<number | null>(store.location.lng);
  const [initialLat] = useState(store.location.lat);
  const [initialLng] = useState(store.location.lng);
  const [address, setAddress] = useState(store.addressText ?? "");
  const [areaId, setAreaId] = useState<number | undefined>();
  const [areaName, setAreaName] = useState(store.areaName ?? "");
  const [areaAssignedToRep, setAreaAssignedToRep] = useState(true);
  const [areaResolved, setAreaResolved] = useState(false);
  const [jordanAreas, setJordanAreas] = useState<VoronoiMapCell[]>([]);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(store.imageUrl ?? null);
  const [initialImagePath] = useState<string | null>(store.imageUrl ?? null);

  const mapRegion = useMemo((): MapRegion => {
    if (lat != null && lng != null) {
      return { latitude: lat, longitude: lng, latitudeDelta: 0.12, longitudeDelta: 0.12 };
    }
    return JORDAN_REGION;
  }, [lat, lng]);

  const mapAreas = jordanAreas;

  const loadJordanAreas = useCallback(
    async (nearLat: number, nearLng: number) => {
      const url = `${props.apiBase}/api/v1/rep/areas/jordan?lat=${nearLat}&lng=${nearLng}&radiusKm=22`;
      const { res, data } = await fetchJson<{ geojson?: { features?: unknown[] }; error?: string }>(url, {
        headers: props.headers,
        timeoutMs: 20_000,
      });
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : labels.mapLoadFailed);
      setJordanAreas(voronoiGeoJsonToCells(data.geojson));
    },
    [props.apiBase, props.headers]
  );

  const resolveAreaAt = useCallback(
    async (atLat: number, atLng: number) => {
      const { res, data } = await fetchJson<{
        areaId?: number;
        areaName?: string;
        governorate?: string | null;
        assignedToRep?: boolean;
        error?: string;
      }>(
        `${props.apiBase}/api/v1/rep/areas/resolve?lat=${atLat}&lng=${atLng}&forRegister=1`,
        { headers: props.headers, timeoutMs: 20_000 }
      );
      if (res.ok && data.areaId) {
        setAreaId(data.areaId);
        const gov = typeof data.governorate === "string" ? data.governorate : "";
        const nm = data.areaName ?? "";
        setAreaName(gov && nm ? `${nm} · ${gov}` : nm);
        setAreaAssignedToRep(data.assignedToRep !== false);
        setAreaResolved(true);
      } else {
        setAreaResolved(false);
        setAreaId(undefined);
      }
      void loadJordanAreas(atLat, atLng).catch(() => {});
    },
    [props.apiBase, props.headers, loadJordanAreas]
  );

  const refreshLocation = useCallback(async () => {
    setLocating(true);
    try {
      const pos = await getRepPosition({ timeoutMs: 12_000 });
      setLat(pos.lat);
      setLng(pos.lng);
      await resolveAreaAt(pos.lat, pos.lng);
    } catch (e) {
      setAreaResolved(false);
      if (e instanceof LocationDeniedError) props.onNotice(labels.locationDenied);
      else if (e instanceof LocationTimeoutError) props.onNotice(labels.locating);
      else props.onNotice(e instanceof Error ? e.message : labels.locating);
    } finally {
      setLocating(false);
    }
  }, [props.onNotice, resolveAreaAt]);

  useEffect(() => {
    if (!visible) return;
    setName(store.name);
    setPhone(store.phone);
    setOwnerName(store.ownerName);
    setLat(store.location.lat);
    setLng(store.location.lng);
    setAddress(store.addressText ?? "");
    setImagePath(store.imageUrl ?? null);
    setAreaName(store.areaName ?? "");
    void resolveAreaAt(store.location.lat, store.location.lng);
  }, [visible, store, resolveAreaAt]);

  async function uploadAsset(uri: string, mimeType: string) {
    setUploadBusy(true);
    try {
      const path = await uploadRepImage(props.apiBase, props.authToken, uri, mimeType);
      setImagePath(path);
    } catch (e) {
      props.onNotice(e instanceof Error ? e.message : labels.uploadFailed);
    } finally {
      setUploadBusy(false);
    }
  }

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      props.onNotice(labels.photosPermission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadAsset(asset.uri, asset.mimeType ?? "image/jpeg");
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      props.onNotice(labels.cameraDenied);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadAsset(asset.uri, asset.mimeType ?? "image/jpeg");
  }

  function choosePhoto() {
    Alert.alert(labels.photoChoiceTitle, undefined, [
      { text: labels.cancel, style: "cancel" },
      { text: labels.takePhoto, onPress: () => void pickFromCamera() },
      { text: labels.pickPhoto, onPress: () => void pickFromGallery() },
    ]);
  }

  async function submit() {
    if (lat == null || lng == null) {
      props.onNotice(labels.locating);
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      if (name.trim() !== store.name) body.name = name.trim();
      if (phone.trim() !== store.phone) body.phone = phone.trim();
      if (ownerName.trim() !== store.ownerName) body.ownerName = ownerName.trim();
      const addr = address.trim();
      if (addr !== (store.addressText ?? "")) body.addressText = addr || null;
      if (imagePath !== initialImagePath) body.imageUrl = imagePath;

      const locationChanged =
        Math.abs(lat - initialLat) > 1e-6 || Math.abs(lng - initialLng) > 1e-6;
      if (locationChanged) {
        const pos = await getRepPosition({ timeoutMs: 12_000 });
        body.locationLat = lat;
        body.locationLng = lng;
        body.repLat = pos.lat;
        body.repLng = pos.lng;
      }

      if (Object.keys(body).length === 0) {
        props.onClose();
        return;
      }

      const { res, data } = await fetchJson<{ store?: StoreBrief; error?: string }>(
        `${props.apiBase}/api/v1/rep/stores/${store.id}`,
        {
          method: "PATCH",
          headers: props.headers,
          body: JSON.stringify(body),
          timeoutMs: 25_000,
        }
      );
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : labels.saveFailed);
      if (data.store) props.onSaved(data.store);
      else props.onSaved({ ...store, name: name.trim(), phone: phone.trim(), ownerName: ownerName.trim(), addressText: addr || null, imageUrl: imagePath, location: { lat, lng } });
    } catch (e) {
      props.onNotice(e instanceof Error ? e.message : labels.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  const previewUri = imagePath ? productImageUrl(imagePath) : undefined;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{labels.title}</Text>

            <Text style={styles.label}>{labels.areaAuto}</Text>
            {locating ? (
              <View style={styles.row}>
                <ActivityIndicator color={theme.accent} />
                <Text style={styles.muted}>{labels.areaDetecting}</Text>
              </View>
            ) : (
              <View style={[styles.areaBadge, !areaAssignedToRep && styles.areaBadgeInfo]}>
                <Text style={styles.areaBadgeText}>{areaName || "—"}</Text>
              </View>
            )}
            {areaResolved ? (
              <Text style={areaAssignedToRep ? styles.areaHintOk : styles.areaHintInfo}>
                {areaAssignedToRep ? labels.areaInRep : labels.areaOutsideRep}
              </Text>
            ) : null}

            <View style={styles.mapWrap}>
              {shouldLoadNativeMapsModule() ? (
                <Suspense
                  fallback={
                    <View style={styles.mapLoading}>
                      <ActivityIndicator color={theme.accent} />
                    </View>
                  }
                >
                  <RegisterMapPanelLazy
                    mapRegion={mapRegion}
                    lat={lat}
                    lng={lng}
                    mapAreas={mapAreas}
                    areaId={areaId}
                    labels={{
                      mapFallback: labels.mapFallback,
                      openInMaps: labels.openInMaps,
                      storeLocation: labels.storeLocation,
                    }}
                  />
                </Suspense>
              ) : (
                <RegisterMapFallback
                  mapRegion={mapRegion}
                  lat={lat}
                  lng={lng}
                  mapAreas={mapAreas}
                  areaId={areaId}
                  labels={{
                    mapFallback: labels.mapFallback,
                    openInMaps: labels.openInMaps,
                    storeLocation: labels.storeLocation,
                  }}
                />
              )}
            </View>

            <Pressable style={styles.secondary} onPress={() => void refreshLocation()} disabled={locating}>
              <Text style={styles.secondaryText}>{labels.refreshLocation}</Text>
            </Pressable>

            <Text style={styles.label}>{labels.storeName}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} textAlign="right" />

            <Text style={styles.label}>{labels.storePhone}</Text>
            <TextInput
              style={[styles.input, styles.ltr]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textAlign="left"
            />

            <Text style={styles.label}>{labels.ownerName}</Text>
            <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} textAlign="right" />

            <Text style={styles.label}>{labels.address}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={address}
              onChangeText={setAddress}
              multiline
              textAlign="right"
            />

            <Text style={styles.label}>{labels.storePhoto}</Text>
            {previewUri ? <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" /> : null}
            <Pressable style={styles.secondary} onPress={choosePhoto} disabled={uploadBusy}>
              {uploadBusy ? (
                <ActivityIndicator color={theme.accent} />
              ) : (
                <Text style={styles.secondaryText}>{labels.pickPhoto}</Text>
              )}
            </Pressable>

            <View style={styles.actions}>
              <Pressable style={styles.secondaryBtn} onPress={props.onClose} disabled={busy}>
                <Text style={styles.secondaryBtnText}>{labels.cancel}</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => void submit()} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{labels.saveStore}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.xl,
    padding: 18,
    ...theme.shadow.card,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "right",
  },
  label: { color: theme.muted, marginTop: 12, fontSize: 12, fontWeight: "600", textAlign: "right" },
  input: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    color: theme.text,
    marginTop: 8,
    backgroundColor: "#f8fafc",
    fontSize: 16,
  },
  ltr: { textAlign: "left" },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  muted: { color: theme.muted, fontSize: 13, textAlign: "right", marginTop: 4 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 8 },
  areaBadge: {
    marginTop: 8,
    alignSelf: "flex-end",
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  areaBadgeInfo: {
    backgroundColor: "rgba(34, 211, 238, 0.12)",
    borderColor: "rgba(37, 99, 235, 0.35)",
  },
  areaBadgeText: { color: theme.accentDark, fontWeight: "800", fontSize: 15 },
  areaHintOk: {
    color: "#16a34a",
    fontSize: 13,
    marginTop: 6,
    textAlign: "right",
    fontWeight: "600",
  },
  areaHintInfo: {
    color: theme.accentDark,
    fontSize: 13,
    marginTop: 6,
    textAlign: "right",
    fontWeight: "600",
  },
  mapWrap: {
    marginTop: 12,
    height: 200,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.line,
  },
  mapLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  preview: {
    width: "100%",
    height: 140,
    borderRadius: theme.radius.md,
    marginTop: 10,
    backgroundColor: "#f1f5f9",
  },
  secondary: {
    marginTop: 12,
    backgroundColor: "#f8fafc",
    borderColor: theme.line,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: theme.radius.md,
    alignItems: "center",
  },
  secondaryText: { color: theme.text, fontWeight: "700", fontSize: 15 },
  actions: {
    flexDirection: "row-reverse",
    gap: 12,
    marginTop: 22,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderColor: theme.line,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: "center",
  },
  secondaryBtnText: { color: theme.text, fontWeight: "700", fontSize: 15 },
  primaryBtn: {
    flex: 1,
    backgroundColor: theme.accent,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
