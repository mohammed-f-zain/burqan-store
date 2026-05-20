import type { RequestHandler } from "express";

import type { Permission } from "../constants/permissions.js";
import { query } from "../db/pool.js";
import { HttpError } from "../utils/errors.js";
import { verifyAdminToken, type AdminJwtPayload } from "../utils/jwt.js";

export type AdminRequestUser = {
  id: number;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  permissions: Permission[];
};

declare global {
  namespace Express {
    interface Request {
      admin?: AdminRequestUser;
    }
  }
}

export async function loadAdmin(adminId: number): Promise<AdminRequestUser | null> {
  const { rows } = await query<{
    id: number;
    email: string;
    full_name: string;
    is_super_admin: boolean;
    is_active: boolean;
    permissions: unknown;
  }>(
    `SELECT a.id, a.email, a.full_name, a.is_super_admin, a.is_active,
            COALESCE(r.permissions, '[]'::jsonb) AS permissions
     FROM admins a
     LEFT JOIN roles r ON r.id = a.role_id
     WHERE a.id = $1`,
    [adminId]
  );
  const row = rows[0];
  if (!row || !row.is_active) return null;
  const raw = row.permissions;
  const list = Array.isArray(raw) ? raw.filter((p): p is Permission => typeof p === "string") : [];
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isSuperAdmin: row.is_super_admin,
    permissions: list as Permission[],
  };
}

export const adminAuthMiddleware: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new HttpError(401, "لم يتم إرسال رمز الدخول");
    const token = header.slice("Bearer ".length).trim();
    const payload = verifyAdminToken(token) as AdminJwtPayload;
    if (payload.typ !== "admin") throw new HttpError(401, "رمز غير صالح");
    const admin = await loadAdmin(payload.sub);
    if (!admin) throw new HttpError(401, "غير مصرّح");
    req.admin = admin;
    next();
  } catch (e) {
    next(e instanceof HttpError ? e : new HttpError(401, "غير مصرّح"));
  }
};

export function requireAdminPermission(...perms: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const admin = req.admin;
    if (!admin) return next(new HttpError(401, "غير مصرّح"));
    if (admin.isSuperAdmin) return next();
    const ok = perms.every((p) => admin.permissions.includes(p));
    if (!ok) return next(new HttpError(403, "ليس لديك صلاحية"));
    next();
  };
}

/** Passes if the admin has at least one of the listed permissions (or is super admin). */
export function requireAnyAdminPermission(...perms: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const admin = req.admin;
    if (!admin) return next(new HttpError(401, "غير مصرّح"));
    if (admin.isSuperAdmin) return next();
    const ok = perms.some((p) => admin.permissions.includes(p));
    if (!ok) return next(new HttpError(403, "ليس لديك صلاحية"));
    next();
  };
}
