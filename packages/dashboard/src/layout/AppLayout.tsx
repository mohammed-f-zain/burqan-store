import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import BrandLogo from "../components/BrandLogo";
import LangSwitch from "../components/LangSwitch";
import NavIcon, { type NavIconName } from "../components/NavIcon";
import ThemeToggle from "../components/ThemeToggle";
import { useLocale } from "../i18n/LocaleContext";

type NavItem = {
  to: string;
  end?: boolean;
  label: string;
  icon: NavIconName;
  perm?: string | null;
  permAny?: string[];
};

export default function AppLayout() {
  const { me, can, logout } = useAuth();
  const { t } = useLocale();

  const nav: NavItem[] = [
    { to: "/app", end: true, label: t.nav.overview, icon: "overview", perm: null },
    { to: "/app/account", label: t.nav.account, icon: "account", perm: null },
    { to: "/app/roles", label: t.nav.roles, icon: "roles", perm: "roles.read" },
    { to: "/app/admins", label: t.nav.admins, icon: "admins", perm: "admins.read" },
    { to: "/app/areas", label: t.nav.areas, icon: "areas", perm: "areas.read" },
    { to: "/app/route-zones", label: t.nav.routeZones, icon: "routeZones", perm: "areas.read" },
    { to: "/app/products", label: t.nav.products, icon: "products", perm: "products.read" },
    { to: "/app/redeem", label: t.nav.redeem, icon: "redeem", perm: "redeem.read" },
    { to: "/app/representatives", label: t.nav.representatives, icon: "representatives", perm: "reps.read" },
    { to: "/app/fill-car", label: t.nav.fillCar, icon: "fillCar", permAny: ["fill_car.read", "reps.read"] },
    { to: "/app/stores", label: t.nav.stores, icon: "stores", perm: "stores.read" },
    { to: "/app/loyalty-stores", label: t.nav.loyaltyStores, icon: "loyaltyStores", perm: "stores.read" },
    { to: "/app/possible-clients", label: t.nav.possibleClients, icon: "possibleClients", perm: "stores.read" },
    { to: "/app/visits", label: t.nav.visits, icon: "visits", perm: "stores.read" },
    { to: "/app/orders", label: t.nav.orders, icon: "orders", perm: "orders.read" },
    { to: "/app/qr-pool", label: t.nav.qrPool, icon: "qrPool", perm: "qr_pool.read" },
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
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              >
                <span className="nav-link-inner">
                  <NavIcon name={item.icon} />
                  <span className="nav-link-label">{item.label}</span>
                </span>
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
