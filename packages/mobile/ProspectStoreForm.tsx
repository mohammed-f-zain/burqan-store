import * as ImagePicker from "expo-image-picker";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetchJson } from "./fetchJson";
import RegisterMapFallback from "./RegisterMapFallback";
import type { MapRegion } from "./registerMapConfig";
import { shouldLoadNativeMapsModule } from "./registerMapConfig";
import { voronoiGeoJsonToCells, type VoronoiMapCell } from "./voronoiMapGeo";

const RegisterMapPanelLazy = lazy(() =>
  import("./registerMapPanel").then((m) => ({ default: m.RegisterMapPanel }))
);
import { getRepPosition, LocationDeniedError, LocationInaccurateError, LocationTimeoutError } from "./getDeviceLocation";
import { resolveRepArea } from "./resolveRepArea";
import { productImageUrl } from "./productImage";
import NotRegisterReasonPicker from "./NotRegisterReasonPicker";
import { isValidProspectReason } from "./notRegisterReasons";
import { theme } from "./theme";

const labels = {
  title: "إضافة عميل محتمل",
  subtitle: "بدون رمز QR — يُربط لاحقاً عند مسح بطاقة جديدة",
  areaAuto: "المنطقة (تلقائي من موقعك)",
  areaDetecting: "جاري تحديد المنطقة…",
  areaOutsideRep: "خارج مسار اليوم — يُسجَّل هنا ويظهر لمندوبي هذه المنطقة",
  areaInRep: "ضمن مسار اليوم",
  refreshLocation: "تحديث الموقع",
  storeName: "اسم المتجر",
  storePhone: "هاتف المتجر",
  ownerName: "اسم صاحب المتجر",
  location: "الموقع",
  locationReadonly: "يُحدَّد تلقائياً من GPS ولا يمكن تعديله",
  address: "العنوان (اختياري)",
  storePhoto: "صورة المتجر",
  pickPhoto: "اختر صورة",
  takePhoto: "التقاط صورة",
  photoChoiceTitle: "صورة المتجر",
  cancel: "إلغاء",
  saveStore: "حفظ العميل المحتمل",
  locating: "جاري تحديد موقعك…",
  locationDenied: "يلزم تفعيل الموقع",
  locationInaccurate: (m: number) =>
    `دقة GPS ضعيفة (±${Math.round(m)} م). قف عند مدخل المتجر في مكان مفتوح ثم اضغط «تحديث الموقع».`,
  gpsAccuracy: (m: number) => `دقة GPS: ±${Math.round(m)} م`,
  photosPermission: "يلزم إذن الوصول إلى الصور",
  cameraDenied: "يلزم إذن الكاميرا",
  uploadFailed: "فشل رفع الصورة",
  registerFailed: "فشل الحفظ",
  storeCreated: "تم حفظ العميل المحتمل.",
  notRegisterReason: "سبب عدم التسجيل",
  notRegisterReasonHint: "لماذا لم يُربَط المتجر برمز QR اليوم؟",
  notRegisterReasonRequired: "يرجى اختيار أو كتابة سبب عدم التسجيل (حرفان على الأقل)",
  customReasonPlaceholder: "اكتب سبب عدم التسجيل…",
  mapLoadFailed: "تعذّر تحميل خريطة المناطق",
  mapFallback: "معاينة الخريطة غير متاحة على هذا الجهاز — الموقع يُحدَّد من GPS.",
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
  headers: Record<string, string>;
  apiBase: string;
  authToken: string;
  onNotice: (msg: string) => void;
  onDone: (msg: string, success?: boolean) => void;
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

export default function ProspectStoreForm(props: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [areaId, setAreaId] = useState<number | undefined>();
  const [areaName, setAreaName] = useState("");
  const [areaAssignedToRep, setAreaAssignedToRep] = useState(true);
  const [areaResolved, setAreaResolved] = useState(false);
  const [jordanAreas, setJordanAreas] = useState<VoronoiMapCell[]>([]);
  const [locating, setLocating] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [visitReason, setVisitReason] = useState<string | null>(null);

  const mapAreas = jordanAreas;

  const mapRegion = useMemo((): MapRegion => {
    if (lat != null && lng != null) {
      return { latitude: lat, longitude: lng, latitudeDelta: 0.12, longitudeDelta: 0.12 };
    }
    return JORDAN_REGION;
  }, [lat, lng]);

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

  const refreshLocation = useCallback(async () => {
    setLocating(true);
    try {
      const pos = await getRepPosition({ timeoutMs: 20_000 });
      setLat(pos.lat);
      setLng(pos.lng);
      setGpsAccuracy(pos.accuracyM);
      const resolved = await resolveRepArea(props.apiBase, props.headers, pos.lat, pos.lng);
      setAreaId(resolved.areaId);
      setAreaName(resolved.areaName);
      setAreaAssignedToRep(resolved.assignedToRep);
      setAreaResolved(true);
      void loadJordanAreas(pos.lat, pos.lng).catch((e) => {
        props.onNotice(e instanceof Error ? e.message : labels.mapLoadFailed);
      });
    } catch (e) {
      setAreaResolved(false);
      setAreaId(undefined);
      if (e instanceof LocationDeniedError) props.onNotice(labels.locationDenied);
      else if (e instanceof LocationTimeoutError) props.onNotice(labels.locating);
      else if (e instanceof LocationInaccurateError) props.onNotice(labels.locationInaccurate(e.accuracyM));
      else props.onNotice(e instanceof Error ? e.message : labels.locating);
    } finally {
      setLocating(false);
    }
  }, [props.apiBase, props.headers, props.onNotice, loadJordanAreas]);

  useEffect(() => {
    void refreshLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

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
    if (!isValidProspectReason(visitReason)) {
      props.onNotice(labels.notRegisterReasonRequired);
      return;
    }
    setBusy(true);
    try {
      const pos = await getRepPosition({ timeoutMs: 20_000 });
      const res = await fetch(`${props.apiBase}/api/v1/rep/prospect-stores`, {
        method: "POST",
        headers: props.headers,
        body: JSON.stringify({
          name,
          phone,
          ownerName,
          locationLat: pos.lat,
          locationLng: pos.lng,
          addressText: address || undefined,
          imageUrl: imagePath ?? undefined,
          visitNote: visitReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? labels.registerFailed);
      props.onDone(labels.storeCreated, true);
    } catch (e) {
      if (e instanceof LocationDeniedError) props.onDone(labels.locationDenied, false);
      else if (e instanceof LocationTimeoutError) props.onDone(labels.locating, false);
      else if (e instanceof LocationInaccurateError) props.onDone(labels.locationInaccurate(e.accuracyM), false);
      else props.onDone(e instanceof Error ? e.message : labels.registerFailed, false);
    } finally {
      setBusy(false);
    }
  }

  const previewUri = imagePath ? productImageUrl(imagePath) : undefined;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{labels.title}</Text>
      <Text style={styles.subtitle}>{labels.subtitle}</Text>

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
      {!locating && areaResolved ? (
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
              mapAreas={jordanAreas}
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
            mapAreas={jordanAreas}
            areaId={areaId}
            labels={{
              mapFallback: labels.mapFallback,
              openInMaps: labels.openInMaps,
              storeLocation: labels.storeLocation,
            }}
          />
        )}
      </View>

      <Pressable style={styles.secondary} onPress={() => void refreshLocation()}>
        <Text style={styles.secondaryText}>{labels.refreshLocation}</Text>
      </Pressable>

      {lat != null && lng != null ? (
        <View style={styles.coordsBox}>
          <Text style={styles.label}>{labels.location}</Text>
          <Text style={styles.coordsValue}>
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </Text>
          {gpsAccuracy != null ? (
            <Text style={styles.accuracyHint}>{labels.gpsAccuracy(gpsAccuracy)}</Text>
          ) : null}
          <Text style={styles.muted}>{labels.locationReadonly}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>{labels.storeName}</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} textAlign="right" />

      <Text style={styles.label}>{labels.storePhone}</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        textAlign="right"
      />

      <Text style={styles.label}>{labels.ownerName}</Text>
      <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} textAlign="right" />

      <Text style={styles.label}>{labels.address}</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} textAlign="right" />

      <Text style={styles.label}>{labels.storePhoto}</Text>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
      ) : null}
      <Pressable style={styles.secondary} onPress={choosePhoto} disabled={uploadBusy}>
        {uploadBusy ? (
          <ActivityIndicator color={theme.text} />
        ) : (
          <Text style={styles.secondaryText}>{labels.pickPhoto} / {labels.takePhoto}</Text>
        )}
      </Pressable>

      <NotRegisterReasonPicker
        label={labels.notRegisterReason}
        hint={labels.notRegisterReasonHint}
        customPlaceholder={labels.customReasonPlaceholder}
        value={visitReason}
        onChange={setVisitReason}
        disabled={busy}
      />

      <View style={styles.actions}>
        <Pressable style={styles.secondaryBtn} onPress={() => props.onDone(labels.cancel, false)}>
          <Text style={styles.secondaryText}>{labels.cancel}</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={() => void submit()} disabled={busy || locating || !areaResolved || !isValidProspectReason(visitReason)}>
          {busy ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={styles.primaryText}>{labels.saveStore}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.xl,
    padding: 18,
    marginTop: 12,
    ...theme.shadow.card,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
    textAlign: "right",
  },
  subtitle: {
    color: theme.muted,
    fontSize: 13,
    marginBottom: 8,
    textAlign: "right",
    lineHeight: 20,
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
    textAlign: "right",
  },
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
    lineHeight: 20,
    fontWeight: "600",
  },
  mapWrap: {
    marginTop: 12,
    height: 220,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.line,
  },
  mapLoading: { flex: 1, justifyContent: "center", alignItems: "center", minHeight: 220 },
  coordsBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: theme.line,
  },
  coordsValue: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  accuracyHint: {
    color: "#16a34a",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "right",
  },
  preview: {
    width: "100%",
    height: 160,
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
  actions: { flexDirection: "row-reverse", gap: 12, marginTop: 22 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderColor: theme.line,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryBtn: {
    flex: 1.2,
    backgroundColor: theme.accent,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.accent2,
  },
  primaryText: { color: theme.onAccent, fontWeight: "800", fontSize: 16 },
});
