import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useLocale } from "../i18n/LocaleContext";

export default function AccountPage() {
  const { me, refresh } = useAuth();
  const { t } = useLocale();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (me) {
      setFullName(me.fullName);
      setEmail(me.email);
    }
  }, [me]);

  async function onProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    if (!me) return;
    const body: { fullName?: string; email?: string } = {};
    if (fullName.trim() !== me.fullName) body.fullName = fullName.trim();
    if (email.trim() !== me.email) body.email = email.trim();
    if (Object.keys(body).length === 0) {
      setProfileErr(t.account.saveFailed);
      return;
    }
    setProfileLoading(true);
    try {
      await api.patch("/me", body);
      setProfileMsg(t.account.profileSaved);
      await refresh();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setProfileErr(msg ?? t.account.saveFailed);
    } finally {
      setProfileLoading(false);
    }
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    if (newPassword !== confirmPassword) {
      setPwErr(t.account.passwordMismatch);
      return;
    }
    setPwLoading(true);
    try {
      await api.post("/me/change-password", {
        currentPassword,
        newPassword,
      });
      setPwMsg(t.account.passwordSaved);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setPwErr(msg ?? t.account.saveFailed);
    } finally {
      setPwLoading(false);
    }
  }

  if (!me) {
    return (
      <div className="center-msg">
        <p className="muted">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="grid">
      <h1>{t.account.title}</h1>
      <div className="grid2">
        <div className="card">
          <h2>{t.account.profileTitle}</h2>
          <form className="form" onSubmit={onProfileSubmit}>
            <label>
              {t.account.fullName}
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} />
            </label>
            <label>
              {t.account.email}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </label>
            {profileErr && <div className="error">{profileErr}</div>}
            {profileMsg && <div className="muted">{profileMsg}</div>}
            <button className="primary" type="submit" disabled={profileLoading}>
              {profileLoading ? t.common.loading : t.account.saveProfile}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>{t.account.passwordTitle}</h2>
          <form className="form" onSubmit={onPasswordSubmit}>
            <label>
              {t.account.currentPassword}
              <input
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              {t.account.newPassword}
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
              />
            </label>
            <label>
              {t.account.confirmPassword}
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
              />
            </label>
            {pwErr && <div className="error">{pwErr}</div>}
            {pwMsg && <div className="muted">{pwMsg}</div>}
            <button className="primary" type="submit" disabled={pwLoading}>
              {pwLoading ? t.common.loading : t.account.savePassword}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
