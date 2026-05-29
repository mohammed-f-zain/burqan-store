import { normalizePlaceName } from "../utils/normalizeArabic.js";

/**
 * Google Maps / common labels → exact `areas.name` in our database.
 * Keys are normalized when looked up.
 */
const RAW_ALIASES: Record<string, string> = {
  "طبربور": "طبربور",
  tabarbour: "طبربور",
  "jabal tabarbour": "طبربور",
  "الهاشمي الشمالي": "الهاشمي الشمالي",
  "al hashimi": "الهاشمي الشمالي",
  "أبو عليا": "أبو عليا",
  "ابو عليا": "أبو عليا",
  "abu alia": "أبو عليا",
  "عبدون": "عبدون",
  abdoun: "عبدون",
  "وسط الزرقاء": "وسط الزرقاء",
  "وسط إربد": "وسط إربد",
  "وسط عمان": "وسط عمان",
  "الصويفيه": "الصويفية",
  sweifieh: "الصويفية",
  swefieh: "الصويفية",
  "الجبيهه": "الجبيهة",
  jubeiha: "الجبيهة",
  "تلاع العلي": "تلاع العلي",
  "telaa al ali": "تلاع العلي",
  "خلدا": "خلدا",
  khalda: "خلدا",
  "الدابوق": "الدابوق",
  dabouq: "الدابوق",
  "شميساني": "شميساني",
  shmeisani: "شميساني",
  "جبل عمان": "جبل عمان",
  "jabal amman": "جبل عمان",
  "جبل اللويبده": "جبل اللويبدة",
  weibdeh: "جبل اللويبدة",
  "جبل الحسين": "جبل الحسين",
  "ras al ain": "راس العين",
  "العبدلي": "العبدلي",
  abdali: "العبدلي",
  "المقابلين": "المقابلين",
  muqabelain: "المقابلين",
  "النزهه": "النزهة",
  "وادي السير": "وادي السير",
  "wadi al seer": "وادي السير",
  "مرج الحمام": "مرج الحمام",
  "marj al hamam": "مرج الحمام",
  "ماركا": "ماركا",
  marka: "ماركا",
  "الطنيب": "الطنيب",
  "tla al ali": "تلاع العلي",
  "الرصيفه": "الرصيفة",
  russeifa: "الرصيفة",
  "الزرقاء الجديده": "الزرقاء الجديدة",
  "new zarqa": "الزرقاء الجديدة",
  "الرمثا": "الرمثا",
  ramtha: "الرمثا",
  "البتراء": "وادي موسى",
  petra: "وادي موسى",
  "wadi musa": "وادي موسى",
  "السلط": "السلط",
  salt: "السلط",
  "الفحيص": "الفحيص",
  fuheis: "الفحيص",
};

const ALIAS_LOOKUP = new Map<string, string>();
for (const [key, areaName] of Object.entries(RAW_ALIASES)) {
  ALIAS_LOOKUP.set(normalizePlaceName(key), areaName);
}

export function areaNameFromGoogleLabel(label: string): string | null {
  return ALIAS_LOOKUP.get(normalizePlaceName(label)) ?? null;
}
