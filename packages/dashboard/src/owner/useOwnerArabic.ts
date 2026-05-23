import { useEffect } from "react";

import { ar } from "../i18n/ar";

const STORAGE_KEY = "burqan_dashboard_theme";

function readStoredTheme(): "light" | "dark" {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "light" || s === "dark") return s;
  } catch {
    /* ignore */
  }
  return "dark";
}

/** Store owner pages are always Arabic (ignore admin dashboard locale). */
export function useOwnerArabic() {
  useEffect(() => {
    const prevLang = document.documentElement.lang;
    const prevDir = document.documentElement.dir;
    const prevTheme = document.documentElement.getAttribute("data-theme");
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.add("locale-ar");
    document.documentElement.classList.remove("locale-en");
    document.title = "برقان";
    return () => {
      document.documentElement.lang = prevLang;
      document.documentElement.dir = prevDir;
      document.documentElement.setAttribute("data-theme", prevTheme ?? readStoredTheme());
    };
  }, []);
  return ar;
}
