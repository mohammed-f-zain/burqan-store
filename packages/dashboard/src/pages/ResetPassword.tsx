import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api";
import BrandLogo from "../components/BrandLogo";
import LangSwitch from "../components/LangSwitch";
import ThemeToggle from "../components/ThemeToggle";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";

export default function ResetPassword() {
  const { t } = useLocale();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token")?.trim() ?? "", [params]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!token) {
      setErr(t.resetPassword.missingToken);
      return;
    }
    if (password !== confirm) {
      setErr(t.resetPassword.mismatch);
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (ex) {
      setErr(pickAxiosErrorMessage(ex, t.resetPassword.error));
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
            <h1>{t.resetPassword.title}</h1>
          </div>
          <div className="login-actions">
            <ThemeToggle />
            <LangSwitch />
          </div>
        </div>
        <p className="muted">{t.resetPassword.hint}</p>
        {done ? (
          <>
            <p className="success">{t.resetPassword.done}</p>
            <p className="muted small" style={{ marginTop: 16 }}>
              <Link to="/login">{t.resetPassword.signIn}</Link>
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit} className="form">
            {!token && <div className="error">{t.resetPassword.missingToken}</div>}
            <label>
              {t.resetPassword.newPassword}
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                minLength={10}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              {t.resetPassword.confirm}
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                minLength={10}
                required
                autoComplete="new-password"
              />
            </label>
            {err && <div className="error">{err}</div>}
            <button className="primary" disabled={loading || !token} type="submit">
              {loading ? t.resetPassword.loading : t.resetPassword.submit}
            </button>
          </form>
        )}
        {!done && (
          <p className="muted small" style={{ marginTop: 16 }}>
            <Link to="/login">{t.forgotPassword.back}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
