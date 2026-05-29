import { normalizePlaceName } from "../utils/normalizeArabic.js";

/**
 * Google Maps / common labels → exact `areas.name` in our database.
 * Keys are normalized when looked up.
 */
const RAW_ALIASES: Record<string, string> = {
  "دوار الاول": "الدوار الأول",
  "الدوار 1": "الدوار الأول",
  "1st circle": "الدوار الأول",
  "دوار الثاني": "الدوار الثاني",
  "2nd circle": "الدوار الثاني",
  "دوار الثالث": "الدوار الثالث",
  "3rd circle": "الدوار الثالث",
  "دوار الرابع": "الدوار الرابع",
  "4th circle": "الدوار الرابع",
  "دوار الخامس": "الدوار الخامس",
  "5th circle": "الدوار الخامس",
  "دوار السادس": "الدوار السادس",
  "6th circle": "الدوار السادس",
  "دوار السابع": "الدوار السابع",
  "7th circle": "الدوار السابع",
  "دوار الثامن": "الدوار الثامن",
  "8th circle": "الدوار الثامن",
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
  "البتراء": "وادي موسى / البتراء",
  petra: "وادي موسى / البتراء",
  "wadi musa": "وادي موسى / البتراء",
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
