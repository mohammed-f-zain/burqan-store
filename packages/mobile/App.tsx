import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ExpoSplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { formatMarketDateTime } from "./formatMarketDateTime";
import { parseQrPublicToken } from "./parseQrToken";
import { getRepPosition, LocationDeniedError } from "./getDeviceLocation";
import { isTabletDevice, tabletContentMaxWidth } from "./deviceLayout";
import { resolveApiBase } from "./resolveApiBase";
import { toArabicUserMessage } from "./arabicMessage";
import ProductDetailModal, { type Product } from "./ProductDetailModal";
import ProductGridCard from "./ProductGridCard";
import { productImageUrl } from "./productImage";
import ProfileScreen, { type RepProfile } from "./ProfileScreen";
/** Lazy: react-native-maps can break Expo Go if loaded at startup. */
const RegisterStoreForm = lazy(() => import("./RegisterStoreForm"));
import { clearRepToken, loadStoredRepToken, saveRepToken } from "./repSession";
import SplashScreen from "./SplashScreen";
import ToastOverlay, { type ToastKind } from "./ToastOverlay";
import { theme } from "./theme";

void ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

const API_BASE = resolveApiBase();

const t = {
  appTitle: "برقان — المندوب",
  networkFailed:
    "تعذّر الاتصال بالخادم. تحقق: 1) تشغيل الـ API على هذا الجهاز (npm run api:dev) والمنفذ 4000. 2) الهاتف والكمبيوتر على نفس الـ Wi‑Fi. 3) جدار ناري macOS يسمح لـ Node بالاتصال الوارد. 4) مع tunnel استخدم EXPO_PUBLIC_API_URL الصحيح مع FORCE_ENV=1.",
  email: "البريد",
  password: "كلمة المرور",
  signIn: "دخول",
  openScanner: "مسح الرمز",
  manualToken: "رمز البطاقة",
  lookup: "تأكيد",
  close: "إغلاق",
  registerStore: "تسجيل متجر جديد",
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
  deferredOn: "آجل",
  deferredOff: "نقدي فقط",
  tabProducts: "المنتجات",
  tabInfo: "معلومات",
  tabVisits: "زيارات",
  tabOrders: "طلبات",
  tabSell: "السلة",
  priceLabel: "السعر",
  unit: "الوحدة",
  description: "الوصف",
  inCart: "في السلة",
  phone: "الهاتف",
  location: "الموقع",
  locationUnknown: "لم يُسجَّل عنوان",
  openInMaps: "فتح على الخريطة",
  visitAutoHint: "تُسجَّل الزيارة تلقائياً عند مسح رمز المتجر.",
  payment: "الدفع",
  cash: "نقدي",
  deferredPay: "آجل",
  submitOrder: "إرسال الطلب",
  visitRecorded: "تم تسجيل الزيارة.",
  orderSaved: "تم حفظ الطلب.",
  orderFailed: "تعذّر إرسال الطلب.",
  addToCart: "أضف منتجات إلى السلة.",
  photosPermission: "يلزم إذن الوصول إلى الصور.",
  cameraDenied: "يلزم إذن الكاميرا.",
  cameraLoading: "جاري تجهيز الكاميرا…",
  cameraPreviewWait: "جاري تشغيل معاينة الكاميرا…",
  cameraMountError: "تعذّر تشغيل الكاميرا:",
  openSettings: "فتح إعدادات التطبيق",
  loginFailed: "فشل الدخول",
  genericError: "حدث خطأ. حاول مرة أخرى.",
  qrFailed: "فشل البحث عن الرمز",
  uploadFailed: "فشل رفع الصورة",
  registerFailed: "فشل التسجيل",
  cancelled: "أُلغي",
  storeCreated: (id: number) => `تم إنشاء المتجر #${id}.`,
  currency: "د.أ",
  locationDenied: "يلزم تفعيل الموقع للمسح وتسجيل المتاجر.",
  locating: "جاري تحديد موقعك…",
  areaAuto: "المنطقة (تلقائي من الخريطة)",
  areaDetecting: "جاري تحديد المنطقة…",
  refreshLocation: "تحديث الموقع",
  navHome: "الرئيسية",
  navInventory: "مخزون",
  navStore: "المنتجات",
  navProfile: "حسابي",
  profileTitle: "الملف الشخصي",
  profilePhone: "الهاتف",
  profileEmail: "البريد",
  profileCar: "لوحة السيارة",
  profileAreas: "مناطق العمل",
  profileInventory: "مخزون السيارة",
  profileSku: "أصناف",
  profileUnits: "وحدات",
  profileSignOut: "تسجيل الخروج",
  profileNoAreas: "لا مناطق مربوطة",
  profileNoCar: "—",
  profileLoadFailed: "تعذّر تحميل الملف الشخصي",
  profileRetry: "إعادة المحاولة",
  profileErrorHint: "تحقق من الاتصال بالخادم أو سجّل الخروج وأعد تسجيل الدخول.",
  sessionExpired: "انتهت الجلسة — سجّل الدخول مرة أخرى",
  welcome: (name: string) => `مرحباً، ${name}`,
  homeSubtitle: "امسح رمز المتجر لبدء الزيارة والبيع",
  dailyStoresTitle: "متاجر مناطقي اليوم",
  dailyStoresHint: "بعد الزيارة يظهر ✓ تمت زيارته — تبقى في القائمة حتى اليوم التالي",
  dailyStoresEmpty: "لا متاجر في مناطقك",
  dailyStoresAllVisited: "تمت زيارة كل المتاجر اليوم — أحسنت!",
  dailyStoresCount: (visited: number, total: number) => `${visited} / ${total} تمت زيارته`,
  dailyStoresVisited: "تمت زيارته",
  dailyStoresUnknownArea: "منطقة غير محددة",
  dailyStoresAreaCount: (n: number) => `${n} متجر`,
  dailyStoresPendingCount: (n: number) => `${n} باقٍ`,
  dailyStoresPending: "باقٍ",
  dailyStoresSearchPlaceholder: "بحث عن متجر أو صاحب…",
  dailyStoresFilterAll: "الكل",
  dailyStoresFilterPending: "باقي زيارات",
  dailyStoresFilterDone: "تمت",
  dailyStoresExpandAll: "فتح الكل",
  dailyStoresCollapseAll: "إغلاق الكل",
  dailyStoresNoSearchResults: "لا نتائج — جرّب بحثاً آخر",
  storeOwner: "صاحب المتجر",
  callStore: "اتصال بالمتجر",
  productsBadge: (n: number) => String(n),
  inventoryTitle: "مخزون السيارة",
  inventoryEmpty: "لا منتجات",
  catalogEmpty: "لا منتجات متاحة",
  catalogStockHint: "الرقم = مخزون السيارة",
  sellEmpty: "لا مخزون",
  emptyVisits: "لا زيارات",
  emptyOrders: "لا طلبات",
  stock: "المتوفر",
  tooFar: "أنت بعيد عن المتجر. اقترب إلى أقل من 100 متر.",
  noImage: "لا صورة",
  visitEndTitle: "إنهاء الزيارة؟",
  visitEndMessage: "هل تريد إغلاق جلسة هذا المتجر والعودة للرئيسية؟",
  visitEndMessageCart: (n: number) => `لديك ${n} منتج في السلة. يمكنك إتمام الطلب أو إنهاء الزيارة.`,
  visitEndStay: "متابعة الزيارة",
  visitEndGoCart: "الذهاب إلى السلة",
  visitEndConfirm: "إنهاء الزيارة",
  visitEndNoteLabel: "ملاحظة الزيارة (اختياري)",
  visitEndNoBuyNoteLabel: "سبب عدم الشراء (مطلوب)",
  visitEndNotePlaceholder: "اكتب ملاحظة عن الزيارة…",
  visitEndNoBuyNotePlaceholder: "لماذا لم يشتِ صاحب المتجر؟ (مثال: لا حاجة، مخزون كافٍ، سعر…)",
  visitEndNoBuyNoteRequired: "يرجى توضيح سبب عدم الشراء قبل إنهاء الزيارة",
  visitEndNoBuyMessage: "لم تُسجَّل أي مشتريات. اذكر سبب عدم الشراء قبل إغلاق الزيارة.",
  visitEndNoteFailed: "تعذّر حفظ ملاحظة الزيارة",
} as const;

function formatPaymentType(type: string): string {
  if (type === "cash") return t.cash;
  if (type === "deferred") return t.deferredPay;
  return type;
}

function mapProductRow(r: {
  id: number;
  name: string;
  price: string;
  quantity?: number;
  designation?: string | null;
  unit_label?: string | null;
  image_url?: string | null;
}): Product {
  return {
    id: r.id,
    name: r.name,
    price: String(r.price),
    designation: r.designation ?? null,
    unit_label: r.unit_label ?? null,
    image_url: r.image_url ?? null,
    quantity: Number(r.quantity) || 0,
  };
}

type Area = { id: number; name: string };
import DailyStoresByArea from "./DailyStoresByArea";
import EndVisitModal from "./EndVisitModal";
import StorePeekModal from "./StorePeekModal";
import type { DailyStoreCard, StoreBrief } from "./storeTypes";
export type { StoreBrief } from "./storeTypes";

type BottomTab = "home" | "inventory" | "store" | "profile";
type RepOrderRow = { id: string; payment_type: string; total_amount: string; created_at: string };

function formatStoreLocation(
  store: Pick<StoreBrief, "addressText" | "areaName">,
  unknownLabel: string
): string {
  const address = store.addressText?.trim();
  if (address) return address;
  const area = store.areaName?.trim();
  if (area) return area;
  return unknownLabel;
}

export default function App() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isTablet = useMemo(() => isTabletDevice(), [winW, winH]);
  const pageMaxWidth = useMemo(
    () => (isTablet ? tabletContentMaxWidth(winW, winH) : undefined),
    [isTablet, winW, winH]
  );
  const pageFrameStyle = useMemo(
    () =>
      pageMaxWidth
        ? { maxWidth: pageMaxWidth, width: "100%" as const, alignSelf: "center" as const }
        : undefined,
    [pageMaxWidth]
  );
  /** Extra space under the Dynamic Island / status bar (larger on iPhone with island). */
  const scanTopMargin = Platform.OS === "ios" ? 36 : 16;
  const scanBottomChrome = Math.max(insets.bottom, 16);
  const scanModalPadding = {
    paddingTop: insets.top + scanTopMargin,
    paddingBottom: scanBottomChrome,
  };
  const embeddedCameraHeight = Math.max(360, winH - (insets.top + scanTopMargin) - scanBottomChrome);

  const [token, setToken] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [repProfile, setRepProfile] = useState<RepProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRefreshing, setProfileRefreshing] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: ToastKind } | null>(null);

  const showToast = useCallback((text: string, kind: ToastKind = "info") => {
    setToast({ text: toArabicUserMessage(text, t.genericError), kind });
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const ms = toast.kind === "error" ? 5500 : 4000;
    const id = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(id);
  }, [toast]);

  const [mode, setMode] = useState<"home" | "scan" | "register" | "store">("home");
  const [permission, requestPermission] = useCameraPermissions();
  /** iOS sometimes lags updating `permission` after the user taps Allow — still show CameraView if request() just succeeded. */
  const [scanPermissionOverride, setScanPermissionOverride] = useState(false);
  const [cameraPreviewReady, setCameraPreviewReady] = useState(false);
  /** Mount native camera after the modal is on-screen so layout/size is non-zero (avoids black preview). */
  const [cameraSessionActive, setCameraSessionActive] = useState(false);
  /** System QR scanner listener — must not be removed when `launchScanner` promise resolves (that can happen as soon as the UI opens). */
  const modernBarcodeSubRef = useRef<{ remove: () => void } | null>(null);

  const canUseCamera = Boolean(permission?.granted || scanPermissionOverride);

  useEffect(() => {
    return () => {
      modernBarcodeSubRef.current?.remove();
      modernBarcodeSubRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mode !== "scan" || !canUseCamera) {
      setCameraSessionActive(false);
      setCameraPreviewReady(false);
      return;
    }
    setCameraPreviewReady(false);
    setCameraSessionActive(false);
    const t = setTimeout(() => setCameraSessionActive(true), 280);
    return () => clearTimeout(t);
  }, [mode, canUseCamera]);
  const [lastScanToken, setLastScanToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [activeStore, setActiveStore] = useState<StoreBrief | null>(null);
  const [storeTab, setStoreTab] = useState<"info" | "visits" | "orders" | "sell">("info");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const productCardWidth = Math.floor((winW - 22 * 2 - 16 - 12) / 2);
  const [visits, setVisits] = useState<{ id: string; visited_at: string; note: string | null }[]>([]);
  const [orders, setOrders] = useState<unknown[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [paymentType, setPaymentType] = useState<"cash" | "deferred">("cash");
  const [homeRefreshing, setHomeRefreshing] = useState(false);
  const [dailyStores, setDailyStores] = useState<DailyStoreCard[]>([]);
  const [dailyStoresLoading, setDailyStoresLoading] = useState(false);
  const [peekStore, setPeekStore] = useState<DailyStoreCard | null>(null);
  const [endVisitOpen, setEndVisitOpen] = useState(false);
  const [endVisitBusy, setEndVisitBusy] = useState(false);
  const [visitHadOrder, setVisitHadOrder] = useState(false);
  const [storeRefreshing, setStoreRefreshing] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>("home");
  const [inventory, setInventory] = useState<Product[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);

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

  const apiPatch = useCallback(
    async (path: string, body: unknown) => {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "PATCH",
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
    hideToast();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18_000);
    try {
      const res = await fetch(`${API_BASE}/api/v1/rep/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.loginFailed);
      await saveRepToken(data.token);
      setToken(data.token);
      const a = await fetch(`${API_BASE}/api/v1/rep/areas`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      const aj = await a.json();
      if (a.ok) setAreas(aj.areas ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const aborted =
        (e instanceof Error && e.name === "AbortError") || msg === "Aborted" || msg.toLowerCase().includes("abort");
      const isNetwork =
        aborted ||
        msg === "Network request failed" ||
        msg === "Network Request Failed" ||
        msg.toLowerCase().includes("network request");
      showToast(isNetwork ? t.networkFailed : toArabicUserMessage(msg, t.loginFailed), "error");
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  const loadInventory = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGet("/api/v1/rep/inventory");
      const rows = (data.inventory ?? []) as Product[];
      setInventory(rows.map(mapProductRow).filter((r) => r.quantity > 0));
    } catch {
      /* ignore */
    }
  }, [apiGet, token]);

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGet("/api/v1/rep/products");
      const rows = (data.products ?? []) as Product[];
      setCatalogProducts(rows.map((r) => mapProductRow(r)));
    } catch {
      setCatalogProducts([]);
    }
  }, [apiGet, token]);

  const catalogDisplay = useMemo(() => {
    const stockById = new Map(inventory.map((p) => [p.id, p.quantity]));
    return catalogProducts.map((p) => ({
      ...p,
      quantity: stockById.get(p.id) ?? 0,
    }));
  }, [catalogProducts, inventory]);

  const repAreaNames = useMemo(
    () => (repProfile?.areas ?? []).map((a) => a.name),
    [repProfile?.areas]
  );

  const loadDailyStores = useCallback(async () => {
    if (!token) return;
    setDailyStoresLoading(true);
    try {
      const data = await apiGet("/api/v1/rep/stores/daily");
      setDailyStores((data.stores ?? []) as DailyStoreCard[]);
    } catch {
      setDailyStores([]);
    } finally {
      setDailyStoresLoading(false);
    }
  }, [apiGet, token]);

  const clearSession = useCallback(() => {
    modernBarcodeSubRef.current?.remove();
    modernBarcodeSubRef.current = null;
    void clearRepToken();
    setToken(null);
    setRepProfile(null);
    setProfileError(null);
    setProfileLoading(false);
    setActiveStore(null);
    setDailyStores([]);
    setPeekStore(null);
    setMode("home");
    setBottomTab("home");
    hideToast();
  }, [hideToast]);

  const signOut = clearSession;

  const loadProfile = useCallback(async () => {
    if (!token) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/rep/me`, { headers });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        showToast(t.sessionExpired, "info");
        clearSession();
        return;
      }
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : t.profileLoadFailed);
      }
      const r = data.representative as Partial<RepProfile> | undefined;
      if (!r?.id) {
        throw new Error(t.profileLoadFailed);
      }
      setRepProfile({
        id: r.id,
        email: r.email ?? "",
        fullName: r.fullName ?? "",
        phone: r.phone ?? "",
        imageUrl: r.imageUrl ?? null,
        carPlate: r.carPlate ?? null,
        areas: Array.isArray(r.areas) ? r.areas : [],
        inventory: {
          skuCount: r.inventory?.skuCount ?? 0,
          totalUnits: r.inventory?.totalUnits ?? 0,
        },
      });
      setProfileError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.profileLoadFailed;
      setProfileError(msg);
      setRepProfile(null);
      showToast(msg, "error");
    } finally {
      setProfileLoading(false);
    }
  }, [headers, token, clearSession, showToast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const minSplashMs = 2400;
      const started = Date.now();
      try {
        const stored = await loadStoredRepToken();
        if (!cancelled && stored) setToken(stored);
      } catch {
        /* ignore — still show login */
      } finally {
        const remaining = minSplashMs - (Date.now() - started);
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
        if (!cancelled) {
          setShowSplash(false);
          await ExpoSplashScreen.hideAsync().catch(() => {});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setRepProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }
    void loadProfile();
    void loadInventory();
    void loadDailyStores();
  }, [token, loadProfile, loadInventory, loadDailyStores]);

  async function resolveQr(raw: string) {
    if (!token) return;
    const publicToken = parseQrPublicToken(raw);
    if (!publicToken) return;
    setBusy(true);
    hideToast();
    try {
      const pos = await getRepPosition();
      const data = await apiGet(
        `/api/v1/rep/qr/${encodeURIComponent(publicToken)}?lat=${pos.lat}&lng=${pos.lng}`
      );
      setLastScanToken(publicToken);
      if (data.status === "unassigned") {
        setActiveStore(null);
        setMode("register");
        setBottomTab("home");
      } else {
        setActiveStore(data.store as StoreBrief);
        setVisitHadOrder(false);
        setMode("store");
        setBottomTab("home");
        setStoreTab("info");
        showToast(t.visitRecorded, "success");
        await Promise.all([refreshStoreData(data.store.id), loadDailyStores()]);
      }
    } catch (e) {
      if (e instanceof LocationDeniedError) showToast(t.locationDenied, "error");
      else showToast(e instanceof Error ? e.message : t.qrFailed, "error");
    } finally {
      setBusy(false);
    }
  }

  /** Uses Apple/Google system QR UI when available (reliable on iPhone); otherwise opens in-app camera modal. */
  async function openQrScanner() {
    hideToast();
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        showToast(t.cameraDenied, "error");
        return;
      }
      setScanPermissionOverride(true);
    } else {
      setScanPermissionOverride(true);
    }

    if (CameraView.isModernBarcodeScannerAvailable) {
      modernBarcodeSubRef.current?.remove();
      modernBarcodeSubRef.current = null;

      const sub = CameraView.onModernBarcodeScanned((ev) => {
        sub.remove();
        if (modernBarcodeSubRef.current === sub) modernBarcodeSubRef.current = null;
        if (CameraView.isModernBarcodeScannerAvailable) {
          void CameraView.dismissScanner().catch(() => {});
        }
        void resolveQr(ev.data);
      });
      modernBarcodeSubRef.current = sub;

      void CameraView.launchScanner({ barcodeTypes: ["qr"] }).catch((e) => {
        if (modernBarcodeSubRef.current === sub) modernBarcodeSubRef.current = null;
        sub.remove();
        showToast(e instanceof Error ? e.message : String(e), "error");
      });
      return;
    }

    setMode("scan");
  }

  const refreshStoreData = useCallback(
    async (storeId: number) => {
      try {
        const [v, o, inv] = await Promise.all([
          apiGet(`/api/v1/rep/stores/${storeId}/visits`),
          apiGet(`/api/v1/rep/stores/${storeId}/orders`),
          apiGet("/api/v1/rep/inventory"),
        ]);
        setVisits(v.visits ?? []);
        setOrders(o.orders ?? []);
        const rows = (inv.inventory ?? []) as Product[];
        const mapped = rows.map(mapProductRow).filter((r) => r.quantity > 0);
        setProducts(mapped);
        setInventory(mapped);
      } catch {
        /* ignore */
      }
    },
    [apiGet]
  );

  const onHomeRefresh = useCallback(async () => {
    if (!token) return;
    setHomeRefreshing(true);
    try {
      const a = await fetch(`${API_BASE}/api/v1/rep/areas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const aj = await a.json();
      if (a.ok) setAreas(aj.areas ?? []);
      await Promise.all([loadInventory(), loadProfile(), loadDailyStores()]);
      if (activeStore) await refreshStoreData(activeStore.id);
    } catch {
      /* ignore */
    } finally {
      setHomeRefreshing(false);
    }
  }, [token, activeStore, refreshStoreData, loadInventory, loadProfile, loadDailyStores]);

  useEffect(() => {
    if (token && bottomTab === "home" && mode !== "store" && mode !== "register") {
      void loadDailyStores();
    }
  }, [token, bottomTab, mode, loadDailyStores]);

  useEffect(() => {
    if (token) void loadInventory();
  }, [token, loadInventory]);

  useEffect(() => {
    if (token && bottomTab === "store") {
      void loadCatalog();
      void loadInventory();
    }
  }, [token, bottomTab, loadCatalog, loadInventory]);

  async function submitOrder() {
    if (!activeStore) return;
    const lines = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId: parseInt(productId, 10), quantity }));
    if (!lines.length) {
      showToast(t.addToCart, "info");
      return;
    }
    setBusy(true);
    try {
      const pos = await getRepPosition();
      await apiPost("/api/v1/rep/orders", {
        storeId: activeStore.id,
        paymentType,
        lines,
        repLat: pos.lat,
        repLng: pos.lng,
      });
      setCart({});
      setVisitHadOrder(true);
      showToast(t.orderSaved, "success");
      await refreshStoreData(activeStore.id);
      setStoreTab("orders");
    } catch (e) {
      if (e instanceof LocationDeniedError) showToast(t.locationDenied, "error");
      else showToast(e instanceof Error ? e.message : t.orderFailed, "error");
    } finally {
      setBusy(false);
    }
  }

  function setQty(pid: number, delta: number) {
    const max = products.find((p) => p.id === pid)?.quantity ?? 0;
    setCart((c) => {
      const q = (c[pid] ?? 0) + delta;
      const next = { ...c };
      if (q <= 0) delete next[pid];
      else next[pid] = Math.min(q, max);
      return next;
    });
  }

  const tabLabels: Record<typeof storeTab, string> = {
    info: t.tabInfo,
    visits: t.tabVisits,
    orders: t.tabOrders,
    sell: t.tabSell,
  };

  const cartItemCount = useMemo(
    () => Object.values(cart).reduce((sum, q) => sum + q, 0),
    [cart]
  );

  const endStoreSession = useCallback(() => {
    setActiveStore(null);
    setCart({});
    setVisitHadOrder(false);
    setMode("home");
    setEndVisitOpen(false);
    void loadDailyStores();
  }, [loadDailyStores]);

  const noPurchaseEndVisit = cartItemCount === 0 && !visitHadOrder;

  const confirmEndVisit = useCallback(
    async (note: string) => {
      if (!activeStore) return;
      const trimmed = note.trim();
      if (noPurchaseEndVisit && !trimmed) {
        showToast(t.visitEndNoBuyNoteRequired, "error");
        return;
      }
      setEndVisitBusy(true);
      try {
        if (trimmed) {
          await apiPatch(`/api/v1/rep/stores/${activeStore.id}/today-visit-note`, { note: trimmed });
        }
        endStoreSession();
      } catch (e) {
        showToast(e instanceof Error ? e.message : t.visitEndNoteFailed, "error");
      } finally {
        setEndVisitBusy(false);
      }
    },
    [activeStore, apiPatch, endStoreSession, noPurchaseEndVisit, showToast]
  );

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([pid, q]) => {
        const p = products.find((x) => x.id === parseInt(pid, 10));
        return p ? { product: p, qty: q } : null;
      })
      .filter((x): x is { product: Product; qty: number } => x != null);
  }, [cart, products]);

  const productDetailLabels = useMemo(
    () => ({
      close: t.close,
      priceLabel: t.priceLabel,
      unit: t.unit,
      stock: t.stock,
      description: t.description,
      noImage: t.noImage,
      currency: t.currency,
      inCart: t.inCart,
    }),
    []
  );

  if (showSplash) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bgSplash }}>
        <StatusBar style="dark" />
        <SplashScreen />
      </View>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top", "bottom", "left", "right"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.center, pageFrameStyle]}>
            <StatusBar style="dark" />
            <Image source={require("./assets/burqanlogo.png")} style={styles.logo} resizeMode="contain" />
            <View style={styles.loginCard}>
            <TextInput style={styles.input} autoCapitalize="none" value={email} onChangeText={setEmail} placeholder={t.email} placeholderTextColor={muted} />
            <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder={t.password} placeholderTextColor={muted} />
            <Pressable style={[styles.primary, styles.primaryLg]} onPress={() => void login()} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.signIn}</Text>}
            </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
        {toast ? <ToastOverlay text={toast.text} kind={toast.kind} onDismiss={hideToast} /> : null}
      </SafeAreaView>
    );
  }

  const profileAvatarUri = productImageUrl(repProfile?.imageUrl);
  const profileInitials = repProfile?.fullName
    ? repProfile.fullName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("") || "?"
    : "?";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar style="dark" />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.page, pageFrameStyle, { paddingBottom: insets.bottom + 88 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            mode === "home" ? (
              <RefreshControl refreshing={homeRefreshing} onRefresh={onHomeRefresh} tintColor={accent} colors={[accent]} />
            ) : bottomTab === "store" ? (
              <RefreshControl
                refreshing={storeRefreshing}
                onRefresh={async () => {
                  setStoreRefreshing(true);
                  try {
                    await Promise.all([loadCatalog(), loadInventory()]);
                  } finally {
                    setStoreRefreshing(false);
                  }
                }}
                tintColor={accent}
                colors={[accent]}
              />
            ) : mode === "store" && activeStore ? (
              <RefreshControl
                refreshing={storeRefreshing}
                onRefresh={async () => {
                  setStoreRefreshing(true);
                  try {
                    await refreshStoreData(activeStore.id);
                  } finally {
                    setStoreRefreshing(false);
                  }
                }}
                tintColor={accent}
                colors={[accent]}
              />
            ) : undefined
          }
        >
          <View style={styles.header}>
            <View style={styles.headerStart}>
              <Image source={require("./assets/burqanlogo.png")} style={styles.logoHeader} resizeMode="contain" />
              {bottomTab === "home" && repProfile?.fullName ? (
                <View style={styles.headerText}>
                  <Text style={styles.headerGreeting}>
                    {t.welcome(repProfile.fullName.trim().split(/\s+/)[0] ?? repProfile.fullName)}
                  </Text>
                  <Text style={styles.headerSub}>{t.homeSubtitle}</Text>
                </View>
              ) : null}
            </View>
            <Pressable
              style={styles.profileBtn}
              onPress={() => {
                setBottomTab("profile");
                if (mode === "store") setMode("home");
              }}
            >
              {profileAvatarUri ? (
                <Image source={{ uri: profileAvatarUri }} style={styles.profileBtnImg} />
              ) : (
                <View style={styles.profileBtnPlaceholder}>
                  <Text style={styles.profileBtnInitials}>{profileInitials}</Text>
                </View>
              )}
            </Pressable>
          </View>

      {bottomTab === "home" && mode !== "store" && mode !== "register" && (
        <>
          <View style={styles.card}>
            <Pressable style={styles.scanPrimary} onPress={() => void openQrScanner()}>
              <Text style={styles.scanPrimaryText}>{t.openScanner}</Text>
            </Pressable>
            <TextInput
              style={styles.input}
              value={manualToken}
              onChangeText={setManualToken}
              autoCapitalize="none"
              placeholder={t.manualToken}
              placeholderTextColor={muted}
            />
            <Pressable style={styles.secondary} onPress={() => void resolveQr(manualToken)}>
              <Text style={styles.secondaryText}>{t.lookup}</Text>
            </Pressable>
          </View>
          {activeStore ? (
            <Pressable style={styles.resumeCard} onPress={() => setMode("store")}>
              <View style={styles.resumeBody}>
                <Text style={styles.resumeName}>{activeStore.name}</Text>
                <Text style={styles.resumeMeta}>{activeStore.ownerName}</Text>
              </View>
              <Text style={styles.resumeArrow}>‹</Text>
            </Pressable>
          ) : null}

          <DailyStoresByArea
            stores={dailyStores}
            repAreaNames={repAreaNames}
            loading={dailyStoresLoading}
            title={t.dailyStoresTitle}
            labels={{
              hint: t.dailyStoresHint,
              empty: t.dailyStoresEmpty,
              allVisited: t.dailyStoresAllVisited,
              count: t.dailyStoresCount,
              visited: t.dailyStoresVisited,
              pending: t.dailyStoresPending,
              unknownArea: t.dailyStoresUnknownArea,
              storeCount: t.dailyStoresAreaCount,
              pendingCount: t.dailyStoresPendingCount,
              searchPlaceholder: t.dailyStoresSearchPlaceholder,
              filterAll: t.dailyStoresFilterAll,
              filterPending: t.dailyStoresFilterPending,
              filterDone: t.dailyStoresFilterDone,
              expandAll: t.dailyStoresExpandAll,
              collapseAll: t.dailyStoresCollapseAll,
              noSearchResults: t.dailyStoresNoSearchResults,
            }}
            onSelectStore={setPeekStore}
          />
        </>
      )}

      {bottomTab === "home" && mode === "store" && activeStore && (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{activeStore.name}</Text>
            <Pressable onPress={() => setEndVisitOpen(true)}>
              <Text style={styles.link}>{t.close}</Text>
            </Pressable>
          </View>
          <View style={styles.metaChips}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>
                {activeStore.deferredPaymentEnabled ? t.deferredOn : t.deferredOff}
              </Text>
            </View>
            <View style={[styles.metaChip, styles.metaChipMuted]}>
              <Text style={styles.metaChipTextMuted}>{activeStore.ownerName}</Text>
            </View>
          </View>
          <View style={styles.tabs}>
            {(["info", "visits", "orders", "sell"] as const).map((tab) => (
              <Pressable key={tab} style={[styles.tab, storeTab === tab && styles.tabOn]} onPress={() => setStoreTab(tab)}>
                <Text style={[styles.tabText, storeTab === tab && styles.tabTextOn]}>
                  {tabLabels[tab]}
                  {tab === "sell" && cartItemCount > 0 ? ` (${cartItemCount})` : ""}
                </Text>
              </Pressable>
            ))}
          </View>

          {storeTab === "info" && (
            <View style={styles.panel}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.phone}</Text>
                <Pressable
                  style={[styles.infoValueWrap, styles.infoLtr]}
                  onPress={() => void Linking.openURL(`tel:${activeStore.phone}`)}
                >
                  <Text
                    style={[styles.infoValue, styles.link, styles.infoValueSingleLine]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {activeStore.phone}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.location}</Text>
                <Pressable
                  style={styles.infoValueWrap}
                  onPress={() =>
                    void Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${activeStore.location.lat},${activeStore.location.lng}`
                    )
                  }
                >
                  <Text style={styles.infoValue}>{formatStoreLocation(activeStore, t.locationUnknown)}</Text>
                  <Text style={styles.infoMapsHint}>{t.openInMaps}</Text>
                </Pressable>
              </View>
              <Text style={styles.muted}>{t.visitAutoHint}</Text>
            </View>
          )}

          {storeTab === "visits" && (
            <View style={{ marginTop: 12 }}>
              {visits.length === 0 ? (
                <Text style={styles.emptyText}>{t.emptyVisits}</Text>
              ) : (
                visits.map((item) => (
                  <View key={item.id} style={styles.listRow}>
                    <Text style={styles.body}>{formatMarketDateTime(item.visited_at)}</Text>
                    {item.note ? <Text style={styles.muted}>{item.note}</Text> : null}
                  </View>
                ))
              )}
            </View>
          )}

          {storeTab === "orders" && (
            <View style={{ marginTop: 12 }}>
              {(orders as RepOrderRow[]).length === 0 ? (
                <Text style={styles.emptyText}>{t.emptyOrders}</Text>
              ) : (
                (orders as RepOrderRow[]).map((item) => (
                  <View key={String(item.id)} style={styles.listRow}>
                    <Text style={styles.body}>
                      #{item.id} · {formatPaymentType(item.payment_type)} · {item.total_amount} {t.currency}
                    </Text>
                    <Text style={styles.muted}>{formatMarketDateTime(item.created_at)}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {storeTab === "sell" && (
            <View style={styles.panel}>
              {products.length === 0 ? (
                <Text style={styles.emptyText}>{t.sellEmpty}</Text>
              ) : null}
              {products.map((item) => {
                const q = cart[item.id] ?? 0;
                const atMax = q >= item.quantity;
                return (
                  <ProductCard
                    key={item.id}
                    item={item}
                    mode="sell"
                    cartQty={q}
                    atMax={atMax}
                    onMinus={() => setQty(item.id, -1)}
                    onPlus={() => setQty(item.id, 1)}
                  />
                );
              })}
              {cartLines.length > 0 ? (
                <>
                  <View style={styles.segmented}>
                    <Pressable
                      style={[styles.segment, paymentType === "cash" && styles.segmentOn]}
                      onPress={() => setPaymentType("cash")}
                    >
                      <Text style={[styles.segmentText, paymentType === "cash" && styles.segmentTextOn]}>{t.cash}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.segment, paymentType === "deferred" && styles.segmentOn]}
                      onPress={() => setPaymentType("deferred")}
                    >
                      <Text style={[styles.segmentText, paymentType === "deferred" && styles.segmentTextOn]}>{t.deferredPay}</Text>
                    </Pressable>
                  </View>
                  <Pressable style={[styles.primary, styles.primaryLg]} onPress={() => void submitOrder()}>
                    <Text style={styles.primaryText}>{t.submitOrder}</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          )}
        </View>
      )}

      {bottomTab === "inventory" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.inventoryTitle}</Text>
          {inventory.length === 0 ? (
            <Text style={styles.emptyText}>{t.inventoryEmpty}</Text>
          ) : (
            inventory.map((item) => <ProductCard key={item.id} item={item} mode="stock" />)
          )}
        </View>
      )}

      {mode === "register" && lastScanToken && token && bottomTab === "home" && (
        <Suspense
          fallback={
            <View style={styles.center}>
              <ActivityIndicator color={accent} size="large" />
            </View>
          }
        >
          <RegisterStoreForm
            qrPublicToken={lastScanToken}
            headers={headers}
            apiBase={API_BASE}
            authToken={token}
            onNotice={(msg) => showToast(msg, "info")}
            onDone={async (msg, store) => {
              showToast(msg, store ? "success" : msg === t.cancelled ? "info" : "error");
              if (store) {
                setActiveStore(store);
                setMode("store");
                setBottomTab("home");
                setStoreTab("info");
                await Promise.all([refreshStoreData(store.id), loadDailyStores()]);
              } else {
                setMode("home");
                setBottomTab("home");
                setLastScanToken(null);
              }
            }}
          />
        </Suspense>
      )}

      {bottomTab === "profile" && (
        <ProfileScreen
          profile={repProfile}
          loading={profileLoading}
          error={profileError}
          refreshing={profileRefreshing}
          labels={{
            title: t.profileTitle,
            email: t.profileEmail,
            phone: t.profilePhone,
            carPlate: t.profileCar,
            areas: t.profileAreas,
            inventory: t.profileInventory,
            sku: t.profileSku,
            units: t.profileUnits,
            signOut: t.profileSignOut,
            retry: t.profileRetry,
            errorHint: t.profileErrorHint,
            viewInventory: t.navInventory,
            noAreas: t.profileNoAreas,
            noCarPlate: t.profileNoCar,
          }}
          onRefresh={async () => {
            setProfileRefreshing(true);
            try {
              await Promise.all([loadProfile(), loadInventory()]);
            } finally {
              setProfileRefreshing(false);
            }
          }}
          onSignOut={signOut}
          onOpenInventory={() => {
            setBottomTab("inventory");
            void loadInventory();
          }}
        />
      )}

      {bottomTab === "store" && (
        <>
          <View style={styles.screenHeader}>
            <Text style={styles.screenTitle}>{t.navStore}</Text>
            {catalogDisplay.length > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{t.productsBadge(catalogDisplay.length)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.muted}>{t.catalogStockHint}</Text>
          {catalogDisplay.length === 0 ? (
            <Text style={styles.emptyText}>{t.catalogEmpty}</Text>
          ) : (
            <View style={styles.productGrid}>
              {catalogDisplay.map((item) => (
                <ProductGridCard
                  key={item.id}
                  item={item}
                  width={productCardWidth}
                  currency={t.currency}
                  noImage={t.noImage}
                  showStock
                  onPress={() => setSelectedProduct(item)}
                />
              ))}
            </View>
          )}
        </>
      )}

      </ScrollView>
        <Modal
          visible={mode === "scan"}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => {
            setMode("home");
            setScanPermissionOverride(false);
          }}
        >
          <View style={[styles.scannerModal, scanModalPadding]}>
            {permission == null && !scanPermissionOverride ? (
              <View style={styles.scannerCenter}>
                <ActivityIndicator size="large" color={accent} />
                <Text style={styles.scannerHint}>{t.cameraLoading}</Text>
              </View>
            ) : !permission?.granted && !scanPermissionOverride ? (
              <View style={styles.scannerCenter}>
                <Text style={styles.scannerHint}>{t.cameraDenied}</Text>
                <Pressable style={styles.primary} onPress={() => void Linking.openSettings()}>
                  <Text style={styles.primaryText}>{t.openSettings}</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondary, { marginTop: 12 }]}
                  onPress={() => {
                    setMode("home");
                    setScanPermissionOverride(false);
                  }}
                >
                  <Text style={styles.secondaryText}>{t.close}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.scanner}>
                {!cameraSessionActive ? (
                  <View style={styles.cameraWarmup}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.cameraWarmupText}>{t.cameraPreviewWait}</Text>
                  </View>
                ) : (
                  <>
                    <CameraView
                      style={{ width: winW, height: embeddedCameraHeight }}
                      facing="back"
                      {...(Platform.OS === "ios" ? { active: true } : {})}
                      {...(Platform.OS === "android" ? { ratio: "16:9" as const } : {})}
                      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                      onCameraReady={() => setCameraPreviewReady(true)}
                      onMountError={(e) => {
                        showToast(`${t.cameraMountError} ${toArabicUserMessage(e.message, t.genericError)}`, "error");
                      }}
                      onBarcodeScanned={({ data }) => {
                        setMode("home");
                        setScanPermissionOverride(false);
                        void resolveQr(data);
                      }}
                    />
                    {!cameraPreviewReady && (
                      <View style={styles.cameraWarmup}>
                        <ActivityIndicator size="large" color="#fff" />
                      </View>
                    )}
                  </>
                )}
                <Pressable
                  style={styles.closeScan}
                  onPress={() => {
                    setMode("home");
                    setScanPermissionOverride(false);
                  }}
                >
                  <Text style={styles.closeScanText}>{t.close}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Modal>
        {busy ? (
          <View style={styles.busyOverlay} pointerEvents="auto">
            <ActivityIndicator size="large" color={accent} />
          </View>
        ) : null}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <BottomNavItem
            active={bottomTab === "home"}
            label={t.navHome}
            icon="home-outline"
            iconActive="home"
            onPress={() => {
              setBottomTab("home");
              if (mode === "store") setMode("home");
            }}
          />
          <BottomNavItem
            active={bottomTab === "inventory"}
            label={t.navInventory}
            icon="car-outline"
            iconActive="car"
            onPress={() => {
              setBottomTab("inventory");
              void loadInventory();
            }}
          />
          <BottomNavItem
            active={bottomTab === "store"}
            label={t.navStore}
            icon="grid-outline"
            iconActive="grid"
            onPress={() => {
              setBottomTab("store");
              void loadCatalog();
              void loadInventory();
            }}
          />
          <BottomNavItem
            active={bottomTab === "profile"}
            label={t.navProfile}
            icon="person-outline"
            iconActive="person"
            onPress={() => {
              setBottomTab("profile");
              if (mode === "store") setMode("home");
              void loadProfile();
            }}
          />
        </View>
      </KeyboardAvoidingView>
      {toast ? <ToastOverlay text={toast.text} kind={toast.kind} onDismiss={hideToast} /> : null}
      <ProductDetailModal
        visible={selectedProduct != null}
        product={selectedProduct}
        viewOnly={bottomTab === "store"}
        cartQty={selectedProduct ? (cart[selectedProduct.id] ?? 0) : 0}
        atMax={selectedProduct ? (cart[selectedProduct.id] ?? 0) >= selectedProduct.quantity : false}
        labels={productDetailLabels}
        onClose={() => setSelectedProduct(null)}
        onMinus={() => selectedProduct && setQty(selectedProduct.id, -1)}
        onPlus={() => selectedProduct && setQty(selectedProduct.id, 1)}
      />
      <EndVisitModal
        visible={endVisitOpen}
        cartItemCount={cartItemCount}
        noteRequired={noPurchaseEndVisit}
        busy={endVisitBusy}
        labels={{
          title: t.visitEndTitle,
          message: noPurchaseEndVisit ? t.visitEndNoBuyMessage : t.visitEndMessage,
          messageCart: t.visitEndMessageCart,
          noteLabel: noPurchaseEndVisit ? t.visitEndNoBuyNoteLabel : t.visitEndNoteLabel,
          notePlaceholder: noPurchaseEndVisit ? t.visitEndNoBuyNotePlaceholder : t.visitEndNotePlaceholder,
          stay: t.visitEndStay,
          goCart: t.visitEndGoCart,
          confirm: t.visitEndConfirm,
        }}
        onStay={() => setEndVisitOpen(false)}
        onGoCart={() => {
          setEndVisitOpen(false);
          setBottomTab("home");
          setMode("store");
          setStoreTab("sell");
        }}
        onConfirm={(note) => void confirmEndVisit(note)}
      />
      <StorePeekModal
        visible={peekStore != null}
        store={peekStore}
        labels={{
          close: t.close,
          phone: t.phone,
          owner: t.storeOwner,
          location: t.location,
          locationUnknown: t.locationUnknown,
          openInMaps: t.openInMaps,
          callStore: t.callStore,
          deferredOn: t.deferredOn,
          deferredOff: t.deferredOff,
        }}
        formatLocation={(s) => formatStoreLocation(s, t.locationUnknown)}
        onClose={() => setPeekStore(null)}
      />
    </SafeAreaView>
  );
}

function BottomNavItem(props: {
  active: boolean;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  iconActive: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  const color = props.active ? accent : muted;
  return (
    <Pressable
      style={[styles.bottomTab, props.active && styles.bottomTabOn]}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: props.active }}
      accessibilityLabel={props.label}
    >
      <Ionicons name={props.active ? props.iconActive : props.icon} size={22} color={color} />
      <Text style={[styles.bottomTabText, props.active && styles.bottomTabTextOn]} numberOfLines={1}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function ProductCard(props: {
  item: Product;
  mode: "stock" | "sell";
  cartQty?: number;
  atMax?: boolean;
  onMinus?: () => void;
  onPlus?: () => void;
}) {
  const uri = productImageUrl(props.item.image_url);
  return (
    <View style={styles.productCard}>
      {uri ? (
        <Image source={{ uri }} style={styles.productImage} resizeMode="cover" />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <Text style={styles.productImagePlaceholderText}>{t.noImage}</Text>
        </View>
      )}
      <View style={styles.productCardBody}>
        <Text style={styles.productName}>{props.item.name}</Text>
        {props.item.designation ? (
          <Text style={styles.productDesc} numberOfLines={3}>
            {props.item.designation}
          </Text>
        ) : null}
        {props.item.unit_label ? <Text style={styles.productMeta}>{props.item.unit_label}</Text> : null}
        <View style={styles.productPriceRow}>
          <Text style={styles.productPrice}>
            {props.item.price} {t.currency}
          </Text>
          <Text style={styles.productStock}>
            {t.stock}: {props.item.quantity}
          </Text>
        </View>
        {props.mode === "sell" && props.onMinus && props.onPlus ? (
          <View style={styles.qtyRow}>
            <Pressable style={styles.qtyBtnLg} onPress={props.onMinus}>
              <Text style={styles.qtyBtnText}>−</Text>
            </Pressable>
            <Text style={styles.qtyNumLg}>{props.cartQty ?? 0}</Text>
            <Pressable style={styles.qtyBtnLg} onPress={props.onPlus} disabled={props.atMax}>
              <Text style={[styles.qtyBtnText, props.atMax && { opacity: 0.35 }]}>+</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const bg = theme.bg;
const card = theme.card;
const line = theme.line;
const text = theme.text;
const muted = theme.muted;
const accent = theme.accent;

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: bg, padding: 24, justifyContent: "center" },
  page: { padding: 16, paddingBottom: 48, backgroundColor: bg, flexGrow: 1 },
  logo: { width: 160, height: 64, alignSelf: "center", marginBottom: 20 },
  logoHeader: { width: 112, height: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingVertical: 4,
    gap: 12,
  },
  headerStart: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerGreeting: { color: text, fontSize: 17, fontWeight: "800", textAlign: "right" },
  headerSub: { color: muted, fontSize: 12, marginTop: 2, textAlign: "right" },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: theme.accentSoft,
  },
  profileBtnImg: { width: "100%", height: "100%" },
  profileBtnPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  profileBtnInitials: { color: accent, fontWeight: "800", fontSize: 15 },
  title: { color: text, fontSize: 24, fontWeight: "800", textAlign: "center", letterSpacing: -0.3 },
  loginCard: {
    width: "100%",
    backgroundColor: card,
    borderRadius: theme.radius.xl,
    padding: 20,
    marginTop: 8,
    ...theme.shadow.card,
  },
  card: {
    backgroundColor: card,
    borderRadius: theme.radius.xl,
    padding: 16,
    marginTop: 12,
    ...theme.shadow.card,
  },
  cardTitle: { color: text, fontSize: 17, fontWeight: "800", marginBottom: 4, textAlign: "right" },
  screenHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 12,
  },
  screenTitle: { color: text, fontSize: 22, fontWeight: "800" },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  countBadgeText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  scanPrimary: {
    backgroundColor: accent,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.accent2,
  },
  scanPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  resumeCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: card,
    borderRadius: theme.radius.xl,
    padding: 16,
    marginTop: 12,
    ...theme.shadow.card,
  },
  resumeBody: { flex: 1 },
  resumeName: { color: text, fontSize: 17, fontWeight: "800", textAlign: "right" },
  resumeMeta: { color: muted, fontSize: 13, marginTop: 2, textAlign: "right" },
  resumeArrow: { color: accent, fontSize: 28, fontWeight: "300", marginLeft: 8 },
  dailySection: {
    marginTop: 16,
    backgroundColor: card,
    borderRadius: theme.radius.xl,
    padding: 16,
    ...theme.shadow.card,
  },
  dailyCount: { color: accent, fontSize: 13, fontWeight: "700" },
  dailyStoreCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: theme.radius.lg,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: line,
  },
  dailyStoreBody: { flex: 1, minWidth: 0 },
  dailyStoreName: { color: text, fontSize: 16, fontWeight: "800", textAlign: "right" },
  dailyStoreMeta: { color: muted, fontSize: 13, marginTop: 4, textAlign: "right" },
  dailyStoreNote: { color: muted, fontSize: 12, marginTop: 6, textAlign: "right", fontStyle: "italic" },
  dailyStoreCardVisited: {
    backgroundColor: "#f0fdf4",
    borderColor: "rgba(22, 163, 74, 0.35)",
  },
  dailyVisitedBadge: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 56,
    gap: 2,
  },
  dailyVisitedCheck: {
    color: "#16a34a",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
  },
  dailyVisitedText: {
    color: "#16a34a",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  dailyAllDone: {
    color: "#16a34a",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 12,
    marginBottom: 4,
  },
  metaChips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 4 },
  metaChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accentSoft,
  },
  metaChipMuted: { backgroundColor: "#f1f5f9" },
  metaChipText: { color: theme.accentDark, fontSize: 12, fontWeight: "700" },
  metaChipTextMuted: { color: muted, fontSize: 12, fontWeight: "600" },
  panel: { marginTop: 12 },
  infoRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: line,
  },
  infoLabel: { color: muted, fontSize: 13, fontWeight: "600", flexShrink: 0, minWidth: 72 },
  infoValueWrap: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  infoValue: { color: text, fontSize: 15, fontWeight: "700", textAlign: "left", width: "100%" },
  infoValueSingleLine: { flexShrink: 1 },
  infoLtr: { direction: "ltr" },
  infoMapsHint: { color: theme.accent, fontSize: 12, fontWeight: "600", marginTop: 4 },
  emptyText: { color: muted, fontSize: 15, textAlign: "center", marginTop: 24, fontWeight: "600" },
  segmented: {
    flexDirection: "row-reverse",
    backgroundColor: "#f1f5f9",
    borderRadius: theme.radius.md,
    padding: 4,
    marginTop: 16,
    marginBottom: 12,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.sm, alignItems: "center" },
  segmentOn: { backgroundColor: card, ...theme.shadow.card },
  segmentText: { color: muted, fontWeight: "700", fontSize: 14 },
  segmentTextOn: { color: accent },
  input: {
    borderWidth: 1,
    borderColor: line,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: text,
    marginTop: 8,
    backgroundColor: "#f8fafc",
    fontSize: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  label: { color: muted, marginTop: 12, fontSize: 12, fontWeight: "600", textAlign: "right" },
  body: { color: text, marginTop: 4, textAlign: "right" },
  primary: {
    marginTop: 12,
    backgroundColor: accent,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.accent2,
  },
  primaryLg: {
    marginTop: 4,
    paddingVertical: 18,
    minHeight: 56,
  },
  primaryText: { color: theme.onAccent, fontWeight: "800", fontSize: 16 },
  secondary: {
    marginTop: 10,
    backgroundColor: "#f8fafc",
    borderColor: line,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryText: { color: text, fontWeight: "700", fontSize: 15 },
  muted: { color: muted, marginTop: 6, fontSize: 13, textAlign: "right" },
  link: { color: accent, fontWeight: "800", fontSize: 15 },
  scannerModal: { flex: 1, backgroundColor: "#000" },
  scannerCenter: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  scannerHint: { color: "#e8eefc", marginTop: 16, textAlign: "center", fontSize: 15 },
  scanner: { flex: 1, width: "100%", backgroundColor: "#000" },
  cameraWarmup: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  cameraWarmupText: { color: "#fff", marginTop: 14, fontSize: 15, textAlign: "center", paddingHorizontal: 24 },
  closeScan: {
    position: "absolute",
    right: 12,
    top: 12,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  closeScanText: { color: "white", fontWeight: "800" },
  busy: { padding: 10 },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.25)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 40,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  tabs: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    backgroundColor: "#f1f5f9",
    padding: 4,
    borderRadius: theme.radius.md,
  },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: theme.radius.sm },
  tabOn: { backgroundColor: card, ...theme.shadow.card },
  tabText: { color: muted, fontWeight: "700", fontSize: 13 },
  tabTextOn: { color: accent, fontWeight: "800" },
  productGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  listRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: line },
  productRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: line },
  productCard: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
    marginTop: 10,
    borderRadius: theme.radius.lg,
    backgroundColor: card,
    ...theme.shadow.card,
  },
  productImage: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
  },
  productImagePlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: line,
  },
  productImagePlaceholderText: { color: muted, fontSize: 11, fontWeight: "600" },
  productCardBody: { flex: 1, minWidth: 0 },
  productName: { color: text, fontSize: 17, fontWeight: "800", textAlign: "right" },
  productDesc: { color: muted, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: "right" },
  productMeta: { color: accent, fontSize: 12, fontWeight: "700", marginTop: 4, textAlign: "right" },
  productPriceRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    flexWrap: "wrap",
    gap: 6,
  },
  productPrice: { color: accent, fontSize: 16, fontWeight: "800" },
  productStock: { color: muted, fontSize: 13, fontWeight: "600" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, alignSelf: "flex-end" },
  qtyBtnLg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: accent,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyNumLg: { color: text, fontWeight: "800", fontSize: 18, minWidth: 28, textAlign: "center" },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: line,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { color: text, fontSize: 20, fontWeight: "700" },
  qtyNum: { color: text, fontWeight: "800", minWidth: 24, textAlign: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: line },
  chipOn: { borderColor: accent, backgroundColor: theme.accentSoft },
  chipText: { color: text, fontWeight: "600" },
  bottomBar: {
    flexDirection: "row-reverse",
    marginHorizontal: 12,
    marginTop: 8,
    padding: 6,
    borderRadius: theme.radius.xl,
    backgroundColor: card,
    ...theme.shadow.float,
  },
  bottomTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  bottomTabOn: { backgroundColor: theme.accentSoft },
  bottomTabText: { color: muted, fontWeight: "600", fontSize: 10 },
  bottomTabTextOn: { color: accent, fontWeight: "800", fontSize: 10 },
});
