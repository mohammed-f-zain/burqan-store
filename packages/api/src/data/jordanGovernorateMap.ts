import { normalizePlaceName } from "../utils/normalizeArabic.js";

/** Google / English governorate labels → Arabic names used in DB. */
const GOVERNORATE_ALIASES: Record<string, string> = {
  عمان: "عمان",
  amman: "عمان",
  "amman governorate": "عمان",
  "محافظة عمان": "عمان",
  إربد: "إربد",
  irbid: "إربد",
  "irbid governorate": "إربد",
  "محافظة إربد": "إربد",
  الزرقاء: "الزرقاء",
  zarqa: "الزرقاء",
  "zarqa governorate": "الزرقاء",
  "محافظة الزرقاء": "الزرقاء",
  المفرق: "المفرق",
  mafraq: "المفرق",
  "mafraq governorate": "المفرق",
  العقبة: "العقبة",
  aqaba: "العقبة",
  "aqaba governorate": "العقبة",
  الكرك: "الكرك",
  karak: "الكرك",
  "al karak": "الكرك",
  معان: "معان",
  maan: "معان",
  "ma'an": "معان",
  الطفيلة: "الطفيلة",
  tafilah: "الطفيلة",
  tafila: "الطفيلة",
  مادبا: "مادبا",
  madaba: "مادبا",
  جرش: "جرش",
  jerash: "جرش",
  عجلون: "عجلون",
  ajloun: "عجلون",
  ajlun: "عجلون",
  البلقاء: "البلقاء",
  balqa: "البلقاء",
  "al balqa": "البلقاء",
};

export function governorateFromGoogleLabel(label: string): string | null {
  const key = normalizePlaceName(label);
  return GOVERNORATE_ALIASES[key] ?? null;
}
