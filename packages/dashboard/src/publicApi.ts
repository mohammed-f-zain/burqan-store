import axios from "axios";

const base = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const publicApi = axios.create({
  baseURL: `${base}/api/v1/public`,
  timeout: 20_000,
});
