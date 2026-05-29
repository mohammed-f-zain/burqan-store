import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import BrandLogo from "../components/BrandLogo";
import LangSwitch from "../components/LangSwitch";
import ThemeToggle from "../components/ThemeToggle";
import { useLocale } from "../i18n/LocaleContext";

export default function AppLayout() {
  const { me, can, logout } = useAuth();
  const { t } = useLocale();

  const nav: { to: string; end?: boolean; label: string; perm?: string | null; permAny?: string[] }[] = [
    { to: "/app", end: true, label: t.nav.overview, perm: null },
    { to: "/app/account", label: t.nav.account, perm: null },
    { to: "/app/roles", label: t.nav.roles, perm: "roles.read" },
    { to: "/app/admins", label: t.nav.admins, perm: "admins.read" },
    { to: "/app/areas", label: t.nav.areas, perm: "areas.read" },
    { to: "/app/products", label: t.nav.products, perm: "products.read" },
    { to: "/app/redeem", label: t.nav.redeem, perm: "redeem.read" },
    { to: "/app/representatives", label: t.nav.representatives, perm: "reps.read" },
    { to: "/app/fill-car", label: t.nav.fillCar, permAny: ["fill_car.read", "reps.read"] },
    { to: "/app/stores", label: t.nav.stores, perm: "stores.read" },
    { to: "/app/orders", label: t.nav.orders, perm: "orders.read" },
    { to: "/app/qr-pool", label: t.nav.qrPool, perm: "qr_pool.read" },
  ];

  return (
    <div className="dash-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandLogo className="sidebar-brand-logo" />
        </div>
        <div className="sidebar-user muted small">
          {me?.fullName}
          {me?.isSuperAdmin && <span className="badge">{t.superBadge}</span>}
        </div>
        <nav className="sidebar-nav">
          {nav.map((item) => {
            if (item.permAny && !item.permAny.some((p) => can(p))) return null;
            if (item.perm && !can(item.perm)) return null;
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <ThemeToggle className="sidebar-theme" />
        <LangSwitch className="sidebar-lang" />
        <button type="button" className="ghost nav-logout" onClick={logout}>
          {t.logout}
        </button>
      </aside>
      <div className="dash-main">
        <Outlet />
      </div>
    </div>
  );
}
