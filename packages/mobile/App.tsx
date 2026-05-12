import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

const t = {
  appTitle: "برقان — المندوب",
  loginSub: "للاختبار على الهاتف ضع EXPO_PUBLIC_API_URL على عنوان جهازك (IP) وليس localhost.",
  email: "البريد",
  password: "كلمة المرور",
  signIn: "دخول",
  signOut: "خروج",
  scanTitle: "مسح أو إدخال رمز البطاقة",
  openScanner: "فتح الكاميرا للمسح",
  manualLabel: "رمز يدوي (من البطاقة المطبوعة)",
  lookup: "بحث عن الرمز",
  resume: "متابعة:",
  resumeHint: "اضغط لفتح مساحة المتجر",
  close: "إغلاق",
  registerStore: "تسجيل متجر جديد",
  tokenPreview: "الرمز:",
  area: "المنطقة",
  storeName: "اسم المتجر",
  storePhone: "هاتف المتجر",
  ownerName: "اسم صاحب المتجر",
  latLng: "خط العرض / الطول",
  address: "العنوان (اختياري)",
  storePhoto: "صورة المتجر (اختياري)",
  pickPhoto: "اختر صورة من المعرض",
  uploading: "جاري الرفع…",
  cancel: "إلغاء",
  saveStore: "حفظ المتجر",
  back: "رجوع",
  deferred: "البيع الآجل:",
  deferredOn: "مسموح",
  deferredOff: "غير مسموح",
  owner: "الصاحب:",
  tabInfo: "معلومات",
  tabVisits: "زيارات",
  tabOrders: "طلبات",
  tabSell: "بيع",
  phone: "الهاتف:",
  location: "الموقع:",
  ownerLink: "رابط صاحب المتجر:",
  visitNote: "ملاحظة الزيارة (اختياري)",
  visitPlaceholder: "مثال: توريد رفوف",
  recordVisit: "تسجيل زيارة",
  noVisits: "لا زيارات بعد.",
  noOrders: "لا طلبات بعد.",
  sellHint: "اضغط + / − لبناء السلة. الأسعار من الكتالوج.",
  payment: "الدفع",
  cash: "نقدي",
  deferredPay: "آجل",
  submitOrder: "إرسال الطلب",
  visitRecorded: "تم تسجيل الزيارة.",
  visitFailed: "تعذّر تسجيل الزيارة.",
  orderSaved: "تم حفظ الطلب.",
  orderFailed: "تعذّر إرسال الطلب.",
  addToCart: "أضف منتجات إلى السلة.",
  photosPermission: "يلزم إذن الوصول إلى الصور.",
  cameraDenied: "يلزم إذن الكاميرا.",
  loginFailed: "فشل الدخول",
  qrFailed: "فشل البحث عن الرمز",
  uploadFailed: "فشل رفع الصورة",
  registerFailed: "فشل التسجيل",
  cancelled: "أُلغي",
  storeCreated: (id: number) => `تم إنشاء المتجر #${id}.`,
  currency: "ر.س",
} as const;

type Area = { id: number; name: string };
type StoreBrief = {
  id: number;
  name: string;
  phone: string;
  ownerName: string;
  location: { lat: number; lng: number };
  deferredPaymentEnabled: boolean;
  ownerPortalUrl?: string;
};
type Product = {
  id: number;
  name: string;
  price: string;
  designation?: string | null;
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
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : t.uploadFailed);
  return data.path as string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [mode, setMode] = useState<"home" | "scan" | "register" | "store">("home");
  const [permission, requestPermission] = useCameraPermissions();
  const [lastScanToken, setLastScanToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [activeStore, setActiveStore] = useState<StoreBrief | null>(null);
  const [storeTab, setStoreTab] = useState<"info" | "visits" | "orders" | "sell">("info");
  const [visits, setVisits] = useState<{ id: string; visited_at: string; note: string | null }[]>([]);
  const [orders, setOrders] = useState<unknown[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [paymentType, setPaymentType] = useState<"cash" | "deferred">("cash");
  const [visitNote, setVisitNote] = useState("");

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const apiGet = useCallback(
    async (path: string) => {
      const res = await fetch(`${API_BASE}${path}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      return data;
    },
    [headers]
  );

  const apiPost = useCallback(
    async (path: string, body: unknown) => {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      return data;
    },
    [headers]
  );

  async function login() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/rep/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.loginFailed);
      setToken(data.token);
      const a = await fetch(`${API_BASE}/api/v1/rep/areas`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      const aj = await a.json();
      if (a.ok) setAreas(aj.areas ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  async function resolveQr(raw: string) {
    if (!token) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await apiGet(`/api/v1/rep/qr/${encodeURIComponent(trimmed)}`);
      setLastScanToken(trimmed);
      if (data.status === "unassigned") {
        setActiveStore(null);
        setMode("register");
      } else {
        setActiveStore(data.store as StoreBrief);
        setMode("store");
        setStoreTab("info");
        await refreshStoreData(data.store.id);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.qrFailed);
    } finally {
      setBusy(false);
    }
  }

  async function refreshStoreData(storeId: number) {
    try {
      const [v, o, p] = await Promise.all([
        apiGet(`/api/v1/rep/stores/${storeId}/visits`),
        apiGet(`/api/v1/rep/stores/${storeId}/orders`),
        apiGet("/api/v1/rep/products"),
      ]);
      setVisits(v.visits ?? []);
      setOrders(o.orders ?? []);
      setProducts(p.products ?? []);
    } catch {
      /* ignore */
    }
  }

  async function logVisit() {
    if (!activeStore) return;
    setBusy(true);
    try {
      await apiPost("/api/v1/rep/visits", { storeId: activeStore.id, note: visitNote || undefined });
      setVisitNote("");
      setMessage(t.visitRecorded);
      await refreshStoreData(activeStore.id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.visitFailed);
    } finally {
      setBusy(false);
    }
  }

  async function submitOrder() {
    if (!activeStore) return;
    const lines = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId: parseInt(productId, 10), quantity }));
    if (!lines.length) {
      setMessage(t.addToCart);
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/v1/rep/orders", {
        storeId: activeStore.id,
        paymentType,
        lines,
      });
      setCart({});
      setMessage(t.orderSaved);
      await refreshStoreData(activeStore.id);
      setStoreTab("orders");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.orderFailed);
    } finally {
      setBusy(false);
    }
  }

  function setQty(pid: number, delta: number) {
    setCart((c) => {
      const q = (c[pid] ?? 0) + delta;
      const next = { ...c };
      if (q <= 0) delete next[pid];
      else next[pid] = q;
      return next;
    });
  }

  const tabLabels: Record<typeof storeTab, string> = {
    info: t.tabInfo,
    visits: t.tabVisits,
    orders: t.tabOrders,
    sell: t.tabSell,
  };

  if (!token) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <Text style={styles.title}>{t.appTitle}</Text>
        <Text style={styles.sub}>{t.loginSub}</Text>
        <TextInput style={styles.input} autoCapitalize="none" value={email} onChangeText={setEmail} placeholder={t.email} />
        <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder={t.password} />
        <Pressable style={styles.primary} onPress={login} disabled={busy}>
          {busy ? <ActivityIndicator color="#04121a" /> : <Text style={styles.primaryText}>{t.signIn}</Text>}
        </Pressable>
        {message && <Text style={styles.error}>{message}</Text>}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>{t.appTitle}</Text>
        <Pressable
          onPress={() => {
            setToken(null);
            setActiveStore(null);
            setMode("home");
            setMessage(null);
          }}
        >
          <Text style={styles.link}>{t.signOut}</Text>
        </Pressable>
      </View>

      {mode === "home" && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.scanTitle}</Text>
            <Pressable
              style={styles.secondary}
              onPress={async () => {
                if (!permission?.granted) {
                  const r = await requestPermission();
                  if (!r.granted) {
                    setMessage(t.cameraDenied);
                    return;
                  }
                }
                setMode("scan");
              }}
            >
              <Text style={styles.secondaryText}>{t.openScanner}</Text>
            </Pressable>
            <Text style={styles.label}>{t.manualLabel}</Text>
            <TextInput style={styles.input} value={manualToken} onChangeText={setManualToken} autoCapitalize="none" />
            <Pressable style={styles.primary} onPress={() => void resolveQr(manualToken)}>
              <Text style={styles.primaryText}>{t.lookup}</Text>
            </Pressable>
          </View>

          {activeStore && mode === "home" && (
            <Pressable style={styles.card} onPress={() => setMode("store")}>
              <Text style={styles.cardTitle}>
                {t.resume} {activeStore.name}
              </Text>
              <Text style={styles.muted}>{t.resumeHint}</Text>
            </Pressable>
          )}
        </>
      )}

      {mode === "scan" && permission?.granted && (
        <View style={styles.scanner}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              void resolveQr(data);
            }}
          />
          <Pressable style={styles.closeScan} onPress={() => setMode("home")}>
            <Text style={styles.closeScanText}>{t.close}</Text>
          </Pressable>
        </View>
      )}

      {mode === "register" && lastScanToken && token && (
        <RegisterForm
          areas={areas}
          qrPublicToken={lastScanToken}
          headers={headers}
          apiBase={API_BASE}
          authToken={token}
          onNotice={(msg) => setMessage(msg)}
          onDone={async (msg, store) => {
            setMessage(msg);
            if (store) {
              setActiveStore(store);
              setMode("store");
              setStoreTab("info");
              await refreshStoreData(store.id);
            } else {
              setMode("home");
              setLastScanToken(null);
            }
          }}
        />
      )}

      {mode === "store" && activeStore && (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{activeStore.name}</Text>
            <Pressable onPress={() => setMode("home")}>
              <Text style={styles.link}>{t.back}</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>
            {t.deferred} {activeStore.deferredPaymentEnabled ? t.deferredOn : t.deferredOff} · {t.owner} {activeStore.ownerName}
          </Text>
          <View style={styles.tabs}>
            {(["info", "visits", "orders", "sell"] as const).map((tab) => (
              <Pressable key={tab} style={[styles.tab, storeTab === tab && styles.tabOn]} onPress={() => setStoreTab(tab)}>
                <Text style={[styles.tabText, storeTab === tab && styles.tabTextOn]}>{tabLabels[tab]}</Text>
              </Pressable>
            ))}
          </View>

          {storeTab === "info" && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.body}>
                {t.phone} {activeStore.phone}
              </Text>
              <Text style={styles.body}>
                {t.location} {activeStore.location.lat.toFixed(4)}, {activeStore.location.lng.toFixed(4)}
              </Text>
              {activeStore.ownerPortalUrl ? (
                <Text style={styles.muted} selectable>
                  {t.ownerLink} {activeStore.ownerPortalUrl}
                </Text>
              ) : null}
              <Text style={styles.label}>{t.visitNote}</Text>
              <TextInput style={styles.input} value={visitNote} onChangeText={setVisitNote} placeholder={t.visitPlaceholder} />
              <Pressable style={styles.secondary} onPress={() => void logVisit()}>
                <Text style={styles.secondaryText}>{t.recordVisit}</Text>
              </Pressable>
            </View>
          )}

          {storeTab === "visits" && (
            <FlatList
              data={visits}
              keyExtractor={(item) => String(item.id)}
              style={{ marginTop: 12, maxHeight: 320 }}
              ListEmptyComponent={<Text style={styles.muted}>{t.noVisits}</Text>}
              renderItem={({ item }) => (
                <View style={styles.listRow}>
                  <Text style={styles.body}>{new Date(item.visited_at).toLocaleString("ar-SA")}</Text>
                  {item.note ? <Text style={styles.muted}>{item.note}</Text> : null}
                </View>
              )}
            />
          )}

          {storeTab === "orders" && (
            <FlatList
              data={orders as { id: string; payment_type: string; total_amount: string; created_at: string }[]}
              keyExtractor={(item) => String(item.id)}
              style={{ marginTop: 12, maxHeight: 360 }}
              ListEmptyComponent={<Text style={styles.muted}>{t.noOrders}</Text>}
              renderItem={({ item }) => (
                <View style={styles.listRow}>
                  <Text style={styles.body}>
                    #{item.id} · {item.payment_type} · {item.total_amount}
                  </Text>
                  <Text style={styles.muted}>{new Date(item.created_at).toLocaleString("ar-SA")}</Text>
                </View>
              )}
            />
          )}

          {storeTab === "sell" && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.muted}>{t.sellHint}</Text>
              <FlatList
                data={products}
                keyExtractor={(item) => String(item.id)}
                style={{ maxHeight: 280 }}
                renderItem={({ item }) => {
                  const q = cart[item.id] ?? 0;
                  return (
                    <View style={styles.productRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.body}>{item.name}</Text>
                        <Text style={styles.muted}>
                          {item.price} {t.currency}
                        </Text>
                      </View>
                      <View style={styles.qtyRow}>
                        <Pressable style={styles.qtyBtn} onPress={() => setQty(item.id, -1)}>
                          <Text style={styles.qtyBtnText}>−</Text>
                        </Pressable>
                        <Text style={styles.qtyNum}>{q}</Text>
                        <Pressable style={styles.qtyBtn} onPress={() => setQty(item.id, 1)}>
                          <Text style={styles.qtyBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }}
              />
              <Text style={styles.label}>{t.payment}</Text>
              <View style={styles.rowBetween}>
                <Pressable style={[styles.secondary, paymentType === "cash" && styles.tabOn]} onPress={() => setPaymentType("cash")}>
                  <Text style={styles.secondaryText}>{t.cash}</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondary, paymentType === "deferred" && styles.tabOn]}
                  onPress={() => setPaymentType("deferred")}
                >
                  <Text style={styles.secondaryText}>{t.deferredPay}</Text>
                </Pressable>
              </View>
              <Pressable style={styles.primary} onPress={() => void submitOrder()}>
                <Text style={styles.primaryText}>{t.submitOrder}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {busy && (
        <View style={styles.busy}>
          <ActivityIndicator />
        </View>
      )}
      {message && mode !== "scan" && <Text style={styles.error}>{message}</Text>}
    </ScrollView>
  );
}

function RegisterForm(props: {
  areas: Area[];
  qrPublicToken: string;
  headers: Record<string, string>;
  apiBase: string;
  authToken: string;
  onNotice: (msg: string) => void;
  onDone: (msg: string, store?: StoreBrief) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [lat, setLat] = useState("24.7136");
  const [lng, setLng] = useState("46.6753");
  const [address, setAddress] = useState("");
  const [areaId, setAreaId] = useState(props.areas[0]?.id);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);

  async function pickAndUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      props.onNotice(t.photosPermission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadBusy(true);
    try {
      const path = await uploadRepImage(props.apiBase, props.authToken, asset.uri, asset.mimeType ?? "image/jpeg");
      setImagePath(path);
    } catch (e) {
      props.onNotice(e instanceof Error ? e.message : t.uploadFailed);
    } finally {
      setUploadBusy(false);
    }
  }

  async function submit() {
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
          locationLat: parseFloat(lat),
          locationLng: parseFloat(lng),
          addressText: address || undefined,
          areaId: areaId ?? props.areas[0]?.id,
          imageUrl: imagePath ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.registerFailed);
      props.onDone(t.storeCreated(data.store?.id ?? 0), data.store as StoreBrief);
    } catch (e) {
      props.onDone(e instanceof Error ? e.message : t.registerFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t.registerStore}</Text>
      <Text style={styles.muted}>
        {t.tokenPreview} {props.qrPublicToken.slice(0, 20)}…
      </Text>
      <Text style={styles.label}>{t.area}</Text>
      <View style={styles.chipRow}>
        {props.areas.map((a) => (
          <Pressable key={a.id} style={[styles.chip, areaId === a.id && styles.chipOn]} onPress={() => setAreaId(a.id)}>
            <Text style={styles.chipText}>{a.name}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t.storeName}</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <Text style={styles.label}>{t.storePhone}</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Text style={styles.label}>{t.ownerName}</Text>
      <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} />
      <Text style={styles.label}>{t.latLng}</Text>
      <View style={styles.rowBetween}>
        <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} value={lat} onChangeText={setLat} keyboardType="decimal-pad" />
        <TextInput style={[styles.input, { flex: 1 }]} value={lng} onChangeText={setLng} keyboardType="decimal-pad" />
      </View>
      <Text style={styles.label}>{t.address}</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} />
      <Text style={styles.label}>{t.storePhoto}</Text>
      <Pressable style={styles.secondary} onPress={() => void pickAndUpload()} disabled={uploadBusy}>
        {uploadBusy ? <ActivityIndicator color={text} /> : <Text style={styles.secondaryText}>{t.pickPhoto}</Text>}
      </Pressable>
      {imagePath ? <Text style={styles.muted}>{imagePath}</Text> : null}
      <View style={styles.rowBetween}>
        <Pressable style={styles.secondary} onPress={() => props.onDone(t.cancelled)}>
          <Text style={styles.secondaryText}>{t.cancel}</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#04121a" /> : <Text style={styles.primaryText}>{t.saveStore}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const bg = "#0b1220";
const card = "#121a2b";
const line = "#22304d";
const text = "#e8eefc";
const muted = "#9fb0d0";
const accent = "#5eead4";

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: bg, padding: 22, justifyContent: "center" },
  page: { padding: 16, paddingBottom: 48, backgroundColor: bg, flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { color: text, fontSize: 26, fontWeight: "700" },
  sub: { color: muted, marginTop: 8, marginBottom: 12 },
  card: {
    backgroundColor: card,
    borderColor: line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  cardTitle: { color: text, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: text,
    marginTop: 6,
    backgroundColor: "#0b1020",
    textAlign: "right",
    writingDirection: "rtl",
  },
  label: { color: muted, marginTop: 10, fontSize: 12, textAlign: "right" },
  body: { color: text, marginTop: 4, textAlign: "right" },
  primary: {
    marginTop: 14,
    backgroundColor: accent,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryText: { color: "#04121a", fontWeight: "800" },
  secondary: {
    marginTop: 10,
    borderColor: line,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  secondaryText: { color: text, fontWeight: "700" },
  error: { color: "#fb7185", marginTop: 10, textAlign: "right" },
  muted: { color: muted, marginTop: 8, fontSize: 13, textAlign: "right" },
  link: { color: accent, fontWeight: "700" },
  scanner: { height: 400, borderRadius: 16, overflow: "hidden", marginTop: 12, borderColor: line, borderWidth: 1 },
  closeScan: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  closeScanText: { color: "white", fontWeight: "800" },
  busy: { padding: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: line },
  tabOn: { borderColor: accent, backgroundColor: "rgba(94,234,212,0.12)" },
  tabText: { color: muted, fontWeight: "600" },
  tabTextOn: { color: accent },
  listRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: line },
  productRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: line },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#0b1020",
    borderWidth: 1,
    borderColor: line,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { color: text, fontSize: 20, fontWeight: "700" },
  qtyNum: { color: text, fontWeight: "800", minWidth: 24, textAlign: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: line },
  chipOn: { borderColor: accent, backgroundColor: "rgba(94,234,212,0.15)" },
  chipText: { color: text, fontWeight: "600" },
});
