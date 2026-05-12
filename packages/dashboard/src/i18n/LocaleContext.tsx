import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Messages } from "./ar";
import { ar } from "./ar";
import { en } from "./en";

export type Locale = "ar" | "en";

const STORAGE_KEY = "burqan_dashboard_locale";

const catalog: Record<Locale, Messages> = { ar, en };

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Messages;
} | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s === "en" ? "en" : "ar";
    } catch {
      return "ar";
    }
  });

  const setLocale = (l: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    setLocaleState(l);
  };

  useEffect(() => {
    document.documentElement.lang = locale === "ar" ? "ar" : "en";
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.classList.toggle("locale-en", locale === "en");
    document.documentElement.classList.toggle("locale-ar", locale === "ar");
    document.title = locale === "ar" ? "برقان — لوحة التحكم" : "Burqan — Dashboard";
  }, [locale]);

  const t = catalog[locale];
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const v = useContext(LocaleContext);
  if (!v) throw new Error("useLocale must be used within LocaleProvider");
  return v;
}
