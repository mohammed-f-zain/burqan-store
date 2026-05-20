import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import BrandLogo from "../components/BrandLogo";
import LangSwitch from "../components/LangSwitch";
import ThemeToggle from "../components/ThemeToggle";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { toastError, toastSuccess } from "../lib/toast";

export default function ForgotPassword() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
      toastSuccess(t.forgotPassword.sent);
    } catch (ex) {
      toastError(pickAxiosErrorMessage(ex, t.forgotPassword.error));
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
          <p className="muted">{t.forgotPassword.sent}</p>
        ) : (
          <form onSubmit={onSubmit} className="form">
            <label>
              {t.login.email}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
            </label>
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
