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
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import OrdersPage from "./pages/OrdersPage";
import OverviewPage from "./pages/OverviewPage";
import ProductsPage from "./pages/ProductsPage";
import PublicOwner from "./pages/PublicOwner";
import QrPoolPage from "./pages/QrPoolPage";
import RepresentativesPage from "./pages/RepresentativesPage";
import RolesPage from "./pages/RolesPage";
import StoreDetailPage from "./pages/StoreDetailPage";
import StoresPage from "./pages/StoresPage";

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AuthProvider>
          <div className="app-shell">
            <Routes>
              <Route path="/owner" element={<PublicOwner />} />
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
                <Route path="products" element={<ProductsPage />} />
                <Route path="representatives" element={<RepresentativesPage />} />
                <Route path="stores" element={<StoresPage />} />
                  <Route path="stores/:id" element={<StoreDetailPage />} />
                  <Route path="orders" element={<OrdersPage />} />
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
