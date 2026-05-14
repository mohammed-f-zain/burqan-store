import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  className?: string;
};

export default function ThemeToggle({ className }: Props) {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();

  return (
    <div className={className ? `theme-toggle ${className}` : "theme-toggle"}>
      <span className="theme-toggle-label muted small">{t.theme.switch}</span>
      <div className="theme-toggle-btns">
        <button
          type="button"
          className={theme === "light" ? "pill on" : "pill"}
          onClick={() => setTheme("light")}
          aria-pressed={theme === "light"}
        >
          {t.theme.light}
        </button>
        <button
          type="button"
          className={theme === "dark" ? "pill on" : "pill"}
          onClick={() => setTheme("dark")}
          aria-pressed={theme === "dark"}
        >
          {t.theme.dark}
        </button>
      </div>
    </div>
  );
}
