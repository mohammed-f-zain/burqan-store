import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { toastError, toastSuccess, toastWarning } from "../lib/toast";

export default function AccountPage() {
  const { me, refresh } = useAuth();
  const { t } = useLocale();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (me) {
      setFullName(me.fullName);
      setEmail(me.email);
    }
  }, [me]);

  async function onProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!me) return;
    const body: { fullName?: string; email?: string } = {};
    if (fullName.trim() !== me.fullName) body.fullName = fullName.trim();
    if (email.trim() !== me.email) body.email = email.trim();
    if (Object.keys(body).length === 0) {
      toastWarning(t.account.saveFailed);
      return;
    }
    setProfileLoading(true);
    try {
      await api.patch("/me", body);
      toastSuccess(t.account.profileSaved);
      await refresh();
    } catch (err: unknown) {
      toastError(pickAxiosErrorMessage(err, t.account.saveFailed));
    } finally {
      setProfileLoading(false);
    }
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toastWarning(t.account.passwordMismatch);
      return;
    }
    setPwLoading(true);
    try {
      await api.post("/me/change-password", {
        currentPassword,
        newPassword,
      });
      toastSuccess(t.account.passwordSaved);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toastError(pickAxiosErrorMessage(err, t.account.saveFailed));
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
            <button className="primary" type="submit" disabled={pwLoading}>
              {pwLoading ? t.common.loading : t.account.savePassword}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
