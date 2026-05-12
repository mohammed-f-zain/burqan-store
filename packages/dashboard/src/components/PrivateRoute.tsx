import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useLocale } from "../i18n/LocaleContext";

export default function PrivateRoute() {
  const { me, loading } = useAuth();
  const { t } = useLocale();
  const token = localStorage.getItem("burqan_admin_token");

  if (!token) return <Navigate to="/login" replace />;
  if (loading)
    return (
      <div className="center-msg">
        <p>{t.common.loading}</p>
      </div>
    );
  if (!me) return <Navigate to="/login" replace />;
  return <Outlet />;
}
