import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import BrandLogo from "../components/BrandLogo";
import LangSwitch from "../components/LangSwitch";
import ThemeToggle from "../components/ThemeToggle";
import { useLocale } from "../i18n/LocaleContext";

export default function Login() {
  const nav = useNavigate();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("burqan_admin_token", data.token);
      nav("/app", { replace: true });
      window.location.reload();
    } catch {
      setErr(t.login.error);
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
            <h1>{t.login.title}</h1>
          </div>
          <div className="login-actions">
            <ThemeToggle />
            <LangSwitch />
          </div>
        </div>
        <p className="muted">{t.login.hint}</p>
        <form onSubmit={onSubmit} className="form">
          <label>
            {t.login.email}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" />
          </label>
          <label>
            {t.login.password}
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          {err && <div className="error">{err}</div>}
          <button className="primary" disabled={loading} type="submit">
            {loading ? t.login.loading : t.login.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
