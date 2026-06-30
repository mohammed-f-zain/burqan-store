/** يحوّل رسائل النظام والخادم الإنجليزية إلى عربية للمستخدم. */
const EXACT: Record<string, string> = {
  Aborted: "انتهت مهلة الاتصال",
  timeout: "انتهت مهلة الاتصال",
  "Network request failed": "تعذّر الاتصال بالخادم",
  "Network Request Failed": "تعذّر الاتصال بالخادم",
  "Failed to fetch": "تعذّر الاتصال بالخادم",
  "Unknown QR code": "رمز QR غير معروف",
  "Store not found": "المتجر غير موجود",
  "Store not in your areas": "المتجر ليس ضمن مسار اليوم",
  "Area not assigned to you": "المنطقة غير مخصصة لك",
  "QR already used or invalid": "رمز QR مستخدم مسبقاً أو غير صالح",
  "Deferred payments not enabled for this store": "البيع الآجل غير مفعّل لهذا المتجر",
  "Invalid product": "منتج غير صالح",
  Unauthorized: "غير مصرّح",
  Forbidden: "غير مسموح",
  "Not Found": "غير موجود",
  "Bad Request": "طلب غير صالح",
  "Internal Server Error": "خطأ داخلي في الخادم",
  "Request failed": "فشل الطلب",
  location_denied: "يلزم تفعيل الموقع",
};

const CONTAINS: [RegExp, string][] = [
  [/network request/i, "تعذّر الاتصال بالخادم"],
  [/abort/i, "انتهت مهلة الاتصال"],
  [/timeout/i, "انتهت مهلة الاتصال"],
  [/unauthorized/i, "غير مصرّح"],
  [/forbidden/i, "غير مسموح"],
  [/not found/i, "غير موجود"],
  [/invalid credentials/i, "بيانات الدخول غير صحيحة"],
  [/camera/i, "مشكلة في الكاميرا"],
  [/permission/i, "يلزم منح الإذن المطلوب"],
  [/location/i, "مشكلة في الموقع"],
];

const ARABIC_RE = /[\u0600-\u06FF]/;

export function toArabicUserMessage(raw: string, fallback = "حدث خطأ. حاول مرة أخرى."): string {
  const text = raw.trim();
  if (!text) return fallback;
  if (ARABIC_RE.test(text)) return text;

  if (EXACT[text]) return EXACT[text];

  for (const [pattern, msg] of CONTAINS) {
    if (pattern.test(text)) return msg;
  }

  return fallback;
}
