import { useLocale } from "../i18n/LocaleContext";

export default function LangSwitch({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className={`lang-switch ${className}`.trim()}>
      <span className="muted small">{t.lang.switch}</span>
      <div className="lang-switch-btns">
        <button type="button" className={locale === "ar" ? "pill on" : "pill off"} onClick={() => setLocale("ar")}>
          {t.lang.ar}
        </button>
        <button type="button" className={locale === "en" ? "pill on" : "pill off"} onClick={() => setLocale("en")}>
          {t.lang.en}
        </button>
      </div>
    </div>
  );
}
