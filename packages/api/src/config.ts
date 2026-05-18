import path from "node:path";

import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  /** Bind address: use 0.0.0.0 so phones on the same LAN can reach the API (see LISTEN_HOST in .env.example). */
  listenHost: process.env.LISTEN_HOST ?? "0.0.0.0",
  port: parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl: required("DATABASE_URL"),
  jwtAdminSecret: required("JWT_ADMIN_SECRET"),
  jwtRepSecret: required("JWT_REP_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10),
  ownerPortalBaseUrl: process.env.OWNER_PORTAL_BASE_URL ?? "https://burqan.store",
  qrPayloadBaseUrl: process.env.QR_PAYLOAD_BASE_URL ?? "https://burqan.store",
  /** Max distance (m) from store for rep QR scan / visit / order. */
  scanMaxDistanceM: parseInt(process.env.SCAN_MAX_DISTANCE_M ?? "100", 10),
  /** Local folder for uploaded images (served at /uploads/...) */
  uploadDir: process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "uploads"),
};
