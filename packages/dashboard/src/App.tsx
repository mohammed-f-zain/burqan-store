import { Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import { LocaleProvider } from "./i18n/LocaleContext";
import { ThemeProvider } from "./theme/ThemeContext";
import AppLayout from "./layout/AppLayout";
import AccountPage from "./pages/AccountPage";
import AdminsPage from "./pages/AdminsPage";
import AreasPage from "./pages/AreasPage";
import ForgotPassword from "./pages/ForgotPassword";
import LoyaltyStoresPage from "./pages/LoyaltyStoresPage";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import OrderDetailPage from "./pages/OrderDetailPage";
import OrdersPage from "./pages/OrdersPage";
import OverviewPage from "./pages/OverviewPage";
import PossibleClientsPage from "./pages/PossibleClientsPage";
import PossibleClientDetailPage from "./pages/PossibleClientDetailPage";
import ProductsPage from "./pages/ProductsPage";
import RedeemPage from "./pages/RedeemPage";
import OwnerOrderDetail from "./pages/OwnerOrderDetail";
import OwnerPortal from "./pages/OwnerPortal";
import PublicQrRedirect from "./pages/PublicQrRedirect";
import QrPoolPage from "./pages/QrPoolPage";
import FillCarPage from "./pages/FillCarPage";
import RepresentativesPage from "./pages/RepresentativesPage";
import RolesPage from "./pages/RolesPage";
import RouteZonesPage from "./pages/RouteZonesPage";
import StoreDetailPage from "./pages/StoreDetailPage";
import StoresPage from "./pages/StoresPage";
import VisitsPage from "./pages/VisitsPage";

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AuthProvider>
          <div className="app-shell">
            <Routes>
              <Route path="/r/:token" element={<PublicQrRedirect />} />
              <Route path="/owner" element={<OwnerPortal />} />
              <Route path="/owner/order/:orderId" element={<OwnerOrderDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route element={<PrivateRoute />}>
                <Route path="/app" element={<AppLayout />}>
                  <Route index element={<OverviewPage />} />
                  <Route path="account" element={<AccountPage />} />
                  <Route path="roles" element={<RolesPage />} />
                <Route path="admins" element={<AdminsPage />} />
                <Route path="areas" element={<AreasPage />} />
                <Route path="route-zones" element={<RouteZonesPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="redeem" element={<RedeemPage />} />
                <Route path="representatives" element={<RepresentativesPage />} />
                <Route path="fill-car" element={<FillCarPage />} />
                <Route path="rep-sales" element={<Navigate to="/app/fill-car" replace />} />
                <Route path="stores" element={<StoresPage />} />
                  <Route path="loyalty-stores" element={<LoyaltyStoresPage />} />
                  <Route path="stores/:id" element={<StoreDetailPage />} />
                  <Route path="possible-clients" element={<PossibleClientsPage />} />
                  <Route path="possible-clients/:id" element={<PossibleClientDetailPage />} />
                  <Route path="visits" element={<VisitsPage />} />
                  <Route path="orders" element={<OrdersPage />} />
                  <Route path="orders/:id" element={<OrderDetailPage />} />
                  <Route path="qr-pool" element={<QrPoolPage />} />
                </Route>
              </Route>
              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </div>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
