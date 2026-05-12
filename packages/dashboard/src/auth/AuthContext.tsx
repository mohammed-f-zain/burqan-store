import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "../api";

export type AdminMe = {
  id: number;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

type AuthCtx = {
  me: AdminMe | null;
  loading: boolean;
  refresh: () => Promise<void>;
  can: (perm: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = localStorage.getItem("burqan_admin_token");
    if (!t) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<AdminMe>("/me");
      setMe(data);
    } catch {
      setMe(null);
      localStorage.removeItem("burqan_admin_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const can = useCallback(
    (perm: string) => {
      if (!me) return false;
      if (me.isSuperAdmin) return true;
      return me.permissions.includes(perm);
    },
    [me]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("burqan_admin_token");
    setMe(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo(
    () => ({ me, loading, refresh, can, logout }),
    [me, loading, refresh, can, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
