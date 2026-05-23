import { useEffect } from "react";

import { ar } from "../i18n/ar";

/** Store owner pages are always Arabic (ignore admin dashboard locale). */
export function useOwnerArabic() {
  useEffect(() => {
    const prevLang = document.documentElement.lang;
    const prevDir = document.documentElement.dir;
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.documentElement.classList.add("locale-ar");
    document.documentElement.classList.remove("locale-en");
    document.title = "برقان — بوابة المتجر";
    return () => {
      document.documentElement.lang = prevLang;
      document.documentElement.dir = prevDir;
    };
  }, []);
  return ar;
}
