import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ExpoSplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Image,
  InteractionManager,
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
import { IN_APP_QR_BARCODE_TYPES, shouldUseSystemQrScanner } from "./qrScanner";
import {
  cancelSystemQrScanSession,
  ensureSystemQrScanListener,
  presentSystemQrScanner,
} from "./systemQrScanner";
import { fetchJson } from "./fetchJson";
import {
  ensureLocationPermission,
  getRepPosition,
  LocationDeniedError,
  LocationInaccurateError,
  LocationTimeoutError,
  warmRepPosition,
} from "./getDeviceLocation";
import ProductCatalogGrid from "./ProductCatalogGrid";
import InventoryList from "./InventoryList";
import {
  getProductGridLayout,
  isTabletDevice,
  layoutContentWidth,
  tabletContentMaxWidth,
} from "./deviceLayout";
import { isLocalApiBase, resolveApiBase } from "./resolveApiBase";
import { toArabicUserMessage } from "./arabicMessage";
import ProductDetailModal, { type Product } from "./ProductDetailModal";
import { productImageUrl } from "./productImage";
import ProfileScreen, { type RepProfile } from "./ProfileScreen";
import RouteDayStores from "./RouteDayStores";
import { clearRepToken, loadStoredRepToken, saveRepToken } from "./repSession";
import SplashScreen from "./SplashScreen";
import ToastOverlay, { type ToastKind } from "./ToastOverlay";
import { theme } from "./theme";
import DailyStoresByArea from "./DailyStoresByArea";
import PossibleClientsSection from "./PossibleClientsSection";
import GooglePlacesByArea, { type GooglePlaceAreaSummary } from "./GooglePlacesByArea";
import {
  groupRawGooglePlacesByArea,
  type RawGooglePlace,
} from "./groupGooglePlacesByArea";
import EndVisitModal, { type EndVisitReasonKind } from "./EndVisitModal";
import EndVisitBar from "./EndVisitBar";
import OrderInvoiceModal from "./OrderInvoiceModal";
import OrderConfirmModal from "./OrderConfirmModal";
import StoreCartPanel from "./StoreCartPanel";
import StorePeekModal from "./StorePeekModal";
import { NOT_REGISTER_REASONS } from "./notRegisterReasons";
import RegisterErrorBoundary from "./RegisterErrorBoundary";
import type { ReceiptData } from "./receiptFormat";
import type { DailyStoreCard, PrizeProduct, ProspectCard, StoreBrief } from "./storeTypes";
import { normalizeStoreBrief } from "./storeTypes";
import { sortDailyStoreCardsByDistance } from "./geoDistance";

/** Lazy: keeps react-native-maps out of the register screen chunk on Android. */
const RegisterStoreForm = lazy(() => import("./RegisterStoreForm"));
const ProspectStoreForm = lazy(() => import("./ProspectStoreForm"));
const EditStoreForm = lazy(() => import("./EditStoreForm"));
const ProspectPeekModal = lazy(() => import("./ProspectPeekModal"));

void ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

const API_BASE = resolveApiBase();

const t = {
  appTitle: "برقان — المندوب",
  networkFailedLive: (host: string) =>
    `تعذّر الاتصال بالخادم (${host}). تحقق من الإنترنت على الهاتف وحالة api.burqan.store على السيرفر.`,
  networkFailedLocal:
    "تعذّر الاتصال بالـ API المحلي. شغّل npm run api:dev (منفذ 4000)، نفس Wi‑Fi، أو أزل EXPO_PUBLIC_API_USE_LOCAL=1 لاستخدام api.burqan.store.",
  email: "البريد",
  password: "كلمة المرور",
  signIn: "دخول",
  openScanner: "مسح الرمز",
  manualToken: "رمز البطاقة",
  lookup: "تأكيد",
  close: "إغلاق",
  endVisitBtn: "إنهاء الزيارة",
  endVisitBtnSub: "العودة للرئيسية وإغلاق جلسة هذا المتجر",
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
  tabSell: "طلب",
  cartTitle: "ملخص الطلب",
  cartEmptyHint: "اضغط + لإضافة منتجات من القائمة أعلاه",
  invoiceTitle: "فاتورة الطلب",
  invoiceOrderNo: "رقم",
  invoiceProduct: "المنتج",
  invoiceQty: "كم",
  invoiceLineTotal: "المجموع",
  invoiceTotal: "الإجمالي",
  invoicePrint: "طباعة (طابعة حرارية)",
  invoiceClose: "تم",
  invoicePrintFailed: "تعذّرت الطباعة — تحقق من اتصال الطابعة",
  orderConfirmTitle: "تأكيد الطلب",
  orderConfirmSubtitle: "راجع المنتجات قبل الإرسال",
  orderConfirmStore: "المتجر",
  orderConfirmSubmit: "تأكيد وإرسال",
  orderConfirmCancel: "رجوع",
  startOrder: "بدء طلب جديد",
  tabRedeem: "الجوائز",
  redeemBalance: "رصيد نقاط المتجر",
  redeemPointsUnit: (n: number) => `${n} نقطة / وحدة`,
  redeemCartPoints: (n: number) => `المجموع: ${n} نقطة`,
  submitRedeem: "تأكيد الاستبدال",
  redeemSaved: "تم استبدال الجوائز وخصم النقاط.",
  redeemFailed: "فشل الاستبدال",
  redeemEmpty: "لا توجد جوائز متاحة للاستبدال.",
  redeemAddItems: "أضف منتجات للاستبدال",
  redeemInsufficient: "رصيد النقاط غير كافٍ لهذا الاستبدال",
  priceLabel: "السعر",
  unit: "الوحدة",
  description: "الوصف / التعيين",
  productCode: "رمز المنتج",
  specsTitle: "مواصفات المنتج",
  cartonSpec: "الكرتون",
  dimensions: "الأبعاد (سم)",
  cartonWeight: "وزن الكرتون",
  notSpecified: "—",
  vanStock: "مخزون السيارة",
  inCart: "في السلة",
  phone: "الهاتف",
  location: "الموقع",
  locationUnknown: "لم يُسجَّل عنوان",
  openInMaps: "فتح على الخريطة",
  visitAutoHint: "تُسجَّل الزيارة تلقائياً عند مسح رمز المتجر.",
  editStore: "تعديل بيانات المتجر",
  storeUpdated: "تم تحديث بيانات المتجر.",
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
  qrResolving: "جاري التحقق من الرمز…",
  qrInvalid: "رمز غير صالح",
  locationTimeout: "تعذّر تحديد الموقع في الوقت المحدد — تحقق من GPS",
  networkTimeout: "انتهى وقت الاتصال بالخادم — حاول مرة أخرى",
  uploadFailed: "فشل رفع الصورة",
  registerFailed: "فشل التسجيل",
  cancelled: "أُلغي",
  storeCreated: (id: number) => `تم إنشاء المتجر #${id}.`,
  currency: "د.أ",
  locationDenied: "يلزم تفعيل الموقع للمسح وتسجيل المتاجر.",
  locationInaccurate: (m: number) =>
    `دقة GPS ضعيفة (±${Math.round(m)} م). قف عند المتجر في مكان مفتوح ثم أعد المسح.`,
  locating: "جاري تحديد موقعك…",
  areaAuto: "المنطقة (تلقائي من الخريطة)",
  areaDetecting: "جاري تحديد المنطقة…",
  refreshLocation: "تحديث الموقع",
  refreshLocationCurrent: "تحديث موقعي الحالي",
  navHome: "الرئيسية",
  navRoute: "مسار اليوم",
  routeDayTitle: "مسار اليوم",
  routeDaySubtitle: "متاجر مسار اليوم وعملاء محتملون — الأقرب أولاً",
  routeDayToday: (day: string, zone: string) => `${day} · ${zone}`,
  routeDayAreas: "المناطق",
  routeDayStoresCount: (n: number) => `${n} موقع`,
  routeDayPossibleCount: (n: number) => `${n} محتمل`,
  routeDayPossiblePill: "محتمل",
  routeDayNearest: "مرتّبة حسب المسافة من موقعك الحالي",
  routeDayEmpty: "لا متاجر في مسار اليوم.",
  routeDayNoSchedule: "لا يوجد مسار مجدول لهذا اليوم — راجع الإدارة.",
  routeDayNoZoneAreas: "منطقة المسار لا تحتوي مناطق.",
  routeDayLoadFailed: "تعذّر تحميل مسار اليوم.",
  navInventory: "مخزون",
  navStore: "المنتجات",
  navProfile: "حسابي",
  profileTitle: "الملف الشخصي",
  profilePhone: "الهاتف",
  profileEmail: "البريد",
  profileCar: "لوحة السيارة",
  profileAreas: "مسار اليوم",
  profileInventory: "مخزون السيارة",
  profileSku: "أصناف",
  profileUnits: "وحدات",
  profileSignOut: "تسجيل الخروج",
  profileNoAreas: "لا يوجد مسار مجدول لهذا اليوم",
  profileNoCar: "—",
  profileLoadFailed: "تعذّر تحميل الملف الشخصي",
  profileRetry: "إعادة المحاولة",
  profileErrorHint: "تحقق من الاتصال بالخادم أو سجّل الخروج وأعد تسجيل الدخول.",
  sessionExpired: "انتهت الجلسة — سجّل الدخول مرة أخرى",
  welcome: (name: string) => `مرحباً، ${name}`,
  homeSubtitle: "امسح رمز المتجر لبدء الزيارة والبيع",
  dailyStoresTitle: "مسار اليوم",
  dailyStoresHint: "بعد الزيارة يظهر ✓ تمت زيارته — تبقى في القائمة حتى اليوم التالي",
  dailyStoresEmpty: "لا متاجر في مسار اليوم",
  dailyStoresNearestFirst: "ترتيب من الأقرب لموقعك",
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
  dailyStoresVisitQr: "زيارة",
  prospectsTitle: "عملاء محتملون",
  prospectsHint: "متاجر بدون QR — اربط بطاقة جديدة عند الزيارة التالية",
  prospectsEmpty: "لا يوجد عملاء محتملون",
  prospectsAdd: "إضافة",
  prospectsLinkQr: "ربط رمز QR",
  prospectsVisited: "تمت زيارته",
  prospectsPending: "باقٍ",
  prospectsSearch: "بحث…",
  prospectsPill: "محتمل",
  prospectConverted: "تم تحويل العميل إلى متجر مسجّل",
  prospectConvertFailed: "تعذّر ربط الرمز",
  prospectLinkScanHint: "امسح رمز بطاقة جديد غير مستخدم لربط هذا العميل",
  prospectEndVisit: "إنهاء الزيارة",
  prospectLastReason: "سبب عدم التسجيل",
  prospectEndTitle: "إنهاء زيارة العميل المحتمل؟",
  prospectEndMessage: "لم يتم ربط رمز QR. اذكر سبب عدم التسجيل قبل إغلاق الزيارة.",
  prospectEndNoteLabel: "سبب عدم التسجيل",
  prospectEndPickHint: "اختر سبباً واحداً",
  prospectEndMode: "سبب عدم التسجيل — مطلوب",
  prospectEndNoteRequired: "يرجى اختيار سبب عدم التسجيل",
  prospectVisitRecordFailed: "تعذّر تسجيل الزيارة",
  prospectCoords: "الإحداثيات",
  prospectMapFallback: "معاينة الخريطة غير متاحة — اضغط فتح على الخريطة",
  navGoogle: "خرائط Google",
  googleTabTitle: "سوبرماركت ومتاجر المنطقة",
  googleTabHint: "نتائج البحث من Google Maps في مناطق عملك",
  googleTabLazyHint: "اضغط على منطقة لتحميل متاجرها — أو ابحث بالاسم",
  googleTabLoadingArea: "جاري التحميل…",
  googleTabEmpty: "لا متاجر من Google في مناطقك بعد.",
  googleTabNotReady:
    "لم يُفعَّل استيراد Google على الخادم. اطلب من المشرف: migrate ثم استيراد من لوحة المتاجر.",
  googleTabLoadFailed: "تعذّر تحميل متاجر Google — اسحب للتحديث",
  googleTabSearchPlaceholder: "بحث عن متجر أو عنوان…",
  googleTabPill: "Google",
  googleTabOpenMaps: "فتح على الخريطة",
  googleTabTruncated: (shown: number, total: number) =>
    `عرض ${shown} من ${total} — استخدم البحث أو افتح منطقة محددة`,
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
  tooFar: "أنت بعيد عن المتجر. اقترب إلى أقل من 5 كم.",
  noImage: "لا صورة",
  visitEndTitle: "إنهاء الزيارة؟",
  visitEndMessage: "تمت الزيارة بنجاح؟ يمكنك إضافة ملاحظة اختيارية ثم إنهاء الزيارة.",
  visitEndMessageCart: (n: number) => `لديك ${n} منتج في السلة. يمكنك إتمام الطلب أو إنهاء الزيارة.`,
  visitEndStay: "متابعة الزيارة",
  visitEndGoCart: "الذهاب إلى السلة",
  visitEndConfirm: "إنهاء الزيارة",
  visitEndNoteLabel: "ملاحظة الزيارة (اختياري)",
  visitEndNoBuyNoteLabel: "سبب عدم الشراء",
  visitEndNoBuyPickHint: "اختر سبباً واحداً",
  visitEndNotePlaceholder: "اكتب ملاحظة عن الزيارة…",
  visitEndModeNote: "ملاحظة زيارة (اختياري)",
  visitEndModeNoBuy: "سبب عدم الشراء — مطلوب",
  visitEndNoBuyNoteRequired: "يرجى اختيار سبب عدم الشراء",
  visitEndNoBuyMessage: "لم تُسجَّل أي مشتريات. اذكر سبب عدم الشراء قبل إغلاق الزيارة.",
  visitEndNoteFailed: "تعذّر حفظ ملاحظة الزيارة",
  closeStoreBeforeScan: "أنهِ زيارة المتجر الحالي (إنهاء الزيارة) قبل مسح متجر آخر",
  resumeOpenVisit: "زيارة قيد التنفيذ — اضغط للمتابعة",
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
  carton_spec?: string | null;
  dimensions_cm?: string | null;
  carton_weight_kg?: string | number | null;
  image_url?: string | null;
}): Product {
  return {
    id: r.id,
    name: r.name,
    price: String(r.price),
    designation: r.designation ?? null,
    unit_label: r.unit_label ?? null,
    carton_spec: r.carton_spec ?? null,
    dimensions_cm: r.dimensions_cm ?? null,
    carton_weight_kg: r.carton_weight_kg != null ? String(r.carton_weight_kg) : null,
    image_url: r.image_url ?? null,
    quantity: Number(r.quantity) || 0,
  };
}

type Area = { id: number; name: string };

export type { StoreBrief } from "./storeTypes";

type BottomTab = "home" | "route" | "google" | "inventory" | "store" | "profile";
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
  const contentWidth = useMemo(
    () => layoutContentWidth(winW, pageMaxWidth),
    [winW, pageMaxWidth]
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

  const [mode, setMode] = useState<"home" | "scan" | "register" | "prospect-add" | "store">("home");
  const [permission, requestPermission] = useCameraPermissions();
  /** iOS sometimes lags updating `permission` after the user taps Allow — still show CameraView if request() just succeeded. */
  const [scanPermissionOverride, setScanPermissionOverride] = useState(false);
  const [cameraPreviewReady, setCameraPreviewReady] = useState(false);
  /** Mount native camera after the modal is on-screen so layout/size is non-zero (avoids black preview). */
  const [cameraSessionActive, setCameraSessionActive] = useState(false);
  const qrResolveInFlightRef = useRef(false);
  const [inAppScanEnabled, setInAppScanEnabled] = useState(false);
  const lastBarcodeAtRef = useRef(0);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);

  const canUseCamera = Boolean(permission?.granted || scanPermissionOverride);

  useEffect(() => {
    ensureSystemQrScanListener();
  }, []);

  useEffect(() => {
    if (mode !== "scan" || !canUseCamera) {
      setCameraSessionActive(false);
      setCameraPreviewReady(false);
      setInAppScanEnabled(false);
      return;
    }
    setCameraPreviewReady(false);
    setInAppScanEnabled(false);
    if (Platform.OS === "ios") {
      setCameraSessionActive(true);
      const enableScan = setTimeout(() => {
        setCameraPreviewReady(true);
        setInAppScanEnabled(true);
      }, 400);
      return () => clearTimeout(enableScan);
    }
    setCameraSessionActive(false);
    const startCam = setTimeout(() => setCameraSessionActive(true), 200);
    const enableScan = setTimeout(() => {
      setCameraPreviewReady(true);
      setInAppScanEnabled(true);
    }, 2500);
    return () => {
      clearTimeout(startCam);
      clearTimeout(enableScan);
    };
  }, [mode, canUseCamera]);
  const [lastScanToken, setLastScanToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [activeStore, setActiveStore] = useState<StoreBrief | null>(null);
  const [storeTab, setStoreTab] = useState<"info" | "sell" | "redeem">("sell");
  const [editStoreOpen, setEditStoreOpen] = useState(false);
  const [prizeProducts, setPrizeProducts] = useState<PrizeProduct[]>([]);
  const [redeemCart, setRedeemCart] = useState<Record<number, number>>({});
  const [storePointsBalance, setStorePointsBalance] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [paymentType, setPaymentType] = useState<"cash" | "deferred">("cash");
  const [homeRefreshing, setHomeRefreshing] = useState(false);
  const [googleRefreshing, setGoogleRefreshing] = useState(false);
  const [dailyStores, setDailyStores] = useState<DailyStoreCard[]>([]);
  const [prospects, setProspects] = useState<ProspectCard[]>([]);
  const [prospectsLoading, setProspectsLoading] = useState(false);
  const [convertingProspectId, setConvertingProspectId] = useState<number | null>(null);
  const [googlePlacesReady, setGooglePlacesReady] = useState(true);
  const [dailyStoresLoading, setDailyStoresLoading] = useState(false);
  const [dailyMeta, setDailyMeta] = useState<{
    zoneName?: string;
    dayName?: string;
    message?: string;
    nearestFirst?: boolean;
  } | null>(null);
  const [googlePlacesLoading, setGooglePlacesLoading] = useState(false);
  const [googlePlacesTotal, setGooglePlacesTotal] = useState(0);
  const [googleAreaSummaries, setGoogleAreaSummaries] = useState<GooglePlaceAreaSummary[]>([]);
  const [googlePlacesByArea, setGooglePlacesByArea] = useState<Record<number, DailyStoreCard[]>>({});
  const [googleAreaLoading, setGoogleAreaLoading] = useState<Record<number, boolean>>({});
  const [googleSearchResults, setGoogleSearchResults] = useState<DailyStoreCard[] | null>(null);
  const [googleSearchLoading, setGoogleSearchLoading] = useState(false);
  const [googleLazyApi, setGoogleLazyApi] = useState(true);
  const googleRawByAreaRef = useRef<Record<number, RawGooglePlace[]>>({});
  const [peekStore, setPeekStore] = useState<DailyStoreCard | null>(null);
  const [peekProspect, setPeekProspect] = useState<ProspectCard | null>(null);
  const [endVisitOpen, setEndVisitOpen] = useState(false);
  const [endVisitBusy, setEndVisitBusy] = useState(false);
  const [endVisitNoBuyRequired, setEndVisitNoBuyRequired] = useState(false);
  const [prospectEndVisitOpen, setProspectEndVisitOpen] = useState(false);
  const [prospectEndVisitBusy, setProspectEndVisitBusy] = useState(false);
  const [prospectEndVisitRequiresReason, setProspectEndVisitRequiresReason] = useState(false);
  const [prospectEndVisitTarget, setProspectEndVisitTarget] = useState<ProspectCard | null>(null);
  const [visitHadOrder, setVisitHadOrder] = useState(false);
  const [orderReceipt, setOrderReceipt] = useState<ReceiptData | null>(null);
  const [orderReceiptOpen, setOrderReceiptOpen] = useState(false);
  const [orderConfirmOpen, setOrderConfirmOpen] = useState(false);
  const [storeRefreshing, setStoreRefreshing] = useState(false);
  const [routeStores, setRouteStores] = useState<DailyStoreCard[]>([]);
  const [routeMeta, setRouteMeta] = useState<{
    active: boolean;
    dayName?: string;
    routeZone?: { id: number; name: string; notes?: string | null; areas?: string[] };
    message?: string;
  } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeLocating, setRouteLocating] = useState(false);
  const [routeRefreshing, setRouteRefreshing] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>("home");
  const [inventory, setInventory] = useState<Product[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const productGrid = useMemo(
    () => getProductGridLayout(contentWidth, isTablet),
    [contentWidth, isTablet]
  );
  const renderInventoryCard = useCallback(
    (props: { item: Product; mode: "stock" }) => <ProductCard item={props.item} mode="stock" />,
    []
  );

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const apiGet = useCallback(
    async (path: string, timeoutMs = 25_000) => {
      const { res, data } = await fetchJson(`${API_BASE}${path}`, { headers, timeoutMs });
      if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
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
      showToast(
        isNetwork
          ? isLocalApiBase(API_BASE)
            ? t.networkFailedLocal
            : t.networkFailedLive(API_BASE)
          : toArabicUserMessage(msg, t.loginFailed),
        "error"
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  const loadInventory = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGet("/api/v1/rep/inventory");
      const rows = (data.inventory ?? []) as Parameters<typeof mapProductRow>[0][];
      setInventory(rows.map(mapProductRow).filter((r) => r.quantity > 0));
    } catch {
      /* ignore */
    }
  }, [apiGet, token]);

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGet("/api/v1/rep/products");
      const rows = (data.products ?? []) as Parameters<typeof mapProductRow>[0][];
      setCatalogProducts(rows.map(mapProductRow));
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

  const mapGoogleProspects = useCallback(
    (
      prospects: {
        id: number;
        name: string;
        addressText?: string | null;
        location: { lat: number; lng: number };
        areaName?: string | null;
        googleMapsUrl?: string | null;
        googlePlaceId?: string | null;
      }[]
    ): DailyStoreCard[] =>
      prospects.map((p) => ({
        id: p.id,
        source: "google",
        name: p.name,
        phone: "",
        ownerName: t.googleTabPill,
        location: p.location,
        addressText: p.addressText ?? null,
        areaName: p.areaName ?? null,
        deferredPaymentEnabled: false,
        visitedToday: false,
        googleMapsUrl: p.googleMapsUrl ?? null,
        googlePlaceId: p.googlePlaceId ?? null,
      })),
    []
  );

  const loadProspects = useCallback(async () => {
    if (!token) return;
    setProspectsLoading(true);
    try {
      const data = await apiGet("/api/v1/rep/prospect-stores");
      const rows = (data.prospects ?? []) as Array<{
        id: number;
        name: string;
        phone: string;
        ownerName: string;
        location: { lat: number; lng: number };
        addressText?: string | null;
        areaName?: string | null;
        visitedToday?: boolean;
        todayVisitNote?: string | null;
      }>;
      setProspects(
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          ownerName: p.ownerName,
          location: p.location,
          addressText: p.addressText,
          areaName: p.areaName,
          visitedToday: p.visitedToday,
          todayVisitNote: p.todayVisitNote ?? null,
        }))
      );
    } catch {
      setProspects([]);
    } finally {
      setProspectsLoading(false);
    }
  }, [apiGet, token]);

  const loadDailyStores = useCallback(async () => {
    if (!token) return;
    setDailyStoresLoading(true);
    try {
      let nearestFirst = false;
      let repLat = 0;
      let repLng = 0;
      try {
        const pos = await getRepPosition({ timeoutMs: 12_000 });
        repLat = pos.lat;
        repLng = pos.lng;
        nearestFirst = true;
      } catch {
        // load without nearest-first sort
      }
      const data = (await apiGet("/api/v1/rep/stores/daily")) as {
        stores?: DailyStoreCard[];
        googlePlacesReady?: boolean;
        routeToday?: { dayName?: string; zoneName?: string } | null;
        message?: string;
      };
      let burqan = (data.stores ?? []) as DailyStoreCard[];
      if (nearestFirst && burqan.length > 0) {
        burqan = sortDailyStoreCardsByDistance(burqan, repLat, repLng);
      }
      setDailyStores(burqan);
      setDailyMeta({
        zoneName: data.routeToday?.zoneName,
        dayName: data.routeToday?.dayName,
        message: data.message,
        nearestFirst,
      });
      if (typeof data.googlePlacesReady === "boolean") {
        setGooglePlacesReady(data.googlePlacesReady);
      }
    } catch {
      setDailyStores([]);
      setDailyMeta(null);
    } finally {
      setDailyStoresLoading(false);
    }
  }, [apiGet, token]);

  const loadRouteStores = useCallback(async () => {
    if (!token) return;
    setRouteLoading(true);
    setRouteLocating(true);
    try {
      const pos = await getRepPosition({ timeoutMs: 20_000 });
      setRouteLocating(false);
      const [routeData, prospectData] = await Promise.all([
        apiGet(`/api/v1/rep/stores/route?lat=${pos.lat}&lng=${pos.lng}`) as Promise<{
          active?: boolean;
          dayName?: string;
          routeZone?: { id: number; name: string; notes?: string | null; areas?: string[] };
          message?: string;
          stores?: DailyStoreCard[];
        }>,
        apiGet("/api/v1/rep/prospect-stores") as Promise<{
          prospects?: Array<{
            id: number;
            name: string;
            phone: string;
            ownerName: string;
            location: { lat: number; lng: number };
            addressText?: string | null;
            areaName?: string | null;
            visitedToday?: boolean;
            todayVisitNote?: string | null;
          }>;
        }>,
      ]);
      setRouteMeta({
        active: Boolean(routeData.active),
        dayName: routeData.dayName,
        routeZone: routeData.routeZone,
        message: routeData.message,
      });
      const burqan = Array.isArray(routeData.stores) ? routeData.stores : [];
      const prospects: DailyStoreCard[] = (prospectData.prospects ?? []).map((p) => ({
        id: p.id,
        source: "prospect" as const,
        name: p.name,
        phone: p.phone,
        ownerName: p.ownerName,
        location: p.location,
        addressText: p.addressText ?? null,
        areaName: p.areaName ?? null,
        deferredPaymentEnabled: false,
        visitedToday: p.visitedToday,
        visitNote: p.todayVisitNote ?? null,
      }));
      setRouteStores(sortDailyStoreCardsByDistance([...burqan, ...prospects], pos.lat, pos.lng));
    } catch (e) {
      setRouteStores([]);
      setRouteMeta({
        active: false,
        message:
          e instanceof LocationDeniedError
            ? t.locationDenied
            : e instanceof LocationInaccurateError
              ? t.locationInaccurate(e.accuracyM)
              : e instanceof LocationTimeoutError
                ? t.locationTimeout
                : t.routeDayLoadFailed,
      });
      if (e instanceof LocationDeniedError || e instanceof LocationInaccurateError) {
        showToast(
          e instanceof LocationInaccurateError ? t.locationInaccurate(e.accuracyM) : t.locationDenied,
          "error"
        );
      }
    } finally {
      setRouteLoading(false);
      setRouteLocating(false);
      setRouteRefreshing(false);
    }
  }, [apiGet, showToast, token]);

  const loadGooglePlaces = useCallback(async () => {
    if (!token) return;
    setGooglePlacesLoading(true);
    setGoogleSearchResults(null);
    setGooglePlacesByArea({});
    setGoogleAreaLoading({});
    googleRawByAreaRef.current = {};
    try {
      const data = await apiGet("/api/v1/rep/google-places?summary=1", 45_000);
      setGooglePlacesReady(data.googlePlacesReady !== false);
      setGooglePlacesTotal(typeof data.total === "number" ? data.total : 0);

      const areas = Array.isArray(data.areas) ? (data.areas as GooglePlaceAreaSummary[]) : [];
      if (areas.length > 0) {
        setGoogleLazyApi(true);
        setGoogleAreaSummaries(areas);
        return;
      }

      const raw = (data.places ?? []) as RawGooglePlace[];
      if (raw.length > 0) {
        const grouped = groupRawGooglePlacesByArea(raw);
        setGoogleLazyApi(false);
        setGoogleAreaSummaries(grouped.summaries);
        googleRawByAreaRef.current = grouped.rawByAreaId;
        return;
      }

      setGoogleLazyApi(true);
      setGoogleAreaSummaries([]);
    } catch (e) {
      setGoogleAreaSummaries([]);
      setGooglePlacesTotal(0);
      setGooglePlacesReady(false);
      setGoogleLazyApi(true);
      googleRawByAreaRef.current = {};
      const msg = e instanceof Error ? e.message : "";
      showToast(
        msg === "network_timeout" ? t.networkTimeout : msg || t.googleTabLoadFailed,
        "error"
      );
    } finally {
      setGooglePlacesLoading(false);
    }
  }, [apiGet, showToast, token]);

  const loadGoogleArea = useCallback(
    async (areaId: number) => {
      if (!token) return;
      setGoogleAreaLoading((prev) => ({ ...prev, [areaId]: true }));
      try {
        if (!googleLazyApi) {
          const raw = googleRawByAreaRef.current[areaId] ?? [];
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          setGooglePlacesByArea((prev) =>
            prev[areaId]?.length ? prev : { ...prev, [areaId]: mapGoogleProspects(raw) }
          );
          return;
        }
        const data = await apiGet(`/api/v1/rep/google-places?areaId=${areaId}`, 30_000);
        const raw = (data.places ?? []) as RawGooglePlace[];
        setGooglePlacesByArea((prev) =>
          prev[areaId]?.length ? prev : { ...prev, [areaId]: mapGoogleProspects(raw) }
        );
      } catch {
        setGooglePlacesByArea((prev) => (prev[areaId] ? prev : { ...prev, [areaId]: [] }));
      } finally {
        setGoogleAreaLoading((prev) => ({ ...prev, [areaId]: false }));
      }
    },
    [apiGet, googleLazyApi, mapGoogleProspects, token]
  );

  const searchGooglePlaces = useCallback(
    async (query: string) => {
      if (!token) return;
      const q = query.trim();
      if (q.length < 2) {
        setGoogleSearchResults(null);
        setGoogleSearchLoading(false);
        return;
      }
      setGoogleSearchLoading(true);
      try {
        if (!googleLazyApi) {
          const needle = q.toLowerCase();
          const allRaw = Object.values(googleRawByAreaRef.current).flat();
          const hits = allRaw.filter(
            (p) =>
              p.name.toLowerCase().includes(needle) ||
              (p.addressText ?? "").toLowerCase().includes(needle)
          );
          setGoogleSearchResults(mapGoogleProspects(hits.slice(0, 200)));
          return;
        }
        const data = await apiGet(`/api/v1/rep/google-places?q=${encodeURIComponent(q)}`, 20_000);
        const raw = (data.places ?? []) as {
          id: number;
          name: string;
          addressText?: string | null;
          location: { lat: number; lng: number };
          areaName?: string | null;
          googleMapsUrl?: string | null;
          googlePlaceId?: string | null;
        }[];
        setGoogleSearchResults(mapGoogleProspects(raw));
      } catch {
        setGoogleSearchResults([]);
      } finally {
        setGoogleSearchLoading(false);
      }
    },
    [apiGet, googleLazyApi, mapGoogleProspects, token]
  );

  const clearSession = useCallback(() => {
    cancelSystemQrScanSession();
    void clearRepToken();
    setToken(null);
    setRepProfile(null);
    setProfileError(null);
    setProfileLoading(false);
    setActiveStore(null);
    setDailyStores([]);
    setGoogleAreaSummaries([]);
    setGooglePlacesByArea({});
    setGoogleAreaLoading({});
    setGoogleSearchResults(null);
    setGooglePlacesTotal(0);
    setGoogleLazyApi(true);
    googleRawByAreaRef.current = {};
    setGooglePlacesReady(true);
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
    void loadProspects();
  }, [token, loadProfile, loadInventory, loadDailyStores, loadProspects]);

  async function resolveQr(raw: string) {
    if (!token || qrResolveInFlightRef.current) return;
    if (activeStore) {
      showToast(t.closeStoreBeforeScan, "info");
      setMode("home");
      return;
    }
    const publicToken = parseQrPublicToken(raw);
    if (!publicToken || publicToken.length < 16) {
      showToast(t.qrInvalid, "error");
      return;
    }

    qrResolveInFlightRef.current = true;
    if (shouldUseSystemQrScanner()) {
      void CameraView.dismissScanner().catch(() => {});
    }
    setMode("home");
    setScanPermissionOverride(false);
    hideToast();

    try {
      const pos = await getRepPosition({ timeoutMs: 20_000 });
      setBusy(true);
      setBusyMessage(t.qrResolving);
      const { res, data } = await fetchJson<{
        status?: string;
        store?: StoreBrief;
        error?: string;
      }>(
        `${API_BASE}/api/v1/rep/qr/${encodeURIComponent(publicToken)}?lat=${pos.lat}&lng=${pos.lng}`,
        { headers, timeoutMs: 20_000 }
      );
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : t.qrFailed);

      setLastScanToken(publicToken);
      if (convertingProspectId) {
        if (data.status !== "unassigned") {
          showToast(t.prospectConvertFailed, "error");
          setConvertingProspectId(null);
          return;
        }
        const convertRes = await apiPost(`/api/v1/rep/prospect-stores/${convertingProspectId}/convert`, {
          qrPublicToken: publicToken,
          repLat: pos.lat,
          repLng: pos.lng,
        });
        const store = convertRes.store as StoreBrief | undefined;
        setConvertingProspectId(null);
        if (store) {
          setActiveStore(normalizeStoreBrief(store as Record<string, unknown>));
          setStorePointsBalance(store.loyaltyPointsBalance ?? 0);
          setRedeemCart({});
          setVisitHadOrder(false);
          setMode("store");
          setBottomTab("home");
          setStoreTab("sell");
          showToast(t.prospectConverted, "success");
          void Promise.all([refreshStoreData(store.id), loadDailyStores(), loadProspects()]);
        } else {
          showToast(t.prospectConvertFailed, "error");
          setMode("home");
        }
        return;
      }
      if (data.status === "unassigned") {
        setActiveStore(null);
        setBottomTab("home");
        cancelSystemQrScanSession();
        setScanPermissionOverride(false);
        await new Promise<void>((resolve) => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
        if (Platform.OS === "android") {
          await new Promise((r) => setTimeout(r, 350));
        }
        setMode("register");
      } else if (data.store) {
        const store = normalizeStoreBrief(data.store as Record<string, unknown>);
        setActiveStore(store);
        setStorePointsBalance(store.loyaltyPointsBalance ?? 0);
        setRedeemCart({});
        setVisitHadOrder(false);
        setMode("store");
        setBottomTab("home");
        setStoreTab("sell");
        showToast(t.visitRecorded, "success");
        void Promise.all([refreshStoreData(store.id), loadDailyStores()]);
      } else {
        throw new Error(t.qrFailed);
      }
    } catch (e) {
      if (e instanceof LocationDeniedError) showToast(t.locationDenied, "error");
      else if (e instanceof LocationInaccurateError) showToast(t.locationInaccurate(e.accuracyM), "error");
      else if (e instanceof LocationTimeoutError) showToast(t.locationTimeout, "error");
      else if (e instanceof Error && e.message === "network_timeout") showToast(t.networkTimeout, "error");
      else showToast(e instanceof Error ? e.message : t.qrFailed, "error");
    } finally {
      setBusy(false);
      setBusyMessage(null);
      qrResolveInFlightRef.current = false;
    }
  }

  /** iPhone/Android: native full-screen QR UI when available; otherwise in-app camera modal. */
  async function openQrScanner() {
    hideToast();
    if (activeStore) {
      showToast(t.closeStoreBeforeScan, "info");
      return;
    }
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

    const locOk = await ensureLocationPermission();
    if (!locOk) {
      showToast(t.locationDenied, "error");
    } else {
      void warmRepPosition().catch(() => {});
    }

    if (shouldUseSystemQrScanner()) {
      presentSystemQrScanner((data) => {
        if (qrResolveInFlightRef.current) return;
        void resolveQr(data);
      });
      return;
    }

    setMode("scan");
  }

  const refreshStoreData = useCallback(
    async (storeId: number) => {
      const loadInventory = async () => {
        const inv = await apiGet("/api/v1/rep/inventory");
        const rows = (inv.inventory ?? []) as Parameters<typeof mapProductRow>[0][];
        const mapped = rows.map(mapProductRow).filter((r) => r.quantity > 0);
        setProducts(mapped);
        setInventory(mapped);
      };
      const loadProfile = async () => {
        const data = (await apiGet(`/api/v1/rep/stores/${storeId}`)) as { store?: Record<string, unknown> };
        if (!data.store) return;
        const store = normalizeStoreBrief(data.store);
        setActiveStore((prev) => (prev?.id === storeId ? { ...prev, ...store } : prev));
        if (store.loyaltyPointsBalance != null) {
          setStorePointsBalance(store.loyaltyPointsBalance);
        }
      };
      await Promise.all([loadInventory().catch(() => {}), loadProfile().catch(() => {})]);
    },
    [apiGet]
  );

  const loadStoreProfile = useCallback(
    async (storeId: number) => {
      const data = (await apiGet(`/api/v1/rep/stores/${storeId}`)) as { store?: Record<string, unknown> };
      if (!data.store) return null;
      return normalizeStoreBrief(data.store);
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
      await Promise.all([loadInventory(), loadProfile(), loadDailyStores(), loadProspects()]);
      if (activeStore) await refreshStoreData(activeStore.id);
    } catch {
      /* ignore */
    } finally {
      setHomeRefreshing(false);
    }
  }, [token, activeStore, refreshStoreData, loadInventory, loadProfile, loadDailyStores, loadProspects]);

  useEffect(() => {
    if (token && bottomTab === "home" && mode !== "store" && mode !== "register" && mode !== "prospect-add") {
      void loadDailyStores();
      void loadProspects();
    }
  }, [token, bottomTab, mode, loadDailyStores, loadProspects]);

  useEffect(() => {
    if (token && bottomTab === "route" && mode !== "store" && mode !== "register") {
      void loadRouteStores();
    }
  }, [token, bottomTab, mode, loadRouteStores]);

  useEffect(() => {
    if (token && bottomTab === "google" && mode !== "store" && mode !== "register") {
      void loadGooglePlaces();
    }
  }, [token, bottomTab, mode, loadGooglePlaces]);

  const onGoogleRefresh = useCallback(async () => {
    if (!token) return;
    setGoogleRefreshing(true);
    try {
      await loadGooglePlaces();
    } finally {
      setGoogleRefreshing(false);
    }
  }, [token, loadGooglePlaces]);

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
      const data = (await apiPost("/api/v1/rep/orders", {
        storeId: activeStore.id,
        paymentType,
        lines,
        repLat: pos.lat,
        repLng: pos.lng,
      })) as {
        orderId?: string;
        totalAmount?: number;
        paymentType?: string;
        storeName?: string;
        lines?: { productName: string; quantity: number; unitPrice: number; lineTotal: number }[];
      };
      const receiptLines =
        data.lines?.map((l) => ({
          productName: l.productName,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })) ??
        cartLines.map(({ product, qty }) => ({
          productName: product.name,
          quantity: qty,
          unitPrice: parseFloat(product.price) || 0,
          lineTotal: (parseFloat(product.price) || 0) * qty,
        }));
      const total =
        typeof data.totalAmount === "number"
          ? data.totalAmount
          : receiptLines.reduce((s, l) => s + l.lineTotal, 0);
      setOrderReceipt({
        orderId: String(data.orderId ?? ""),
        storeName: data.storeName ?? activeStore.name,
        paymentLabel: formatPaymentType(data.paymentType ?? paymentType),
        currency: t.currency,
        lines: receiptLines,
        totalAmount: total,
        createdAt: new Date(),
      });
      setCart({});
      setVisitHadOrder(true);
      setOrderConfirmOpen(false);
      setOrderReceiptOpen(true);
      await Promise.all([refreshStoreData(activeStore.id), loadInventory()]);
    } catch (e) {
      if (e instanceof LocationDeniedError) showToast(t.locationDenied, "error");
      else if (e instanceof LocationInaccurateError) showToast(t.locationInaccurate(e.accuracyM), "error");
      else if (e instanceof LocationTimeoutError) showToast(t.locationTimeout, "error");
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
    sell: t.tabSell,
    redeem: t.tabRedeem,
  };

  const redeemCartCount = useMemo(
    () => Object.values(redeemCart).reduce((sum, q) => sum + q, 0),
    [redeemCart]
  );

  const cartItemCount = useMemo(
    () => Object.values(cart).reduce((sum, q) => sum + q, 0),
    [cart]
  );

  const loadPrizes = useCallback(async () => {
    if (!token || !activeStore) return;
    try {
      const data = await apiGet(`/api/v1/rep/stores/${activeStore.id}/prizes`);
      type PrizeRow = PrizeProduct & { imageUrl?: string | null; unitLabel?: string | null };
      const rows = ((data.products ?? []) as PrizeRow[]).map((p) => ({
        id: p.id,
        name: p.name,
        designation: p.designation ?? null,
        unit_label: p.unitLabel ?? p.unit_label ?? null,
        image_url: p.imageUrl ?? p.image_url ?? null,
        redeemPointsPerUnit: p.redeemPointsPerUnit,
      }));
      setPrizeProducts(rows);
      setStorePointsBalance(Number(data.loyaltyPointsBalance) || activeStore.loyaltyPointsBalance || 0);
    } catch {
      setPrizeProducts([]);
    }
  }, [apiGet, token, activeStore]);

  useEffect(() => {
    if (storeTab === "redeem" && activeStore) void loadPrizes();
  }, [storeTab, activeStore, loadPrizes]);

  useEffect(() => {
    if (storeTab !== "info" || !activeStore?.id || !token) return;
    void loadStoreProfile(activeStore.id).then((store) => {
      if (!store) return;
      setActiveStore((prev) => (prev?.id === store.id ? { ...prev, ...store } : prev));
    });
  }, [storeTab, activeStore?.id, loadStoreProfile, token]);

  useEffect(() => {
    if (mode !== "store" || !activeStore?.id || !token) return;
    void refreshStoreData(activeStore.id);
  }, [mode, activeStore?.id, refreshStoreData, token]);

  const redeemCartTotal = useMemo(() => {
    return Object.entries(redeemCart).reduce((sum, [pid, qty]) => {
      const p = prizeProducts.find((x) => x.id === parseInt(pid, 10));
      return sum + (p?.redeemPointsPerUnit ?? 0) * qty;
    }, 0);
  }, [redeemCart, prizeProducts]);

  async function submitRedeem() {
    if (!activeStore) return;
    const lines = Object.entries(redeemCart)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId: parseInt(productId, 10), quantity }));
    if (!lines.length) {
      showToast(t.redeemAddItems, "info");
      return;
    }
    if (redeemCartTotal > storePointsBalance) {
      showToast(t.redeemInsufficient, "error");
      return;
    }
    setBusy(true);
    try {
      const pos = await getRepPosition({ timeoutMs: 20_000 });
      const res = await apiPost("/api/v1/rep/prize-redemptions", {
        storeId: activeStore.id,
        lines,
        repLat: pos.lat,
        repLng: pos.lng,
      });
      setRedeemCart({});
      const bal = Number(res.loyaltyPointsBalance);
      if (!Number.isNaN(bal)) {
        setStorePointsBalance(bal);
        setActiveStore((s) => (s ? { ...s, loyaltyPointsBalance: bal } : s));
      }
      showToast(t.redeemSaved, "success");
      void loadPrizes();
    } catch (e) {
      if (e instanceof LocationDeniedError) showToast(t.locationDenied, "error");
      else if (e instanceof LocationInaccurateError) showToast(t.locationInaccurate(e.accuracyM), "error");
      else if (e instanceof LocationTimeoutError) showToast(t.locationTimeout, "error");
      else showToast(e instanceof Error ? e.message : t.redeemFailed, "error");
    } finally {
      setBusy(false);
    }
  }

  function setRedeemQty(pid: number, delta: number) {
    const p = prizeProducts.find((x) => x.id === pid);
    if (!p) return;
    setRedeemCart((c) => {
      const q = (c[pid] ?? 0) + delta;
      const next = { ...c };
      if (q <= 0) delete next[pid];
      else next[pid] = q;
      return next;
    });
  }

  const endStoreSession = useCallback(() => {
    setActiveStore(null);
    setCart({});
    setRedeemCart({});
    setPrizeProducts([]);
    setVisitHadOrder(false);
    setOrderReceipt(null);
    setOrderReceiptOpen(false);
    setMode("home");
    setEndVisitOpen(false);
    void loadDailyStores();
  }, [loadDailyStores]);

  const noPurchaseEndVisit = cartItemCount === 0 && !visitHadOrder && endVisitNoBuyRequired;

  const openEndVisit = useCallback(async () => {
    if (!activeStore) return;
    let noBuyRequired = cartItemCount === 0 && !visitHadOrder;
    try {
      const data = (await apiGet(`/api/v1/rep/stores/${activeStore.id}/today-visit-status`)) as {
        hadOrderToday?: boolean;
        requiresNoBuyReason?: boolean;
      };
      if (data.hadOrderToday) {
        setVisitHadOrder(true);
        noBuyRequired = false;
      } else if (typeof data.requiresNoBuyReason === "boolean") {
        noBuyRequired = cartItemCount === 0 && data.requiresNoBuyReason;
      }
    } catch {
      noBuyRequired = cartItemCount === 0 && !visitHadOrder;
    }
    setEndVisitNoBuyRequired(noBuyRequired);
    setEndVisitOpen(true);
  }, [activeStore, apiGet, cartItemCount, visitHadOrder]);

  const confirmEndVisit = useCallback(
    async (payload: { note: string; kind: EndVisitReasonKind }) => {
      if (!activeStore) return;
      const trimmed = payload.note.trim();
      if (payload.kind === "no-buy-reason" && !trimmed) {
        showToast(t.visitEndNoBuyNoteRequired, "error");
        return;
      }
      setEndVisitBusy(true);
      try {
        if (trimmed || payload.kind === "no-buy-reason") {
          await apiPatch(`/api/v1/rep/stores/${activeStore.id}/today-visit-note`, {
            note: trimmed || null,
            kind: payload.kind,
          });
        }
        endStoreSession();
      } catch (e) {
        showToast(e instanceof Error ? e.message : t.visitEndNoteFailed, "error");
      } finally {
        setEndVisitBusy(false);
      }
    },
    [activeStore, apiPatch, endStoreSession, showToast]
  );

  useEffect(() => {
    const prospect = peekProspect;
    if (!prospect || !token || prospect.visitedToday) return;
    void (async () => {
      try {
        const pos = await getRepPosition({ timeoutMs: 12_000 });
        await apiPost(`/api/v1/rep/prospect-stores/${prospect.id}/visits`, {
          repLat: pos.lat,
          repLng: pos.lng,
        });
        setPeekProspect((p) => (p && p.id === prospect.id ? { ...p, visitedToday: true } : p));
        setProspects((prev) =>
          prev.map((p) => (p.id === prospect.id ? { ...p, visitedToday: true } : p))
        );
      } catch {
        // Visit can be recorded when ending the visit.
      }
    })();
  }, [apiPost, peekProspect?.id, peekProspect?.visitedToday, token]);

  const openProspectEndVisit = useCallback(
    async (p: ProspectCard) => {
      let requiresReason = true;
      try {
        const data = (await apiGet(`/api/v1/rep/prospect-stores/${p.id}/today-visit-status`)) as {
          requiresNotRegisterReason?: boolean;
        };
        requiresReason = Boolean(data.requiresNotRegisterReason);
      } catch {
        requiresReason = Boolean(p.visitedToday);
      }
      setProspectEndVisitRequiresReason(requiresReason);
      setProspectEndVisitTarget(p);
      setProspectEndVisitOpen(true);
    },
    [apiGet]
  );

  const confirmProspectEndVisit = useCallback(
    async (payload: { note: string; kind: EndVisitReasonKind }) => {
      const target = prospectEndVisitTarget;
      if (!target) return;
      const trimmed = payload.note.trim();
      if (payload.kind === "not-register-reason" && !trimmed) {
        showToast(t.prospectEndNoteRequired, "error");
        return;
      }
      if (!prospectEndVisitRequiresReason && !trimmed) {
        setProspectEndVisitOpen(false);
        setProspectEndVisitTarget(null);
        setPeekProspect(null);
        return;
      }
      setProspectEndVisitBusy(true);
      try {
        const pos = await getRepPosition({ timeoutMs: 20_000 });
        if (prospectEndVisitRequiresReason || trimmed) {
          if (target.visitedToday) {
            await apiPatch(`/api/v1/rep/prospect-stores/${target.id}/today-visit-note`, {
              note: trimmed || null,
              kind: payload.kind,
            });
          } else {
            await apiPost(`/api/v1/rep/prospect-stores/${target.id}/visits`, {
              repLat: pos.lat,
              repLng: pos.lng,
              note: trimmed || null,
              kind: payload.kind,
            });
          }
        } else if (!target.visitedToday) {
          await apiPost(`/api/v1/rep/prospect-stores/${target.id}/visits`, {
            repLat: pos.lat,
            repLng: pos.lng,
          });
        }
        setProspectEndVisitOpen(false);
        setProspectEndVisitTarget(null);
        setPeekProspect(null);
        void loadProspects();
        void loadDailyStores();
      } catch (e) {
        if (e instanceof LocationDeniedError) showToast(t.locationDenied, "error");
        else if (e instanceof LocationInaccurateError) showToast(t.locationInaccurate(e.accuracyM), "error");
        else if (e instanceof LocationTimeoutError) showToast(t.locationTimeout, "error");
        else showToast(e instanceof Error ? e.message : t.prospectVisitRecordFailed, "error");
      } finally {
        setProspectEndVisitBusy(false);
      }
    },
    [
      apiPatch,
      apiPost,
      loadDailyStores,
      loadProspects,
      prospectEndVisitRequiresReason,
      prospectEndVisitTarget,
      showToast,
    ]
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

  const cartTotalAmount = useMemo(
    () =>
      cartLines.reduce((sum, { product, qty }) => sum + (parseFloat(product.price) || 0) * qty, 0),
    [cartLines]
  );

  const storeTabOrder = ["sell", "info", "redeem"] as const;

  const productDetailLabels = useMemo(
    () => ({
      close: t.close,
      priceLabel: t.priceLabel,
      unit: t.unit,
      stock: t.stock,
      vanStock: t.vanStock,
      description: t.description,
      productCode: t.productCode,
      specsTitle: t.specsTitle,
      cartonSpec: t.cartonSpec,
      dimensions: t.dimensions,
      cartonWeight: t.cartonWeight,
      notSpecified: t.notSpecified,
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
        <View style={styles.mainShell}>
          <View style={[styles.header, pageFrameStyle, styles.headerFrame]}>
            <View style={styles.headerStart}>
              <Image source={require("./assets/burqanlogo.png")} style={styles.logoHeader} resizeMode="contain" />
              {bottomTab === "home" && repProfile?.fullName ? (
                <View style={styles.headerText}>
                  <Text style={styles.headerGreeting}>
                    {t.welcome(repProfile.fullName.trim().split(/\s+/)[0] ?? repProfile.fullName)}
                  </Text>
                  <Text style={styles.headerSub}>{t.homeSubtitle}</Text>
                </View>
              ) : bottomTab === "route" ? (
                <View style={styles.headerText}>
                  <Text style={styles.headerGreeting}>{t.routeDayTitle}</Text>
                  <Text style={styles.headerSub}>{t.routeDaySubtitle}</Text>
                </View>
              ) : bottomTab === "google" ? (
                <View style={styles.headerText}>
                  <Text style={styles.headerGreeting}>{t.navGoogle}</Text>
                  <Text style={styles.headerSub}>{t.googleTabLazyHint}</Text>
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

          {bottomTab === "store" ? (
            <View style={[styles.flexTab, pageFrameStyle]}>
              <View style={styles.screenHeader}>
                <Text style={styles.screenTitle}>{t.navStore}</Text>
                {catalogDisplay.length > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{t.productsBadge(catalogDisplay.length)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.muted, styles.catalogHint]}>{t.catalogStockHint}</Text>
              <ProductCatalogGrid
                products={catalogDisplay}
                columns={productGrid.columns}
                cardWidth={productGrid.cardWidth}
                gap={productGrid.gap}
                currency={t.currency}
                noImage={t.noImage}
                emptyLabel={t.catalogEmpty}
                refreshing={storeRefreshing}
                onRefresh={() => {
                  setStoreRefreshing(true);
                  void Promise.all([loadCatalog(), loadInventory()]).finally(() => setStoreRefreshing(false));
                }}
                onSelect={setSelectedProduct}
              />
            </View>
          ) : bottomTab === "inventory" ? (
            <View style={[styles.flexTab, pageFrameStyle]}>
              <View style={[styles.card, styles.cardFlex]}>
                <Text style={styles.cardTitle}>{t.inventoryTitle}</Text>
                <InventoryList
                  items={inventory}
                  emptyLabel={t.inventoryEmpty}
                  renderCard={renderInventoryCard}
                />
              </View>
            </View>
          ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.page, pageFrameStyle, { paddingBottom: insets.bottom + 88 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            bottomTab === "home" && mode === "home" ? (
              <RefreshControl refreshing={homeRefreshing} onRefresh={onHomeRefresh} tintColor={accent} colors={[accent]} />
            ) : bottomTab === "google" ? (
              <RefreshControl refreshing={googleRefreshing} onRefresh={onGoogleRefresh} tintColor="#ea580c" colors={["#ea580c"]} />
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
      {bottomTab === "home" && mode !== "store" && mode !== "register" && mode !== "prospect-add" && !activeStore && (
        <>
          <View style={styles.card}>
            <Pressable style={styles.scanPrimary} onPress={() => void openQrScanner()}>
              <Text style={styles.scanPrimaryText}>{t.openScanner}</Text>
            </Pressable>
            {convertingProspectId ? (
              <Text style={styles.prospectLinkHint}>{t.prospectLinkScanHint}</Text>
            ) : null}
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

          <PossibleClientsSection
            prospects={prospects}
            loading={prospectsLoading}
            labels={{
              title: t.prospectsTitle,
              hint: t.prospectsHint,
              empty: t.prospectsEmpty,
              add: t.prospectsAdd,
              linkQr: t.prospectsLinkQr,
              visited: t.prospectsVisited,
              pending: t.prospectsPending,
              searchPlaceholder: t.prospectsSearch,
              pill: t.prospectsPill,
            }}
            onAdd={() => setMode("prospect-add")}
            onSelect={setPeekProspect}
            onLinkQr={(p) => {
              setConvertingProspectId(p.id);
              showToast(t.prospectLinkScanHint, "info");
              void openQrScanner();
            }}
          />

          <DailyStoresByArea
            stores={dailyStores}
            repAreaNames={repAreaNames}
            loading={dailyStoresLoading}
            title={dailyMeta?.zoneName ?? t.dailyStoresTitle}
            zoneName={dailyMeta?.zoneName}
            dayName={dailyMeta?.dayName}
            nearestFirst={dailyMeta?.nearestFirst}
            labels={{
              hint: dailyMeta?.message ?? t.dailyStoresHint,
              empty: dailyMeta?.message ?? t.dailyStoresEmpty,
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
              visitQr: t.dailyStoresVisitQr,
              nearestFirst: t.dailyStoresNearestFirst,
              refreshLocation: t.refreshLocationCurrent,
            }}
            locating={dailyStoresLoading}
            onRefreshLocation={() => void loadDailyStores()}
            onSelectStore={setPeekStore}
          />
        </>
      )}

      {bottomTab === "route" && mode !== "store" && mode !== "register" && (
        <RouteDayStores
          stores={routeStores}
          meta={routeMeta}
          loading={routeLoading}
          locating={routeLocating}
          refreshing={routeRefreshing}
          labels={{
            title: t.routeDayTitle,
            subtitle: t.routeDaySubtitle,
            today: t.routeDayToday,
            areasIncluded: t.routeDayAreas,
            storesCount: t.routeDayStoresCount,
            possibleCount: t.routeDayPossibleCount,
            possiblePill: t.routeDayPossiblePill,
            nearestFirst: t.routeDayNearest,
            empty: t.routeDayEmpty,
            noSchedule: t.routeDayNoSchedule,
            noZoneAreas: t.routeDayNoZoneAreas,
            locating: t.locating,
            locationDenied: t.locationDenied,
            loadFailed: t.routeDayLoadFailed,
            visited: t.dailyStoresVisited,
            pending: t.dailyStoresPending,
            searchPlaceholder: t.dailyStoresSearchPlaceholder,
            filterAll: t.dailyStoresFilterAll,
            filterPending: t.dailyStoresFilterPending,
            filterDone: t.dailyStoresFilterDone,
            noSearchResults: t.dailyStoresNoSearchResults,
            refreshLocation: t.refreshLocationCurrent,
          }}
          onRefresh={() => {
            setRouteRefreshing(true);
            void loadRouteStores();
          }}
          onRefreshLocation={() => {
            setRouteRefreshing(true);
            void loadRouteStores();
          }}
          onSelectStore={(s) => {
            if (s.source === "prospect") {
              setPeekProspect({
                id: s.id,
                name: s.name,
                phone: s.phone,
                ownerName: s.ownerName,
                location: s.location,
                addressText: s.addressText,
                areaName: s.areaName,
                visitedToday: s.visitedToday,
                todayVisitNote: s.visitNote ?? null,
              });
              return;
            }
            setPeekStore(s);
          }}
        />
      )}

      {bottomTab === "google" && mode !== "store" && mode !== "register" && (
        <GooglePlacesByArea
          areaSummaries={googleAreaSummaries}
          placesByAreaId={googlePlacesByArea}
          loadingAreaIds={googleAreaLoading}
          searchResults={googleSearchResults}
          searchLoading={googleSearchLoading}
          repAreaNames={repAreaNames}
          loading={googlePlacesLoading}
          notReady={!googlePlacesReady}
          totalCount={googlePlacesTotal}
          title={t.googleTabTitle}
          labels={{
            hint: t.googleTabHint,
            lazyHint: t.googleTabLazyHint,
            empty: t.googleTabEmpty,
            notReady: t.googleTabNotReady,
            truncated: t.googleTabTruncated,
            unknownArea: t.dailyStoresUnknownArea,
            storeCount: t.dailyStoresAreaCount,
            searchPlaceholder: t.googleTabSearchPlaceholder,
            expandAll: t.dailyStoresExpandAll,
            collapseAll: t.dailyStoresCollapseAll,
            noSearchResults: t.dailyStoresNoSearchResults,
            googlePill: t.googleTabPill,
            openMaps: t.googleTabOpenMaps,
            loadingArea: t.googleTabLoadingArea,
          }}
          onSelectPlace={setPeekStore}
          onExpandArea={loadGoogleArea}
          onSearch={searchGooglePlaces}
        />
      )}

      {bottomTab === "home" && activeStore && mode !== "store" && mode !== "register" && (
        <Pressable style={styles.resumeCard} onPress={() => setMode("store")}>
          <View style={styles.resumeBody}>
            <Text style={styles.resumeHint}>{t.resumeOpenVisit}</Text>
            <Text style={styles.resumeName}>{activeStore.name}</Text>
            <Text style={styles.resumeMeta}>{activeStore.ownerName}</Text>
          </View>
          <Text style={styles.resumeArrow}>‹</Text>
        </Pressable>
      )}

      {bottomTab === "home" && mode === "store" && activeStore && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{activeStore.name}</Text>
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
            {storeTabOrder.map((tab) => (
              <Pressable key={tab} style={[styles.tab, storeTab === tab && styles.tabOn]} onPress={() => setStoreTab(tab)}>
                <Text style={[styles.tabText, storeTab === tab && styles.tabTextOn]}>
                  {tabLabels[tab]}
                  {tab === "sell" && cartItemCount > 0 ? ` (${cartItemCount})` : ""}
                  {tab === "redeem" && redeemCartCount > 0 ? ` (${redeemCartCount})` : ""}
                </Text>
              </Pressable>
            ))}
          </View>

          {storeTab === "info" && (
            <View style={styles.panel}>
              {activeStore.imageUrl ? (
                <Image
                  source={{ uri: productImageUrl(activeStore.imageUrl) }}
                  style={styles.storeInfoImage}
                  resizeMode="cover"
                />
              ) : null}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.storeName}</Text>
                <Text style={styles.infoValue}>{activeStore.name || "—"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.ownerName}</Text>
                <Text style={styles.infoValue}>{activeStore.ownerName || "—"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.area}</Text>
                <Text style={styles.infoValue}>{activeStore.areaName || t.dailyStoresUnknownArea}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.phone}</Text>
                <Pressable
                  style={styles.infoLtrWrap}
                  onPress={() => void Linking.openURL(`tel:${activeStore.phone}`)}
                >
                  <Text style={[styles.infoValue, styles.infoValueLtr, styles.link]} numberOfLines={2}>
                    {activeStore.phone || "—"}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.address}</Text>
                <Text style={styles.infoValue}>{activeStore.addressText?.trim() || "—"}</Text>
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
              <Pressable
                style={[styles.secondary, { marginTop: 16 }]}
                onPress={() => setEditStoreOpen(true)}
              >
                <Text style={styles.secondaryText}>{t.editStore}</Text>
              </Pressable>
              <Pressable style={[styles.primary, { marginTop: 12 }]} onPress={() => setStoreTab("sell")}>
                <Text style={styles.primaryText}>{t.startOrder}</Text>
              </Pressable>
            </View>
          )}

          {storeTab === "redeem" && (
            <View style={styles.panel}>
              <View style={styles.redeemBalanceBox}>
                <Text style={styles.redeemBalanceLabel}>{t.redeemBalance}</Text>
                <Text style={styles.redeemBalanceValue}>{storePointsBalance}</Text>
              </View>
              {prizeProducts.length === 0 ? (
                <Text style={styles.emptyText}>{t.redeemEmpty}</Text>
              ) : null}
              {prizeProducts.map((item) => {
                const q = redeemCart[item.id] ?? 0;
                const linePts = item.redeemPointsPerUnit * q;
                return (
                  <ProductCard
                    key={item.id}
                    item={{
                      id: item.id,
                      name: item.name,
                      price: String(item.redeemPointsPerUnit),
                      designation: item.designation ?? null,
                      unit_label: item.unit_label ?? null,
                      image_url: item.image_url ?? null,
                      quantity: 0,
                    }}
                    mode="redeem"
                    cartQty={q}
                    redeemLinePoints={linePts}
                    onMinus={() => setRedeemQty(item.id, -1)}
                    onPlus={() => setRedeemQty(item.id, 1)}
                  />
                );
              })}
              {redeemCartCount > 0 ? (
                <>
                  <Text style={styles.redeemCartTotal}>{t.redeemCartPoints(redeemCartTotal)}</Text>
                  <Pressable
                    style={[styles.primary, styles.primaryLg, redeemCartTotal > storePointsBalance && { opacity: 0.5 }]}
                    onPress={() => void submitRedeem()}
                  >
                    <Text style={styles.primaryText}>{t.submitRedeem}</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          )}

          {storeTab === "sell" && (
            <View style={styles.panel}>
              {products.length === 0 ? (
                <Text style={styles.emptyText}>{t.sellEmpty}</Text>
              ) : (
                products.map((item) => {
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
                })
              )}
              {cartLines.length === 0 && products.length > 0 ? (
                <Text style={styles.muted}>{t.cartEmptyHint}</Text>
              ) : null}
              {cartLines.length > 0 ? (
                <StoreCartPanel
                  lines={cartLines}
                  paymentType={paymentType}
                  deferredEnabled={activeStore.deferredPaymentEnabled}
                  totalAmount={cartTotalAmount}
                  labels={{
                    cartTitle: t.cartTitle,
                    cartEmpty: t.cartEmptyHint,
                    payment: t.payment,
                    cash: t.cash,
                    deferredPay: t.deferredPay,
                    submitOrder: t.submitOrder,
                    total: t.invoiceTotal,
                    currency: t.currency,
                    qty: t.invoiceQty,
                  }}
                  onPaymentChange={setPaymentType}
                  onSubmit={() => setOrderConfirmOpen(true)}
                />
              ) : null}
            </View>
          )}

          <EndVisitBar
            title={t.endVisitBtn}
            subtitle={t.endVisitBtnSub}
            onPress={() => void openEndVisit()}
          />

          {editStoreOpen && (
            <Suspense fallback={null}>
              <EditStoreForm
                visible={editStoreOpen}
                store={activeStore}
                headers={headers}
                apiBase={API_BASE}
                authToken={token!}
                onClose={() => setEditStoreOpen(false)}
                onNotice={(msg) => showToast(msg, "info")}
                onSaved={(store) => {
                  setActiveStore(normalizeStoreBrief(store as unknown as Record<string, unknown>));
                  setEditStoreOpen(false);
                  showToast(t.storeUpdated, "success");
                  void loadDailyStores();
                }}
              />
            </Suspense>
          )}
        </View>
      )}

      {mode === "prospect-add" && token && bottomTab === "home" && (
        <RegisterErrorBoundary
          onBack={() => {
            setMode("home");
          }}
        >
          <Suspense
            fallback={
              <View style={styles.center}>
                <ActivityIndicator color={accent} size="large" />
              </View>
            }
          >
            <ProspectStoreForm
              headers={headers}
              apiBase={API_BASE}
              authToken={token}
              onNotice={(msg) => showToast(msg, "info")}
              onDone={(msg, success) => {
                showToast(msg, success ? "success" : "error");
                setMode("home");
                if (success) void loadProspects();
              }}
            />
          </Suspense>
        </RegisterErrorBoundary>
      )}

      {mode === "register" && lastScanToken && token && bottomTab === "home" && (
        <RegisterErrorBoundary
          onBack={() => {
            setMode("home");
            setLastScanToken(null);
          }}
        >
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
                  const normalized = normalizeStoreBrief(store as unknown as Record<string, unknown>);
                  setActiveStore(normalized);
                  setStorePointsBalance(normalized.loyaltyPointsBalance ?? 0);
                  setMode("store");
                  setBottomTab("home");
                  setStoreTab("sell");
                  await Promise.all([refreshStoreData(normalized.id), loadDailyStores()]);
                } else {
                  setMode("home");
                  setBottomTab("home");
                  setLastScanToken(null);
                }
              }}
            />
          </Suspense>
        </RegisterErrorBoundary>
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

      </ScrollView>
          )}
        </View>
        <Modal
          visible={mode === "scan"}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => {
            cancelSystemQrScanSession();
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
                  <View style={styles.cameraWarmup} pointerEvents="none">
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.cameraWarmupText}>{t.cameraPreviewWait}</Text>
                  </View>
                ) : (
                  <>
                    <CameraView
                      style={
                        Platform.OS === "ios"
                          ? StyleSheet.absoluteFillObject
                          : { width: winW, height: embeddedCameraHeight }
                      }
                      facing="back"
                      {...(Platform.OS === "ios" ? { active: true } : {})}
                      {...(Platform.OS === "android" ? { ratio: "16:9" as const } : {})}
                      barcodeScannerSettings={{ barcodeTypes: [...IN_APP_QR_BARCODE_TYPES] }}
                      onCameraReady={() => setCameraPreviewReady(true)}
                      onMountError={(e) => {
                        showToast(`${t.cameraMountError} ${toArabicUserMessage(e.message, t.genericError)}`, "error");
                      }}
                      onBarcodeScanned={
                        inAppScanEnabled
                          ? ({ data }) => {
                              if (qrResolveInFlightRef.current) return;
                              const now = Date.now();
                              if (now - lastBarcodeAtRef.current < 1200) return;
                              lastBarcodeAtRef.current = now;
                              cancelSystemQrScanSession();
                              void resolveQr(data);
                            }
                          : undefined
                      }
                    />
                    {!cameraPreviewReady && (
                      <View style={styles.cameraWarmup} pointerEvents="none">
                        <ActivityIndicator size="large" color="#fff" />
                      </View>
                    )}
                  </>
                )}
                <Pressable
                  style={styles.closeScan}
                  onPress={() => {
                    cancelSystemQrScanSession();
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
            <View style={styles.busyCard}>
              <ActivityIndicator size="large" color={accent} />
              {busyMessage ? <Text style={styles.busyMessage}>{busyMessage}</Text> : null}
            </View>
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
            active={bottomTab === "route"}
            label={t.navRoute}
            icon="navigate-outline"
            iconActive="navigate"
            activeColor="#0d9488"
            activeBg="#ccfbf1"
            onPress={() => {
              setBottomTab("route");
              if (mode === "store") setMode("home");
              void loadRouteStores();
            }}
          />
          <BottomNavItem
            active={bottomTab === "google"}
            label={t.navGoogle}
            icon="map-outline"
            iconActive="map"
            activeColor="#ea580c"
            activeBg="#ffedd5"
            onPress={() => {
              setBottomTab("google");
              if (mode === "store") setMode("home");
              void loadGooglePlaces();
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
      <OrderConfirmModal
        visible={orderConfirmOpen}
        storeName={activeStore?.name ?? ""}
        lines={cartLines}
        paymentType={paymentType}
        totalAmount={cartTotalAmount}
        busy={busy}
        labels={{
          title: t.orderConfirmTitle,
          subtitle: t.orderConfirmSubtitle,
          store: t.orderConfirmStore,
          product: t.invoiceProduct,
          qty: t.invoiceQty,
          lineTotal: t.invoiceLineTotal,
          total: t.invoiceTotal,
          payment: t.payment,
          cash: t.cash,
          deferredPay: t.deferredPay,
          currency: t.currency,
          cancel: t.orderConfirmCancel,
          confirm: t.orderConfirmSubmit,
        }}
        onCancel={() => setOrderConfirmOpen(false)}
        onConfirm={() => void submitOrder()}
      />
      <OrderInvoiceModal
        visible={orderReceiptOpen}
        receipt={orderReceipt}
        labels={{
          title: t.invoiceTitle,
          orderNo: t.invoiceOrderNo,
          payment: t.payment,
          product: t.invoiceProduct,
          qty: t.invoiceQty,
          unitPrice: t.priceLabel,
          lineTotal: t.invoiceLineTotal,
          total: t.invoiceTotal,
          print: t.invoicePrint,
          close: t.invoiceClose,
          printFailed: t.invoicePrintFailed,
          currency: t.currency,
        }}
        onClose={() => {
          setOrderReceiptOpen(false);
          setOrderReceipt(null);
          setStoreTab("sell");
        }}
        onNotice={(msg, kind) => showToast(msg, kind ?? "info")}
      />
      <EndVisitModal
        visible={endVisitOpen}
        cartItemCount={cartItemCount}
        noBuyReasonRequired={noPurchaseEndVisit}
        busy={endVisitBusy}
        labels={{
          title: t.visitEndTitle,
          message: noPurchaseEndVisit ? t.visitEndNoBuyMessage : t.visitEndMessage,
          messageCart: t.visitEndMessageCart,
          noteLabel: noPurchaseEndVisit ? t.visitEndNoBuyNoteLabel : t.visitEndNoteLabel,
          notePlaceholder: t.visitEndNotePlaceholder,
          pickReasonHint: noPurchaseEndVisit ? t.visitEndNoBuyPickHint : undefined,
          modeVisitNote: t.visitEndModeNote,
          modeNoBuy: t.visitEndModeNoBuy,
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
        onConfirm={(payload) => void confirmEndVisit(payload)}
      />
      <EndVisitModal
        visible={prospectEndVisitOpen}
        cartItemCount={0}
        noBuyReasonRequired={prospectEndVisitRequiresReason}
        fixedReasons={NOT_REGISTER_REASONS}
        requiredReasonKind="not-register-reason"
        busy={prospectEndVisitBusy}
        labels={{
          title: t.prospectEndTitle,
          message: t.prospectEndMessage,
          messageCart: t.visitEndMessageCart,
          noteLabel: t.prospectEndNoteLabel,
          notePlaceholder: t.visitEndNotePlaceholder,
          pickReasonHint: t.prospectEndPickHint,
          modeVisitNote: t.visitEndModeNote,
          modeNoBuy: t.prospectEndMode,
          stay: t.visitEndStay,
          goCart: t.visitEndGoCart,
          confirm: t.visitEndConfirm,
        }}
        onStay={() => {
          setProspectEndVisitOpen(false);
          setProspectEndVisitTarget(null);
        }}
        onGoCart={() => {}}
        onConfirm={(payload) => void confirmProspectEndVisit(payload)}
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
      <Suspense fallback={null}>
        <ProspectPeekModal
          visible={peekProspect != null}
          prospect={peekProspect}
          labels={{
            close: t.close,
            phone: t.phone,
            owner: t.storeOwner,
            location: t.location,
            address: t.address,
            area: t.area,
            coords: t.prospectCoords,
            locationUnknown: t.locationUnknown,
            openInMaps: t.openInMaps,
            callStore: t.callStore,
            linkQr: t.prospectsLinkQr,
            prospectPill: t.prospectsPill,
            visited: t.prospectsVisited,
            pending: t.prospectsPending,
            endVisit: t.prospectEndVisit,
            lastReason: t.prospectLastReason,
            mapFallback: t.prospectMapFallback,
            storeLocation: t.location,
          }}
          formatLocation={(p) => formatStoreLocation(p, t.locationUnknown)}
          onClose={() => setPeekProspect(null)}
          onEndVisit={(p) => void openProspectEndVisit(p)}
          onLinkQr={(p) => {
            setConvertingProspectId(p.id);
            showToast(t.prospectLinkScanHint, "info");
            void openQrScanner();
          }}
        />
      </Suspense>
    </SafeAreaView>
  );
}

function BottomNavItem(props: {
  active: boolean;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  iconActive: ComponentProps<typeof Ionicons>["name"];
  activeColor?: string;
  activeBg?: string;
  onPress: () => void;
}) {
  const onColor = props.activeColor ?? accent;
  const color = props.active ? onColor : muted;
  return (
    <Pressable
      style={[
        styles.bottomTab,
        props.active && (props.activeBg ? { backgroundColor: props.activeBg } : styles.bottomTabOn),
      ]}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: props.active }}
      accessibilityLabel={props.label}
    >
      <Ionicons name={props.active ? props.iconActive : props.icon} size={20} color={color} />
      <Text
        style={[styles.bottomTabText, props.active && { ...styles.bottomTabTextOn, color: onColor }]}
        numberOfLines={1}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

function ProductCard(props: {
  item: Product;
  mode: "stock" | "sell" | "redeem";
  cartQty?: number;
  atMax?: boolean;
  redeemLinePoints?: number;
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
          {props.mode === "redeem" ? (
            <Text style={styles.productPrice}>{t.redeemPointsUnit(parseInt(props.item.price, 10) || 0)}</Text>
          ) : (
            <>
              <Text style={styles.productPrice}>
                {props.item.price} {t.currency}
              </Text>
              <Text style={styles.productStock}>
                {t.stock}: {props.item.quantity}
              </Text>
            </>
          )}
        </View>
        {props.mode === "redeem" && (props.cartQty ?? 0) > 0 && props.redeemLinePoints != null ? (
          <Text style={styles.redeemLineTotal}>{t.redeemCartPoints(props.redeemLinePoints)}</Text>
        ) : null}
        {(props.mode === "sell" || props.mode === "redeem") && props.onMinus && props.onPlus ? (
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
  mainShell: { flex: 1, minHeight: 0 },
  headerFrame: { paddingHorizontal: 16, alignSelf: "center" },
  flexTab: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  catalogHint: { marginBottom: 8 },
  cardFlex: { flex: 1, minHeight: 0 },
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
  prospectLinkHint: {
    color: accent,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 10,
    lineHeight: 20,
  },
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
  resumeHint: { color: accent, fontSize: 12, fontWeight: "700", textAlign: "right", marginBottom: 4 },
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
  panel: { marginTop: 12, width: "100%", alignSelf: "stretch" },
  storeInfoImage: {
    width: "100%",
    height: 160,
    borderRadius: theme.radius.lg,
    marginBottom: 8,
    backgroundColor: "#f1f5f9",
  },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: line,
    gap: 6,
    alignSelf: "stretch",
  },
  infoLabel: { color: muted, fontSize: 13, fontWeight: "600", textAlign: "right" },
  infoValueWrap: { alignSelf: "stretch" },
  infoValue: {
    color: text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 22,
    flexShrink: 1,
  },
  infoValueLtr: { textAlign: "left" },
  infoLtrWrap: { direction: "ltr", alignSelf: "stretch" },
  infoMapsHint: { color: theme.accent, fontSize: 12, fontWeight: "600", marginTop: 4, textAlign: "right" },
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
  busyCard: {
    backgroundColor: card,
    borderRadius: theme.radius.xl,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 12,
    minWidth: 200,
    ...theme.shadow.float,
  },
  busyMessage: {
    color: text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
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
  redeemBalanceBox: {
    backgroundColor: "rgba(13, 148, 136, 0.12)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  redeemBalanceLabel: { color: muted, fontSize: 14, fontWeight: "600" },
  redeemBalanceValue: { color: "#0d9488", fontSize: 22, fontWeight: "800" },
  redeemCartTotal: { color: text, fontSize: 16, fontWeight: "800", marginTop: 12, marginBottom: 8, textAlign: "right" },
  redeemLineTotal: { color: "#0d9488", fontSize: 13, fontWeight: "700", marginTop: 6, textAlign: "right" },
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
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  bottomTabOn: { backgroundColor: theme.accentSoft },
  bottomTabText: { color: muted, fontWeight: "600", fontSize: 9, textAlign: "center" },
  bottomTabTextOn: { color: accent, fontWeight: "800", fontSize: 9, textAlign: "center" },
});
