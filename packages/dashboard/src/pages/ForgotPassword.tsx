import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import BrandLogo from "../components/BrandLogo";
import LangSwitch from "../components/LangSwitch";
import ThemeToggle from "../components/ThemeToggle";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";

export default function ForgotPassword() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
    } catch (ex) {
      setErr(pickAxiosErrorMessage(ex, t.forgotPassword.error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card narrow">
        <div className="login-head">
          <div className="login-brand">
            <BrandLogo />
            <h1>{t.forgotPassword.title}</h1>
          </div>
          <div className="login-actions">
            <ThemeToggle />
            <LangSwitch />
          </div>
        </div>
        <p className="muted">{t.forgotPassword.hint}</p>
        {done ? (
          <p className="success">{t.forgotPassword.sent}</p>
        ) : (
          <form onSubmit={onSubmit} className="form">
            <label>
              {t.login.email}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
            </label>
            {err && <div className="error">{err}</div>}
            <button className="primary" disabled={loading} type="submit">
              {loading ? t.forgotPassword.loading : t.forgotPassword.submit}
            </button>
          </form>
        )}
        <p className="muted small" style={{ marginTop: 16 }}>
          <Link to="/login">{t.forgotPassword.back}</Link>
        </p>
      </div>
    </div>
  );
}
