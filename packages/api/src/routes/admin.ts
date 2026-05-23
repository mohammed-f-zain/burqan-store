import { createHash, randomBytes } from "node:crypto";

import { Router } from "express";
import { DatabaseError } from "pg";
import { z } from "zod";

import { config } from "../config.js";
import { isSmtpConfigured, sendMail } from "../lib/mail.js";
import { imageUpload } from "../lib/uploadConfig.js";
import { query, pool } from "../db/pool.js";
import {
  adminAuthMiddleware,
  loadAdmin,
  requireAdminPermission,
  requireAnyAdminPermission,
} from "../middleware/adminAuth.js";
import { HttpError } from "../utils/errors.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAdminToken } from "../utils/jwt.js";
import { countUnassignedQrCodes, insertQrCodes } from "../lib/generateQrCodes.js";
import { optionalStoredImagePathNullableSchema, optionalStoredImagePathSchema } from "../utils/storedImagePath.js";

const router = Router();

/** URL-safe role slug: lowercase, a-z, 0-9, hyphens only. */
function normalizeRoleSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post("/auth/forgot-password", async (req, res, next) => {
  const okMessage = {
    message:
      "If an account exists for this email, you will receive a password reset link shortly.",
  };
  try {
    const body = forgotPasswordSchema.parse(req.body);
    if (!isSmtpConfigured()) {
      throw new HttpError(503, "Password reset email is not configured on the server");
    }
    const { rows } = await query<{ id: number; email: string }>(
      `SELECT id, email FROM admins WHERE lower(email) = lower($1) AND is_active = true`,
      [body.email]
    );
    const admin = rows[0];
    if (admin) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = hashResetToken(token);
      const expiresAt = new Date(Date.now() + config.adminResetTokenMinutes * 60_000);
      await query(`DELETE FROM admin_password_reset_tokens WHERE admin_id = $1 AND used_at IS NULL`, [
        admin.id,
      ]);
      await query(
        `INSERT INTO admin_password_reset_tokens (admin_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [admin.id, tokenHash, expiresAt]
      );
      const resetUrl = `${config.dashboardBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await sendMail({
        to: admin.email,
        subject: "Burqan — Reset your dashboard password",
        html: `<p>Hello,</p><p>Click the link below to set a new password for the Burqan admin dashboard. This link expires in ${config.adminResetTokenMinutes} minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      });
    }
    res.json(okMessage);
  } catch (e) {
    next(e);
  }
});

const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(10).max(200),
});

router.post("/auth/reset-password", async (req, res, next) => {
  try {
    const body = resetPasswordSchema.parse(req.body);
    const tokenHash = hashResetToken(body.token);
    const { rows } = await query<{
      id: number;
      admin_id: number;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT id, admin_id, expires_at, used_at
       FROM admin_password_reset_tokens
       WHERE token_hash = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash]
    );
    const row = rows[0];
    if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
      throw new HttpError(400, "Invalid or expired reset link");
    }
    const ph = await hashPassword(body.password);
    await query(`UPDATE admins SET password_hash = $1 WHERE id = $2 AND is_active = true`, [
      ph,
      row.admin_id,
    ]);
    await query(`UPDATE admin_password_reset_tokens SET used_at = now() WHERE id = $1`, [row.id]);
    await query(`DELETE FROM admin_password_reset_tokens WHERE admin_id = $1 AND id <> $2`, [
      row.admin_id,
      row.id,
    ]);
    res.json({ message: "Password updated. You can sign in with your new password." });
  } catch (e) {
    next(e);
  }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const { rows } = await query<{
      id: number;
      password_hash: string;
      is_active: boolean;
    }>(`SELECT id, password_hash, is_active FROM admins WHERE lower(email) = lower($1)`, [body.email]);
    const row = rows[0];
    if (!row || !row.is_active) throw new HttpError(401, "بيانات الدخول غير صحيحة");
    const ok = await verifyPassword(body.password, row.password_hash);
    if (!ok) throw new HttpError(401, "بيانات الدخول غير صحيحة");
    const token = signAdminToken(row.id);
    res.json({ token, tokenType: "admin" });
  } catch (e) {
    next(e);
  }
});

router.get("/me", adminAuthMiddleware, async (req, res, next) => {
  try {
    const admin = req.admin!;
    res.json({
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      isSuperAdmin: admin.isSuperAdmin,
      permissions: admin.permissions,
    });
  } catch (e) {
    next(e);
  }
});

/** Management dashboard KPIs, charts, and rankings (Jordan month boundaries). */
router.get(
  "/analytics/overview",
  adminAuthMiddleware,
  requireAdminPermission("orders.read"),
  async (_req, res, next) => {
    try {
      const monthStart = `date_trunc('month', timezone('Asia/Amman', now()))`;
      const weekStart = `timezone('Asia/Amman', now()) - interval '7 days'`;

      const [
        { rows: totals },
        { rows: period },
        { rows: topProducts },
        { rows: topStores },
        { rows: topReps },
        { rows: monthly },
        { rows: recentOrders },
      ] = await Promise.all([
        query<{
          order_count: string;
          visit_count: string;
          revenue: string;
          cash_revenue: string;
          deferred_revenue: string;
          payments_recorded: string;
        }>(
          `SELECT
             (SELECT COUNT(*)::text FROM orders) AS order_count,
             (SELECT COUNT(*)::text FROM visits) AS visit_count,
             (SELECT COALESCE(SUM(total_amount), 0)::text FROM orders) AS revenue,
             (SELECT COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END), 0)::text FROM orders) AS cash_revenue,
             (SELECT COALESCE(SUM(CASE WHEN payment_type = 'deferred' THEN total_amount ELSE 0 END), 0)::text FROM orders) AS deferred_revenue,
             (SELECT COALESCE(SUM(amount), 0)::text FROM store_payments) AS payments_recorded`
        ),
        query<{
          month_orders: string;
          month_revenue: string;
          month_visits: string;
          week_orders: string;
        }>(
          `SELECT
             (SELECT COUNT(*)::text FROM orders WHERE created_at >= ${monthStart}) AS month_orders,
             (SELECT COALESCE(SUM(total_amount), 0)::text FROM orders WHERE created_at >= ${monthStart}) AS month_revenue,
             (SELECT COUNT(*)::text FROM visits WHERE visited_at >= ${monthStart}) AS month_visits,
             (SELECT COUNT(*)::text FROM orders WHERE created_at >= ${weekStart}) AS week_orders`
        ),
        query<{
          product_id: number;
          name: string;
          image_url: string | null;
          quantity: string;
          revenue: string;
        }>(
          `SELECT p.id AS product_id, p.name, p.image_url,
                  SUM(ol.quantity)::text AS quantity,
                  SUM(ol.line_total)::text AS revenue
           FROM order_lines ol
           JOIN orders o ON o.id = ol.order_id
           JOIN products p ON p.id = ol.product_id
           GROUP BY p.id, p.name, p.image_url
           ORDER BY SUM(ol.quantity) DESC
           LIMIT 10`
        ),
        query<{
          store_id: number;
          name: string;
          area_name: string;
          order_count: string;
          revenue: string;
        }>(
          `SELECT s.id AS store_id, s.name, a.name AS area_name,
                  COUNT(o.id)::text AS order_count,
                  COALESCE(SUM(o.total_amount), 0)::text AS revenue
           FROM orders o
           JOIN stores s ON s.id = o.store_id
           JOIN areas a ON a.id = s.area_id
           GROUP BY s.id, s.name, a.name
           ORDER BY SUM(o.total_amount) DESC NULLS LAST
           LIMIT 8`
        ),
        query<{
          rep_id: number;
          name: string;
          image_url: string | null;
          order_count: string;
          revenue: string;
        }>(
          `SELECT r.id AS rep_id, r.full_name AS name, r.image_url,
                  COUNT(o.id)::text AS order_count,
                  COALESCE(SUM(o.total_amount), 0)::text AS revenue
           FROM orders o
           JOIN representatives r ON r.id = o.representative_id
           GROUP BY r.id, r.full_name, r.image_url
           ORDER BY SUM(o.total_amount) DESC NULLS LAST
           LIMIT 6`
        ),
        query<{ month: string; revenue: string; order_count: string }>(
          `SELECT date_trunc('month', created_at AT TIME ZONE 'Asia/Amman')::date::text AS month,
                  COALESCE(SUM(total_amount), 0)::text AS revenue,
                  COUNT(*)::text AS order_count
           FROM orders
           WHERE created_at >= (now() - interval '6 months')
           GROUP BY 1
           ORDER BY 1 ASC`
        ),
        query<{
          id: string;
          store_id: number;
          store_name: string;
          payment_type: string;
          total_amount: string;
          created_at: string;
          rep_name: string;
        }>(
          `SELECT o.id::text, o.store_id, s.name AS store_name, o.payment_type,
                  o.total_amount::text AS total_amount, o.created_at, r.full_name AS rep_name
           FROM orders o
           JOIN stores s ON s.id = o.store_id
           JOIN representatives r ON r.id = o.representative_id
           ORDER BY o.id DESC
           LIMIT 8`
        ),
      ]);

      const t = totals[0];
      const p = period[0];
      const deferredRevenue = parseFloat(t?.deferred_revenue ?? "0");
      const paymentsRecorded = parseFloat(t?.payments_recorded ?? "0");

      res.json({
        totals: {
          orderCount: parseInt(t?.order_count ?? "0", 10),
          visitCount: parseInt(t?.visit_count ?? "0", 10),
          revenue: parseFloat(t?.revenue ?? "0"),
          cashRevenue: parseFloat(t?.cash_revenue ?? "0"),
          deferredRevenue,
          paymentsRecorded,
          deferredOutstanding: Math.max(0, deferredRevenue - paymentsRecorded),
        },
        period: {
          monthOrderCount: parseInt(p?.month_orders ?? "0", 10),
          monthRevenue: parseFloat(p?.month_revenue ?? "0"),
          monthVisitCount: parseInt(p?.month_visits ?? "0", 10),
          weekOrderCount: parseInt(p?.week_orders ?? "0", 10),
        },
        topProducts: topProducts.map((row) => ({
          productId: row.product_id,
          name: row.name,
          imageUrl: row.image_url,
          quantity: parseInt(row.quantity, 10),
          revenue: parseFloat(row.revenue),
        })),
        topStores: topStores.map((row) => ({
          storeId: row.store_id,
          name: row.name,
          areaName: row.area_name,
          orderCount: parseInt(row.order_count, 10),
          revenue: parseFloat(row.revenue),
        })),
        topReps: topReps.map((row) => ({
          repId: row.rep_id,
          name: row.name,
          imageUrl: row.image_url,
          orderCount: parseInt(row.order_count, 10),
          revenue: parseFloat(row.revenue),
        })),
        monthly: monthly.map((row) => ({
          month: row.month,
          revenue: parseFloat(row.revenue),
          orderCount: parseInt(row.order_count, 10),
        })),
        recentOrders: recentOrders.map((row) => ({
          id: row.id,
          storeId: row.store_id,
          storeName: row.store_name,
          paymentType: row.payment_type,
          totalAmount: parseFloat(row.total_amount),
          createdAt: row.created_at,
          repName: row.rep_name,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

const patchMeSchema = z
  .object({
    fullName: z.string().min(2).max(255).optional(),
    email: z.string().email().max(255).optional(),
  })
  .refine((b) => b.fullName !== undefined || b.email !== undefined, { message: "empty body" });

router.patch("/me", adminAuthMiddleware, async (req, res, next) => {
  try {
    const body = patchMeSchema.parse(req.body);
    const id = req.admin!.id;

    if (body.email !== undefined) {
      const { rows: taken } = await query<{ id: number }>(
        `SELECT id FROM admins WHERE lower(email) = lower($1) AND id <> $2`,
        [body.email, id]
      );
      if (taken[0]) throw new HttpError(409, "البريد مستخدم من حساب آخر");
    }

    const fields: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (body.fullName !== undefined) {
      fields.push(`full_name = $${i++}`);
      vals.push(body.fullName);
    }
    if (body.email !== undefined) {
      fields.push(`email = $${i++}`);
      vals.push(body.email);
    }
    if (fields.length === 0) throw new HttpError(400, "لا توجد حقول للتحديث");
    vals.push(id);
    await query(`UPDATE admins SET ${fields.join(", ")} WHERE id = $${i}`, vals);

    const fresh = await loadAdmin(id);
    if (!fresh) throw new HttpError(401, "غير مصرّح");
    res.json({
      id: fresh.id,
      email: fresh.email,
      fullName: fresh.fullName,
      isSuperAdmin: fresh.isSuperAdmin,
      permissions: fresh.permissions,
    });
  } catch (e) {
    next(e);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(200),
});

router.post("/me/change-password", adminAuthMiddleware, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const id = req.admin!.id;
    const { rows } = await query<{ password_hash: string }>(
      `SELECT password_hash FROM admins WHERE id = $1 AND is_active = true`,
      [id]
    );
    const row = rows[0];
    if (!row) throw new HttpError(401, "غير مصرّح");
    const ok = await verifyPassword(body.currentPassword, row.password_hash);
    if (!ok) throw new HttpError(400, "كلمة المرور الحالية غير صحيحة");
    const ph = await hashPassword(body.newPassword);
    await query(`UPDATE admins SET password_hash = $1 WHERE id = $2`, [ph, id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/upload",
  adminAuthMiddleware,
  imageUpload.single("file"),
  (req, res, next) => {
    try {
      const f = req.file;
      if (!f) throw new HttpError(400, "لم يتم اختيار ملف");
      res.status(201).json({ path: `/uploads/${f.filename}` });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/qr-pool",
  adminAuthMiddleware,
  requireAdminPermission("qr_pool.read"),
  async (req, res, next) => {
    try {
      const limitRaw = z.coerce.number().int().min(1).max(200).optional().parse(req.query.limit);
      const limit = limitRaw ?? 50;
      const cursor = req.query.cursor ? z.coerce.number().int().positive().parse(req.query.cursor) : null;

      const unassignedCount = await countUnassignedQrCodes();

      const { rows } = await query<{ id: string; public_token: string; created_at: Date }>(
        `SELECT qc.id::text AS id, qc.public_token, qc.created_at
         FROM qr_codes qc
         LEFT JOIN stores s ON s.qr_code_id = qc.id
         WHERE s.id IS NULL
           AND ($1::bigint IS NULL OR qc.id > $1::bigint)
         ORDER BY qc.id ASC
         LIMIT $2`,
        [cursor, limit]
      );

      const last = rows[rows.length - 1];
      const nextCursor = rows.length === limit && last ? parseInt(last.id, 10) : null;

      res.json({
        items: rows.map((r) => ({
          id: r.id,
          publicToken: r.public_token,
          createdAt: r.created_at,
        })),
        nextCursor,
        unassignedCount,
      });
    } catch (e) {
      next(e);
    }
  }
);

const qrPoolGenerateSchema = z.object({
  count: z.number().int().min(1).max(500),
});

router.post(
  "/qr-pool/generate",
  adminAuthMiddleware,
  requireAdminPermission("qr_pool.write"),
  async (req, res, next) => {
    try {
      const body = qrPoolGenerateSchema.parse(req.body);
      const inserted = await insertQrCodes(body.count);
      const unassignedCount = await countUnassignedQrCodes();
      res.status(201).json({ inserted, unassignedCount });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/qr-pool/export",
  adminAuthMiddleware,
  requireAdminPermission("qr_pool.read"),
  async (req, res, next) => {
    try {
      const limit = z.coerce.number().int().min(1).max(20000).optional().parse(req.query.limit) ?? 20000;
      const base = config.qrPayloadBaseUrl.replace(/\/$/, "");
      const { rows } = await query<{ id: string; public_token: string; created_at: Date }>(
        `SELECT qc.id::text AS id, qc.public_token, qc.created_at
         FROM qr_codes qc
         LEFT JOIN stores s ON s.qr_code_id = qc.id
         WHERE s.id IS NULL
         ORDER BY qc.id ASC
         LIMIT $1`,
        [limit]
      );
      res.json({
        items: rows.map((r) => ({
          id: r.id,
          publicToken: r.public_token,
          scanUrl: `${base}/r/${encodeURIComponent(r.public_token)}`,
          createdAt: r.created_at.toISOString(),
        })),
        exportedCount: rows.length,
      });
    } catch (e) {
      next(e);
    }
  }
);

const roleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .transform((s) => normalizeRoleSlug(s))
    .pipe(z.string().min(2).max(120).regex(/^[a-z0-9-]+$/)),
  permissions: z.array(z.string()).default([]),
});

const rolePatchSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };
  if (typeof o.slug === "string") {
    const n = normalizeRoleSlug(o.slug);
    o.slug = n.length === 0 ? undefined : n;
  }
  return o;
}, z.object({
  name: z.string().trim().min(2).max(120).optional(),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/).optional(),
  permissions: z.array(z.string()).optional(),
}));

router.get(
  "/roles",
  adminAuthMiddleware,
  requireAdminPermission("roles.read"),
  async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, name, slug, permissions, created_at FROM roles ORDER BY id ASC`
      );
      res.json({ roles: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/roles",
  adminAuthMiddleware,
  requireAdminPermission("roles.write"),
  async (req, res, next) => {
    try {
      const body = roleSchema.parse(req.body);
      const { rows } = await query(
        `INSERT INTO roles (name, slug, permissions) VALUES ($1, $2, $3::jsonb)
         RETURNING id, name, slug, permissions, created_at`,
        [body.name, body.slug, JSON.stringify(body.permissions)]
      );
      res.status(201).json({ role: rows[0] });
    } catch (e) {
      if (e instanceof DatabaseError && e.code === "23505") {
        return res.status(409).json({ error: "هذا المعرّف (slug) مستخدم بالفعل" });
      }
      next(e);
    }
  }
);

router.patch(
  "/roles/:id",
  adminAuthMiddleware,
  requireAdminPermission("roles.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = rolePatchSchema.parse(req.body);
      const fields: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (body.name !== undefined) {
        fields.push(`name = $${i++}`);
        vals.push(body.name);
      }
      if (body.slug !== undefined) {
        fields.push(`slug = $${i++}`);
        vals.push(body.slug);
      }
      if (body.permissions !== undefined) {
        fields.push(`permissions = $${i++}::jsonb`);
        vals.push(JSON.stringify(body.permissions));
      }
      if (fields.length === 0) throw new HttpError(400, "No fields to update");
      vals.push(id);
      const { rows } = await query(
        `UPDATE roles SET ${fields.join(", ")} WHERE id = $${i} RETURNING id, name, slug, permissions, created_at`,
        vals
      );
      if (!rows[0]) throw new HttpError(404, "Role not found");
      res.json({ role: rows[0] });
    } catch (e) {
      if (e instanceof DatabaseError && e.code === "23505") {
        return res.status(409).json({ error: "هذا المعرّف (slug) مستخدم بالفعل" });
      }
      next(e);
    }
  }
);

router.delete(
  "/roles/:id",
  adminAuthMiddleware,
  requireAdminPermission("roles.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows } = await query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM admins WHERE role_id = $1 AND is_active = true`,
        [id]
      );
      if (parseInt(rows[0]?.c ?? "1", 10) > 0) {
        throw new HttpError(409, "Role is assigned to active admins");
      }
      const del = await query(`DELETE FROM roles WHERE id = $1 RETURNING id`, [id]);
      if (!del.rows[0]) throw new HttpError(404, "Role not found");
      res.json({ deleted: true });
    } catch (e) {
      next(e);
    }
  }
);

const adminCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  fullName: z.string().min(2),
  roleId: z.number().int().positive(),
});

router.get(
  "/accounts",
  adminAuthMiddleware,
  requireAdminPermission("admins.read"),
  async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT a.id, a.email, a.full_name, a.is_super_admin, a.is_active, a.role_id, a.created_at
         FROM admins a ORDER BY a.id ASC`
      );
      res.json({ admins: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/accounts",
  adminAuthMiddleware,
  requireAdminPermission("admins.write"),
  async (req, res, next) => {
    try {
      const body = adminCreateSchema.parse(req.body);
      const creator = req.admin!;
      const ph = await hashPassword(body.password);
      const { rows } = await query(
        `INSERT INTO admins (email, password_hash, full_name, is_super_admin, role_id, created_by_admin_id)
         VALUES ($1, $2, $3, false, $4, $5)
         RETURNING id, email, full_name, is_super_admin, role_id, created_at`,
        [body.email, ph, body.fullName, body.roleId, creator.id]
      );
      res.status(201).json({ admin: rows[0] });
    } catch (e) {
      next(e);
    }
  }
);

const adminPatchSchema = z.object({
  isActive: z.boolean().optional(),
  roleId: z.number().int().positive().nullable().optional(),
});

router.patch(
  "/accounts/:id",
  adminAuthMiddleware,
  requireAdminPermission("admins.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = adminPatchSchema.parse(req.body);
      const { rows: targetRows } = await query<{ is_super_admin: boolean }>(
        `SELECT is_super_admin FROM admins WHERE id = $1`,
        [id]
      );
      const target = targetRows[0];
      if (!target) throw new HttpError(404, "Admin not found");
      if (target.is_super_admin) throw new HttpError(403, "Cannot modify super admin account this way");

      const fields: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (body.isActive !== undefined) {
        fields.push(`is_active = $${i++}`);
        vals.push(body.isActive);
      }
      if (body.roleId !== undefined) {
        if (body.roleId === null) throw new HttpError(400, "roleId cannot be null for non-super");
        fields.push(`role_id = $${i++}`);
        vals.push(body.roleId);
      }
      if (fields.length === 0) throw new HttpError(400, "No fields to update");
      vals.push(id);
      const { rows } = await query(
        `UPDATE admins SET ${fields.join(", ")} WHERE id = $${i}
         RETURNING id, email, full_name, is_super_admin, is_active, role_id, created_at`,
        vals
      );
      res.json({ admin: rows[0] });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/areas",
  adminAuthMiddleware,
  requireAdminPermission("areas.read"),
  async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, name, center_lat, center_lng, radius_km, created_at FROM areas ORDER BY id ASC`
      );
      res.json({ areas: rows });
    } catch (e) {
      next(e);
    }
  }
);

const areaSchema = z.object({
  name: z.string().trim().min(2).max(255),
  centerLat: z.number().min(-90).max(90).optional().nullable(),
  centerLng: z.number().min(-180).max(180).optional().nullable(),
  radiusKm: z.number().positive().max(500).optional(),
});

router.post(
  "/areas",
  adminAuthMiddleware,
  requireAdminPermission("areas.write"),
  async (req, res, next) => {
    try {
      const body = areaSchema.parse(req.body);
      const { rows } = await query(
        `INSERT INTO areas (name, center_lat, center_lng, radius_km)
         VALUES ($1, $2, $3, COALESCE($4, 25))
         RETURNING id, name, center_lat, center_lng, radius_km, created_at`,
        [body.name, body.centerLat ?? null, body.centerLng ?? null, body.radiusKm ?? null]
      );
      res.status(201).json({ area: rows[0] });
    } catch (e) {
      if (e instanceof DatabaseError && e.code === "23505") {
        return res.status(409).json({ error: "اسم المنطقة مستخدم بالفعل" });
      }
      next(e);
    }
  }
);

router.patch(
  "/areas/:id",
  adminAuthMiddleware,
  requireAdminPermission("areas.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = areaSchema.parse(req.body);
      const { rows } = await query(
        `UPDATE areas SET
           name = $1,
           center_lat = COALESCE($2, center_lat),
           center_lng = COALESCE($3, center_lng),
           radius_km = COALESCE($4, radius_km)
         WHERE id = $5
         RETURNING id, name, center_lat, center_lng, radius_km, created_at`,
        [body.name, body.centerLat ?? null, body.centerLng ?? null, body.radiusKm ?? null, id]
      );
      if (!rows[0]) throw new HttpError(404, "المنطقة غير موجودة");
      res.json({ area: rows[0] });
    } catch (e) {
      if (e instanceof DatabaseError && e.code === "23505") {
        return res.status(409).json({ error: "اسم المنطقة مستخدم بالفعل" });
      }
      next(e);
    }
  }
);

router.delete(
  "/areas/:id",
  adminAuthMiddleware,
  requireAdminPermission("areas.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows: cnt } = await query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM stores WHERE area_id = $1`,
        [id]
      );
      const n = parseInt(cnt[0]?.c ?? "0", 10);
      if (n > 0) {
        return res.status(409).json({ error: "لا يمكن حذف المنطقة لوجود متاجر مرتبطة بها" });
      }
      const del = await query(`DELETE FROM areas WHERE id = $1 RETURNING id`, [id]);
      if (!del.rows[0]) throw new HttpError(404, "المنطقة غير موجودة");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

const productSchema = z.object({
  name: z.string().min(1),
  designation: z.string().optional(),
  unitLabel: z.string().optional(),
  cartonSpec: z.string().optional(),
  dimensionsCm: z.string().optional(),
  cartonWeightKg: z.number().optional(),
  imageUrl: optionalStoredImagePathSchema,
  price: z.number().nonnegative(),
});

router.get(
  "/products",
  adminAuthMiddleware,
  requireAdminPermission("products.read"),
  async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, name, designation, unit_label, carton_spec, dimensions_cm, carton_weight_kg, image_url, price, is_active, created_at
         FROM products ORDER BY id DESC`
      );
      res.json({ products: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/products",
  adminAuthMiddleware,
  requireAdminPermission("products.write"),
  async (req, res, next) => {
    try {
      const body = productSchema.parse(req.body);
      const { rows } = await query(
        `INSERT INTO products (name, designation, unit_label, carton_spec, dimensions_cm, carton_weight_kg, image_url, price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          body.name,
          body.designation ?? null,
          body.unitLabel ?? null,
          body.cartonSpec ?? null,
          body.dimensionsCm ?? null,
          body.cartonWeightKg ?? null,
          body.imageUrl || null,
          body.price,
        ]
      );
      res.status(201).json({ product: rows[0] });
    } catch (e) {
      next(e);
    }
  }
);

const productPatchSchema = z.object({
  name: z.string().min(1).optional(),
  designation: z.string().nullable().optional(),
  unitLabel: z.string().nullable().optional(),
  cartonSpec: z.string().nullable().optional(),
  dimensionsCm: z.string().nullable().optional(),
  cartonWeightKg: z.number().nullable().optional(),
  imageUrl: optionalStoredImagePathNullableSchema,
  price: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  "/products/:id",
  adminAuthMiddleware,
  requireAdminPermission("products.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = productPatchSchema.parse(req.body);
      const map: [string, unknown][] = [];
      if (body.name !== undefined) map.push(["name", body.name]);
      if (body.designation !== undefined) map.push(["designation", body.designation]);
      if (body.unitLabel !== undefined) map.push(["unit_label", body.unitLabel]);
      if (body.cartonSpec !== undefined) map.push(["carton_spec", body.cartonSpec]);
      if (body.dimensionsCm !== undefined) map.push(["dimensions_cm", body.dimensionsCm]);
      if (body.cartonWeightKg !== undefined) map.push(["carton_weight_kg", body.cartonWeightKg]);
      if (body.imageUrl !== undefined) map.push(["image_url", body.imageUrl === "" ? null : body.imageUrl]);
      if (body.price !== undefined) map.push(["price", body.price]);
      if (body.isActive !== undefined) map.push(["is_active", body.isActive]);
      if (map.length === 0) throw new HttpError(400, "No fields to update");
      const sets = map.map(([col], idx) => `${col} = $${idx + 1}`).join(", ");
      const vals = map.map(([, v]) => v);
      vals.push(id);
      const { rows } = await query(`UPDATE products SET ${sets} WHERE id = $${vals.length} RETURNING *`, vals);
      if (!rows[0]) throw new HttpError(404, "Product not found");
      res.json({ product: rows[0] });
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/products/:id",
  adminAuthMiddleware,
  requireAdminPermission("products.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows: used } = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM order_lines WHERE product_id = $1`,
        [id]
      );
      const n = parseInt(used[0]?.n ?? "0", 10);
      if (n > 0) {
        throw new HttpError(409, "لا يمكن حذف منتج مستخدَم في طلبات سابقة.");
      }
      const { rowCount } = await query(`DELETE FROM products WHERE id = $1`, [id]);
      if (!rowCount) throw new HttpError(404, "المنتج غير موجود");
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

const repCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  fullName: z.string().min(2),
  phone: z.string().min(6),
  imageUrl: optionalStoredImagePathSchema,
  carPlate: z.string().optional(),
  areaIds: z.array(z.number().int().positive()).min(1),
});

router.get(
  "/representatives",
  adminAuthMiddleware,
  requireAdminPermission("reps.read"),
  async (_req, res, next) => {
    try {
      const { rows } = await query(`
        SELECT r.*, COALESCE(json_agg(ra.area_id) FILTER (WHERE ra.area_id IS NOT NULL), '[]') AS area_ids
        FROM representatives r
        LEFT JOIN representative_areas ra ON ra.representative_id = r.id
        GROUP BY r.id
        ORDER BY r.id DESC
      `);
      res.json({ representatives: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/representatives",
  adminAuthMiddleware,
  requireAdminPermission("reps.write"),
  async (req, res, next) => {
    try {
      const body = repCreateSchema.parse(req.body);
      const ph = await hashPassword(body.password);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const ins = await c.query<{ id: number }>(
          `INSERT INTO representatives (email, password_hash, full_name, phone, image_url, car_plate)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [body.email, ph, body.fullName, body.phone, body.imageUrl || null, body.carPlate ?? null]
        );
        const id = ins.rows[0]!.id;
        for (const aid of body.areaIds) {
          await c.query(
            `INSERT INTO representative_areas (representative_id, area_id) VALUES ($1,$2)`,
            [id, aid]
          );
        }
        await c.query("COMMIT");
        res.status(201).json({ id });
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    } catch (e) {
      if (e instanceof DatabaseError && e.code === "23505") {
        return next(new HttpError(409, "البريد مستخدم مسبقاً"));
      }
      next(e);
    }
  }
);

function ammanCalendarDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(d);
}

const salesDailyQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

router.get(
  "/representatives/sales-daily",
  adminAuthMiddleware,
  requireAnyAdminPermission("reps.read", "fill_car.read"),
  async (req, res, next) => {
    try {
      const q = salesDailyQuerySchema.parse(req.query);
      const date = q.date ?? ammanCalendarDate();

      const { rows: reps } = await query<{
        id: number;
        full_name: string;
        email: string;
        is_active: boolean;
        order_count: number;
        total_sales: string;
      }>(
        `SELECT r.id, r.full_name, r.email, r.is_active,
                COUNT(o.id)::int AS order_count,
                COALESCE(SUM(o.total_amount), 0)::text AS total_sales
         FROM representatives r
         LEFT JOIN orders o ON o.representative_id = r.id
           AND (o.created_at AT TIME ZONE 'Asia/Amman')::date = $1::date
         GROUP BY r.id
         ORDER BY COALESCE(SUM(o.total_amount), 0) DESC NULLS LAST, r.full_name ASC`,
        [date]
      );

      const { rows: lines } = await query<{
        rep_id: number;
        product_id: number;
        product_name: string;
        quantity: number;
        line_total: string;
      }>(
        `SELECT o.representative_id AS rep_id, p.id AS product_id, p.name AS product_name,
                SUM(ol.quantity)::int AS quantity,
                COALESCE(SUM(ol.line_total), 0)::text AS line_total
         FROM orders o
         INNER JOIN order_lines ol ON ol.order_id = o.id
         INNER JOIN products p ON p.id = ol.product_id
         WHERE (o.created_at AT TIME ZONE 'Asia/Amman')::date = $1::date
         GROUP BY o.representative_id, p.id, p.name
         ORDER BY o.representative_id, p.name`,
        [date]
      );

      const linesByRep = new Map<number, typeof lines>();
      for (const line of lines) {
        const list = linesByRep.get(line.rep_id) ?? [];
        list.push(line);
        linesByRep.set(line.rep_id, list);
      }

      res.json({
        date,
        representatives: reps.map((r) => ({
          ...r,
          lines: linesByRep.get(r.id) ?? [],
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

const repPatchSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).optional(),
  phone: z.string().min(6).optional(),
  imageUrl: optionalStoredImagePathNullableSchema,
  carPlate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  areaIds: z.array(z.number().int().positive()).min(1).optional(),
  newPassword: z.string().min(10).optional(),
});

router.patch(
  "/representatives/:id",
  adminAuthMiddleware,
  requireAdminPermission("reps.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = repPatchSchema.parse(req.body);
      const hasAny =
        body.email !== undefined ||
        body.fullName !== undefined ||
        body.phone !== undefined ||
        body.imageUrl !== undefined ||
        body.carPlate !== undefined ||
        body.isActive !== undefined ||
        body.areaIds !== undefined ||
        body.newPassword !== undefined;
      if (!hasAny) throw new HttpError(400, "لا توجد حقول للتحديث");

      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const { rows: cur } = await c.query<{ id: number }>(`SELECT id FROM representatives WHERE id = $1`, [id]);
        if (!cur[0]) throw new HttpError(404, "المندوب غير موجود");

        if (body.email !== undefined) {
          const { rows: taken } = await c.query<{ id: number }>(
            `SELECT id FROM representatives WHERE lower(email) = lower($1) AND id <> $2`,
            [body.email, id]
          );
          if (taken[0]) throw new HttpError(409, "البريد مستخدم مسبقاً");
        }

        const map: [string, unknown][] = [];
        if (body.email !== undefined) map.push(["email", body.email]);
        if (body.fullName !== undefined) map.push(["full_name", body.fullName]);
        if (body.phone !== undefined) map.push(["phone", body.phone]);
        if (body.imageUrl !== undefined) map.push(["image_url", body.imageUrl === null ? null : body.imageUrl]);
        if (body.carPlate !== undefined) map.push(["car_plate", body.carPlate]);
        if (body.isActive !== undefined) map.push(["is_active", body.isActive]);
        if (body.newPassword !== undefined) {
          const ph = await hashPassword(body.newPassword);
          map.push(["password_hash", ph]);
        }
        if (map.length > 0) {
          const sets = map.map(([col], idx) => `${col} = $${idx + 1}`).join(", ");
          const vals = map.map(([, v]) => v);
          vals.push(id);
          await c.query(`UPDATE representatives SET ${sets} WHERE id = $${vals.length}`, vals);
        }

        if (body.areaIds !== undefined) {
          await c.query(`DELETE FROM representative_areas WHERE representative_id = $1`, [id]);
          for (const aid of body.areaIds) {
            await c.query(`INSERT INTO representative_areas (representative_id, area_id) VALUES ($1,$2)`, [id, aid]);
          }
        }

        await c.query("COMMIT");
      } catch (e) {
        try {
          await c.query("ROLLBACK");
        } catch {
          /* ignore rollback errors */
        }
        throw e;
      } finally {
        c.release();
      }

      const { rows } = await query(
        `
          SELECT r.*, COALESCE(json_agg(ra.area_id) FILTER (WHERE ra.area_id IS NOT NULL), '[]') AS area_ids
          FROM representatives r
          LEFT JOIN representative_areas ra ON ra.representative_id = r.id
          WHERE r.id = $1
          GROUP BY r.id
        `,
        [id]
      );
      if (!rows[0]) throw new HttpError(404, "المندوب غير موجود");
      res.json({ representative: rows[0] });
    } catch (e) {
      if (e instanceof DatabaseError && e.code === "23505") {
        return next(new HttpError(409, "البريد مستخدم مسبقاً"));
      }
      next(e);
    }
  }
);

router.delete(
  "/representatives/:id",
  adminAuthMiddleware,
  requireAdminPermission("reps.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows: ord } = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM orders WHERE representative_id = $1`,
        [id]
      );
      const n = parseInt(ord[0]?.n ?? "0", 10);
      if (n > 0) {
        throw new HttpError(409, "لا يمكن حذف مندوب مرتبط بطلبات.");
      }
      const { rowCount } = await query(`DELETE FROM representatives WHERE id = $1`, [id]);
      if (!rowCount) throw new HttpError(404, "المندوب غير موجود");
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

const inventoryItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(0),
});

const inventoryPutSchema = z.object({
  items: z.array(inventoryItemSchema),
});

router.get(
  "/fill-car/representatives",
  adminAuthMiddleware,
  requireAnyAdminPermission("fill_car.read", "reps.read"),
  async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, full_name, email, is_active FROM representatives ORDER BY full_name ASC`
      );
      res.json({ representatives: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/representatives/:id/inventory",
  adminAuthMiddleware,
  requireAnyAdminPermission("fill_car.read", "reps.read"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows } = await query(
        `SELECT p.id AS product_id, p.name, p.designation, p.image_url, p.price,
                COALESCE(ri.quantity, 0) AS quantity
         FROM products p
         LEFT JOIN representative_inventory ri
           ON ri.product_id = p.id AND ri.representative_id = $1
         WHERE p.is_active = true
         ORDER BY p.name ASC`,
        [id]
      );
      res.json({ inventory: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  "/representatives/:id/inventory",
  adminAuthMiddleware,
  requireAnyAdminPermission("fill_car.write", "reps.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = inventoryPutSchema.parse(req.body);
      const repCheck = await query(`SELECT id FROM representatives WHERE id = $1`, [id]);
      if (!repCheck.rows[0]) throw new HttpError(404, "المندوب غير موجود");

      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        for (const item of body.items) {
          await c.query(
            `INSERT INTO representative_inventory (representative_id, product_id, quantity, updated_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (representative_id, product_id)
             DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`,
            [id, item.productId, item.quantity]
          );
        }
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
      const { rows } = await query(
        `SELECT product_id, quantity FROM representative_inventory WHERE representative_id = $1`,
        [id]
      );
      res.json({ inventory: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/stores",
  adminAuthMiddleware,
  requireAdminPermission("stores.read"),
  async (_req, res, next) => {
    try {
      const { rows } = await query(`
        SELECT s.*, a.name AS area_name, qc.public_token AS qr_public_token
        FROM stores s
        JOIN areas a ON a.id = s.area_id
        JOIN qr_codes qc ON qc.id = s.qr_code_id
        ORDER BY s.id DESC
      `);
      res.json({ stores: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/stores/:id",
  adminAuthMiddleware,
  requireAdminPermission("stores.read"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows } = await query(
        `
        SELECT s.*, a.name AS area_name, qc.public_token AS qr_public_token,
          r.full_name AS registered_by_rep_name
        FROM stores s
        JOIN areas a ON a.id = s.area_id
        JOIN qr_codes qc ON qc.id = s.qr_code_id
        LEFT JOIN representatives r ON r.id = s.registered_by_representative_id
        WHERE s.id = $1
      `,
        [id]
      );
      if (!rows[0]) throw new HttpError(404, "Store not found");
      res.json({ store: rows[0] });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/stores/:id/visits",
  adminAuthMiddleware,
  requireAdminPermission("stores.read"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows } = await query(
        `SELECT v.id, v.visited_at, v.note, r.full_name AS rep_name
         FROM visits v
         JOIN representatives r ON r.id = v.representative_id
         WHERE v.store_id = $1
         ORDER BY v.id DESC
         LIMIT 100`,
        [id]
      );
      res.json({ visits: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/stores/:id/payments",
  adminAuthMiddleware,
  requireAdminPermission("stores.read"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows } = await query(
        `SELECT id, amount, note, created_at
         FROM store_payments
         WHERE store_id = $1
         ORDER BY id DESC
         LIMIT 100`,
        [id]
      );
      res.json({ payments: rows });
    } catch (e) {
      next(e);
    }
  }
);

const deferredSchema = z.object({ enabled: z.boolean() });

router.patch(
  "/stores/:id/deferred",
  adminAuthMiddleware,
  requireAdminPermission("stores.deferred_toggle"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = deferredSchema.parse(req.body);
      const { rows } = await query(
        `UPDATE stores SET deferred_payment_enabled = $2 WHERE id = $1 RETURNING id, deferred_payment_enabled`,
        [id, body.enabled]
      );
      if (!rows[0]) throw new HttpError(404, "Store not found");
      res.json({ store: rows[0] });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/orders",
  adminAuthMiddleware,
  requireAdminPermission("orders.read"),
  async (req, res, next) => {
    try {
      const storeId = req.query.storeId ? z.coerce.number().int().positive().parse(req.query.storeId) : null;
      const { rows } = await query(
        storeId
          ? `SELECT o.id, o.representative_id, o.store_id, o.payment_type, o.total_amount, o.created_at,
                    s.name AS store_name, r.full_name AS rep_name
             FROM orders o
             INNER JOIN stores s ON s.id = o.store_id
             INNER JOIN representatives r ON r.id = o.representative_id
             WHERE o.store_id = $1
             ORDER BY o.id DESC
             LIMIT 200`
          : `SELECT o.id, o.representative_id, o.store_id, o.payment_type, o.total_amount, o.created_at,
                    s.name AS store_name, r.full_name AS rep_name
             FROM orders o
             INNER JOIN stores s ON s.id = o.store_id
             INNER JOIN representatives r ON r.id = o.representative_id
             ORDER BY o.id DESC
             LIMIT 200`,
        storeId ? [storeId] : []
      );
      res.json({ orders: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/orders/:id",
  adminAuthMiddleware,
  requireAdminPermission("orders.read"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows } = await query<{
        id: string;
        representative_id: number;
        store_id: number;
        payment_type: string;
        total_amount: string;
        created_at: Date;
        lines: unknown;
      }>(
        `SELECT o.id, o.representative_id, o.store_id, o.payment_type, o.total_amount, o.created_at,
                s.name AS store_name, r.full_name AS rep_name,
          COALESCE(
            (SELECT json_agg(json_build_object(
              'productId', ol.product_id,
              'quantity', ol.quantity,
              'unitPrice', ol.unit_price,
              'lineTotal', ol.line_total,
              'productName', p.name
            ))
            FROM order_lines ol
            JOIN products p ON p.id = ol.product_id
            WHERE ol.order_id = o.id),
            '[]'::json
          ) AS lines
         FROM orders o
         INNER JOIN stores s ON s.id = o.store_id
         INNER JOIN representatives r ON r.id = o.representative_id
         WHERE o.id = $1`,
        [id]
      );
      if (!rows[0]) throw new HttpError(404, "Order not found");
      res.json({ order: rows[0] });
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/orders/:id",
  adminAuthMiddleware,
  requireAdminPermission("orders.delete"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const { rows: orderRows } = await c.query<{ id: string; representative_id: number }>(
          `SELECT id, representative_id FROM orders WHERE id = $1 FOR UPDATE`,
          [id]
        );
        const order = orderRows[0];
        if (!order) throw new HttpError(404, "Order not found");

        const { rows: lines } = await c.query<{ product_id: number; quantity: number }>(
          `SELECT product_id, quantity FROM order_lines WHERE order_id = $1`,
          [id]
        );

        for (const line of lines) {
          await c.query(
            `INSERT INTO representative_inventory (representative_id, product_id, quantity, updated_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (representative_id, product_id)
             DO UPDATE SET
               quantity = representative_inventory.quantity + EXCLUDED.quantity,
               updated_at = now()`,
            [order.representative_id, line.product_id, line.quantity]
          );
        }

        await c.query(`DELETE FROM orders WHERE id = $1`, [id]);
        await c.query("COMMIT");
        res.json({ deleted: true, id: order.id });
      } catch (e) {
        try {
          await c.query("ROLLBACK");
        } catch {
          /* ignore */
        }
        throw e;
      } finally {
        c.release();
      }
    } catch (e) {
      next(e);
    }
  }
);

const paymentSchema = z.object({
  amount: z.number().positive(),
  note: z.string().optional(),
});

router.post(
  "/stores/:id/payments",
  adminAuthMiddleware,
  requireAdminPermission("orders.record_payment"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = paymentSchema.parse(req.body);
      const { rows } = await query(
        `INSERT INTO store_payments (store_id, amount, note, recorded_by_admin_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [id, body.amount, body.note ?? null, req.admin!.id]
      );
      res.status(201).json({ payment: rows[0] });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
