import axios from "axios";

const base = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const api = axios.create({
  baseURL: `${base}/api/v1/admin`,
  /** Avoid infinite “loading” if the API never responds (wrong host, firewall, hung proxy). */
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const t = localStorage.getItem("burqan_admin_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
