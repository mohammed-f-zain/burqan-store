/**
 * Named Jordan neighborhoods (Amman + major cities).
 * Radius is capped to 1 km on seed — see jordanAreaSeeds.ts + governorate grid.
 */
export type JordanAreaSeed = {
  name: string;
  governorate: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

export const JORDAN_DETAILED_AREAS: JordanAreaSeed[] = [
  // —— عمان: الدوارات ——
  { name: "الدوار الأول", governorate: "عمان", centerLat: 31.9515, centerLng: 35.9395, radiusKm: 1.2 },
  { name: "الدوار الثاني", governorate: "عمان", centerLat: 31.9545, centerLng: 35.9285, radiusKm: 1.2 },
  { name: "الدوار الثالث", governorate: "عمان", centerLat: 31.9575, centerLng: 35.9175, radiusKm: 1.2 },
  { name: "الدوار الرابع", governorate: "عمان", centerLat: 31.961, centerLng: 35.906, radiusKm: 1.3 },
  { name: "الدوار الخامس", governorate: "عمان", centerLat: 31.9645, centerLng: 35.895, radiusKm: 1.3 },
  { name: "الدوار السادس", governorate: "عمان", centerLat: 31.968, centerLng: 35.884, radiusKm: 1.4 },
  { name: "الدوار السابع", governorate: "عمان", centerLat: 31.9715, centerLng: 35.872, radiusKm: 1.6 },
  { name: "الدوار الثامن", governorate: "عمان", centerLat: 31.9755, centerLng: 35.858, radiusKm: 1.8 },
  // —— عمان: أحياء رئيسية ——
  { name: "عبدون", governorate: "عمان", centerLat: 31.935, centerLng: 35.888, radiusKm: 2.2 },
  { name: "الصويفية", governorate: "عمان", centerLat: 31.923, centerLng: 35.865, radiusKm: 2.2 },
  { name: "الجبيهة", governorate: "عمان", centerLat: 31.998, centerLng: 35.858, radiusKm: 2.8 },
  { name: "تلاع العلي", governorate: "عمان", centerLat: 31.998, centerLng: 35.828, radiusKm: 2.8 },
  { name: "خلدا", governorate: "عمان", centerLat: 31.988, centerLng: 35.868, radiusKm: 2.2 },
  { name: "الدابوق", governorate: "عمان", centerLat: 31.975, centerLng: 35.838, radiusKm: 2.2 },
  { name: "شميساني", governorate: "عمان", centerLat: 31.968, centerLng: 35.908, radiusKm: 1.8 },
  { name: "جبل عمان", governorate: "عمان", centerLat: 31.952, centerLng: 35.928, radiusKm: 2.0 },
  { name: "جبل اللويبدة", governorate: "عمان", centerLat: 31.948, centerLng: 35.918, radiusKm: 1.5 },
  { name: "جبل الحسين", governorate: "عمان", centerLat: 31.978, centerLng: 35.938, radiusKm: 2.0 },
  { name: "راس العين", governorate: "عمان", centerLat: 31.982, centerLng: 35.928, radiusKm: 2.0 },
  { name: "العبدلي", governorate: "عمان", centerLat: 31.958, centerLng: 35.932, radiusKm: 2.0 },
  { name: "المقابلين", governorate: "عمان", centerLat: 31.938, centerLng: 35.948, radiusKm: 2.2 },
  { name: "النزهة", governorate: "عمان", centerLat: 31.978, centerLng: 35.898, radiusKm: 2.0 },
  { name: "الرابية", governorate: "عمان", centerLat: 31.968, centerLng: 35.848, radiusKm: 2.2 },
  { name: "الأشرفية", governorate: "عمان", centerLat: 31.958, centerLng: 35.898, radiusKm: 2.0 },
  { name: "وادي السير", governorate: "عمان", centerLat: 31.955, centerLng: 35.818, radiusKm: 3.0 },
  { name: "مرج الحمام", governorate: "عمان", centerLat: 31.888, centerLng: 35.838, radiusKm: 3.0 },
  { name: "الجيزة", governorate: "عمان", centerLat: 31.878, centerLng: 35.988, radiusKm: 3.0 },
  { name: "ماركا", governorate: "عمان", centerLat: 31.998, centerLng: 35.988, radiusKm: 3.2 },
  { name: "الطنيب", governorate: "عمان", centerLat: 32.018, centerLng: 35.948, radiusKm: 3.0 },
  { name: "القويسمة", governorate: "عمان", centerLat: 31.918, centerLng: 35.968, radiusKm: 3.0 },
  { name: "سحاب", governorate: "عمان", centerLat: 31.868, centerLng: 36.008, radiusKm: 3.5 },
  { name: "المدينة الرياضية", governorate: "عمان", centerLat: 31.988, centerLng: 35.898, radiusKm: 2.0 },
  { name: "ضاحية الرشيد", governorate: "عمان", centerLat: 31.928, centerLng: 35.958, radiusKm: 2.5 },
  { name: "الياسمين", governorate: "عمان", centerLat: 31.938, centerLng: 35.878, radiusKm: 2.2 },
  { name: "أم أذينة", governorate: "عمان", centerLat: 31.968, centerLng: 35.878, radiusKm: 2.0 },
  { name: "ضاحية الأقصى", governorate: "عمان", centerLat: 31.918, centerLng: 35.898, radiusKm: 2.5 },
  { name: "بدر", governorate: "عمان", centerLat: 31.898, centerLng: 35.928, radiusKm: 2.8 },
  { name: "حي نزال", governorate: "عمان", centerLat: 31.988, centerLng: 35.968, radiusKm: 2.5 },
  { name: "طبربور", governorate: "عمان", centerLat: 32.008, centerLng: 35.918, radiusKm: 2.5 },
  { name: "الهاشمي الشمالي", governorate: "عمان", centerLat: 31.998, centerLng: 35.958, radiusKm: 2.5 },
  { name: "الهاشمي الجنوبي", governorate: "عمان", centerLat: 31.978, centerLng: 35.978, radiusKm: 2.5 },
  { name: "المطار", governorate: "عمان", centerLat: 31.722, centerLng: 35.993, radiusKm: 4.0 },
  // —— الزرقاء ——
  { name: "وسط الزرقاء", governorate: "الزرقاء", centerLat: 32.0728, centerLng: 36.0876, radiusKm: 3.0 },
  { name: "الزرقاء الجديدة", governorate: "الزرقاء", centerLat: 32.048, centerLng: 36.118, radiusKm: 3.5 },
  { name: "الرصيفة", governorate: "الزرقاء", centerLat: 32.018, centerLng: 36.048, radiusKm: 4.0 },
  { name: "الهاشمية", governorate: "الزرقاء", centerLat: 32.128, centerLng: 36.128, radiusKm: 3.5 },
  // —— إربد ——
  { name: "وسط إربد", governorate: "إربد", centerLat: 32.5556, centerLng: 35.85, radiusKm: 3.0 },
  { name: "حي الشرقي", governorate: "إربد", centerLat: 32.548, centerLng: 35.868, radiusKm: 2.8 },
  { name: "حي الغربي", governorate: "إربد", centerLat: 32.558, centerLng: 35.828, radiusKm: 2.8 },
  { name: "الرمثا", governorate: "إربد", centerLat: 32.558, centerLng: 36.008, radiusKm: 4.0 },
  // —— البلقاء ——
  { name: "السلط", governorate: "البلقاء", centerLat: 32.0367, centerLng: 35.7278, radiusKm: 3.5 },
  { name: "الفحيص", governorate: "البلقاء", centerLat: 31.918, centerLng: 35.768, radiusKm: 3.0 },
  { name: "ماحص", governorate: "البلقاء", centerLat: 31.978, centerLng: 35.758, radiusKm: 3.0 },
  // —— مادبا ——
  { name: "وسط مادبا", governorate: "مادبا", centerLat: 31.716, centerLng: 35.7939, radiusKm: 3.0 },
  { name: "ذيبان", governorate: "مادبا", centerLat: 31.498, centerLng: 35.768, radiusKm: 4.0 },
  // —— المفرق ——
  { name: "وسط المفرق", governorate: "المفرق", centerLat: 32.3424, centerLng: 36.208, radiusKm: 4.0 },
  { name: "الرويشد", governorate: "المفرق", centerLat: 32.518, centerLng: 38.208, radiusKm: 5.0 },
  // —— العقبة ——
  { name: "وسط العقبة", governorate: "العقبة", centerLat: 29.532, centerLng: 35.0063, radiusKm: 3.5 },
  { name: "الشاطئ الجنوبي", governorate: "العقبة", centerLat: 29.518, centerLng: 34.988, radiusKm: 3.0 },
  // —— الكرك ——
  { name: "وسط الكرك", governorate: "الكرك", centerLat: 31.1853, centerLng: 35.7048, radiusKm: 3.5 },
  // —— معان ——
  { name: "وسط معان", governorate: "معان", centerLat: 30.1962, centerLng: 35.7341, radiusKm: 4.0 },
  { name: "وادي موسى", governorate: "معان", centerLat: 30.328, centerLng: 35.478, radiusKm: 5.0 },
  { name: "البتراء", governorate: "معان", centerLat: 30.338, centerLng: 35.468, radiusKm: 5.0 },
  // —— الطفيلة ——
  { name: "وسط الطفيلة", governorate: "الطفيلة", centerLat: 30.8375, centerLng: 35.6167, radiusKm: 3.5 },
  // —— جرش / عجلون ——
  { name: "وسط جرش", governorate: "جرش", centerLat: 32.2722, centerLng: 35.8993, radiusKm: 3.0 },
  { name: "سوف", governorate: "جرش", centerLat: 32.318, centerLng: 35.838, radiusKm: 3.5 },
  { name: "وسط عجلون", governorate: "عجلون", centerLat: 32.3326, centerLng: 35.7517, radiusKm: 3.0 },
  { name: "عنجرة", governorate: "عجلون", centerLat: 32.408, centerLng: 35.768, radiusKm: 3.5 },
  // —— إربد إضافي ——
  { name: "الحصن", governorate: "إربد", centerLat: 32.488, centerLng: 35.728, radiusKm: 3.5 },
  { name: "كفرنجة", governorate: "إربد", centerLat: 32.438, centerLng: 35.698, radiusKm: 3.5 },
  { name: "بيت راس", governorate: "إربد", centerLat: 32.638, centerLng: 35.728, radiusKm: 3.5 },
  // —— المفرق إضافي ——
  { name: "الخالدية", governorate: "المفرق", centerLat: 32.178, centerLng: 36.298, radiusKm: 4.0 },
  { name: "الصالحية", governorate: "المفرق", centerLat: 32.268, centerLng: 36.058, radiusKm: 4.0 },
  // —— الكرك / معان / مادبا إضافي ——
  { name: "القصر", governorate: "الكرك", centerLat: 31.178, centerLng: 35.698, radiusKm: 4.0 },
  { name: "الشوبك", governorate: "معان", centerLat: 30.528, centerLng: 35.928, radiusKm: 4.5 },
  { name: "ماعين", governorate: "مادبا", centerLat: 31.668, centerLng: 35.738, radiusKm: 3.5 },
  { name: "دليل", governorate: "مادبا", centerLat: 31.748, centerLng: 35.768, radiusKm: 3.5 },
];
