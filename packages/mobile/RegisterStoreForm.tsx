import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import MapView, { Circle, Marker, type Region } from "react-native-maps";

import { getRepPosition, LocationDeniedError } from "./getDeviceLocation";
import { productImageUrl } from "./productImage";
import { theme } from "./theme";
import type { StoreBrief } from "./storeTypes";

type JordanArea = {
  id: number;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

const labels = {
  title: "تسجيل متجر جديد",
  areaAuto: "المنطقة (تلقائي من موقعك)",
  areaDetecting: "جاري تحديد المنطقة…",
  areaOutsideRep: "خارج مناطقك — يُسجَّل هنا ويظهر لمندوبي هذه المنطقة",
  areaInRep: "ضمن مناطقك",
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
  saveStore: "حفظ المتجر",
  locating: "جاري تحديد موقعك…",
  locationDenied: "يلزم تفعيل الموقع",
  photosPermission: "يلزم إذن الوصول إلى الصور",
  cameraDenied: "يلزم إذن الكاميرا",
  uploadFailed: "فشل رفع الصورة",
  registerFailed: "فشل التسجيل",
  storeCreated: (id: number) => `تم إنشاء المتجر #${id}.`,
  mapLoadFailed: "تعذّر تحميل خريطة المناطق",
};

const JORDAN_REGION: Region = {
  latitude: 31.25,
  longitude: 36.5,
  latitudeDelta: 4.8,
  longitudeDelta: 4.2,
};

type Props = {
  qrPublicToken: string;
  headers: Record<string, string>;
  apiBase: string;
  authToken: string;
  onNotice: (msg: string) => void;
  onDone: (msg: string, store?: StoreBrief) => void;
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

export default function RegisterStoreForm(props: Props) {
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
  const [jordanAreas, setJordanAreas] = useState<JordanArea[]>([]);
  const [locating, setLocating] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);

  const mapAreas = useMemo(() => {
    if (lat == null || lng == null) return jordanAreas;
    const maxM = 18_000;
    return jordanAreas.filter((a) => {
      const R = 6371000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(a.centerLat - lat);
      const dLng = toRad(a.centerLng - lng);
      const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat)) * Math.cos(toRad(a.centerLat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(x)) <= maxM;
    });
  }, [jordanAreas, lat, lng]);

  const mapRegion = useMemo((): Region => {
    if (lat != null && lng != null) {
      return {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      };
    }
    return JORDAN_REGION;
  }, [lat, lng]);

  const loadJordanAreas = useCallback(async () => {
    const res = await fetch(`${props.apiBase}/api/v1/rep/areas/jordan`, { headers: props.headers });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : labels.mapLoadFailed);
    setJordanAreas(data.areas ?? []);
  }, [props.apiBase, props.headers]);

  const refreshLocation = useCallback(async () => {
    setLocating(true);
    try {
      const pos = await getRepPosition();
      setLat(pos.lat);
      setLng(pos.lng);
      const res = await fetch(
        `${props.apiBase}/api/v1/rep/areas/resolve?lat=${pos.lat}&lng=${pos.lng}&forRegister=1`,
        { headers: props.headers }
      );
      const data = await res.json();
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
        props.onNotice(typeof data.error === "string" ? data.error : labels.areaDetecting);
      }
    } catch (e) {
      setAreaResolved(false);
      setAreaId(undefined);
      if (e instanceof LocationDeniedError) props.onNotice(labels.locationDenied);
      else props.onNotice(e instanceof Error ? e.message : labels.locating);
    } finally {
      setLocating(false);
    }
  }, [props.apiBase, props.headers, props.onNotice]);

  useEffect(() => {
    (async () => {
      try {
        await loadJordanAreas();
        await refreshLocation();
      } catch (e) {
        props.onNotice(e instanceof Error ? e.message : labels.mapLoadFailed);
        setLocating(false);
      }
    })();
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
    if (!areaId || lat == null || lng == null || !areaResolved) {
      props.onNotice(labels.locating);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${props.apiBase}/api/v1/rep/stores/register`, {
        method: "POST",
        headers: props.headers,
        body: JSON.stringify({
          qrPublicToken: props.qrPublicToken,
          name,
          phone,
          ownerName,
          locationLat: lat,
          locationLng: lng,
          addressText: address || undefined,
          areaId,
          imageUrl: imagePath ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? labels.registerFailed);
      const hint =
        data.assignedToRep === false && typeof data.areaName === "string"
          ? `${labels.storeCreated(data.store?.id ?? 0)} — ${labels.areaOutsideRep} (${data.areaName})`
          : labels.storeCreated(data.store?.id ?? 0);
      props.onDone(hint, data.store as StoreBrief);
    } catch (e) {
      props.onDone(e instanceof Error ? e.message : labels.registerFailed);
    } finally {
      setBusy(false);
    }
  }

  const previewUri = imagePath ? productImageUrl(imagePath) : undefined;

  return (
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
      {!locating && areaResolved ? (
        <Text style={areaAssignedToRep ? styles.areaHintOk : styles.areaHintInfo}>
          {areaAssignedToRep ? labels.areaInRep : labels.areaOutsideRep}
        </Text>
      ) : null}

      <View style={styles.mapWrap}>
        <MapView
          key={lat != null && lng != null ? `${lat.toFixed(5)}-${lng.toFixed(5)}` : "jordan"}
          style={styles.map}
          initialRegion={mapRegion}
          showsUserLocation
          showsMyLocationButton
        >
          {mapAreas.map((a) => (
            <Circle
              key={a.id}
              center={{ latitude: a.centerLat, longitude: a.centerLng }}
              radius={a.radiusKm * 1000}
              fillColor={a.id === areaId ? "rgba(37, 99, 235, 0.2)" : "rgba(34, 211, 238, 0.08)"}
              strokeColor={a.id === areaId ? theme.accent : "rgba(34, 211, 238, 0.45)"}
              strokeWidth={a.id === areaId ? 2 : 1}
            />
          ))}
          {lat != null && lng != null ? (
            <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor={theme.accent} title="موقع المتجر" />
          ) : null}
        </MapView>
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

      <View style={styles.actions}>
        <Pressable style={styles.secondaryBtn} onPress={() => props.onDone(labels.cancel)}>
          <Text style={styles.secondaryText}>{labels.cancel}</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={() => void submit()} disabled={busy || locating || !areaResolved}>
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
    textAlign: "right",
  },
  body: { color: theme.text, marginTop: 4, textAlign: "right" },
  muted: { color: theme.muted, fontSize: 13, textAlign: "right", marginTop: 4 },
  warn: { color: theme.danger, fontSize: 13, marginTop: 6, textAlign: "right", fontWeight: "600" },
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
  map: { width: "100%", height: "100%" },
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
