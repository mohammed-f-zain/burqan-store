import type { RequestHandler } from "express";

import { query } from "../db/pool.js";
import { HttpError } from "../utils/errors.js";
import { verifyRepToken, type RepJwtPayload } from "../utils/jwt.js";

export type RepRequestUser = {
  id: number;
  email: string;
  fullName: string;
  areaIds: number[];
};

declare global {
  namespace Express {
    interface Request {
      rep?: RepRequestUser;
    }
  }
}

async function loadRep(repId: number): Promise<RepRequestUser | null> {
  const { rows } = await query<{
    id: number;
    email: string;
    full_name: string;
    is_active: boolean;
  }>(`SELECT id, email, full_name, is_active FROM representatives WHERE id = $1`, [repId]);
  const row = rows[0];
  if (!row || !row.is_active) return null;
  const areas = await query<{ area_id: number }>(
    `SELECT area_id FROM representative_areas WHERE representative_id = $1`,
    [repId]
  );
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    areaIds: areas.rows.map((r) => r.area_id),
  };
}

export const repAuthMiddleware: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new HttpError(401, "لم يتم إرسال رمز الدخول");
    const token = header.slice("Bearer ".length).trim();
    const payload = verifyRepToken(token) as RepJwtPayload;
    if (payload.typ !== "rep") throw new HttpError(401, "رمز غير صالح");
    const rep = await loadRep(payload.sub);
    if (!rep) throw new HttpError(401, "غير مصرّح");
    req.rep = rep;
    next();
  } catch (e) {
    next(e instanceof HttpError ? e : new HttpError(401, "غير مصرّح"));
  }
};
