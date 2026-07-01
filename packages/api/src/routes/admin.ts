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
import { JORDAN_GOVERNORATES } from "../data/jordanGovernorates.js";
import {
  isNoBuyVisit,
  NO_BUY_REASONS,
  VISIT_HAD_ORDER_SAME_DAY_SQL,
  VISIT_WITHOUT_ORDER_SAME_DAY_SQL,
} from "../data/noBuyReasons.js";
import { buildJordanVoronoiPayload } from "../utils/buildJordanVoronoiPayload.js";
import { ARABIC_WEEKDAY_NAMES } from "../utils/routeZones.js";
import { importGooglePlaces } from "../utils/importGooglePlaces.js";
import { isGooglePlacesEnabled } from "../utils/googlePlaces.js";
import { GOVERNORATE_AREA_SUFFIX } from "../utils/matchAreaFromGoogle.js";
import { getLoyaltyExpiryDays, getLoyaltyPeriodAudit, syncLoyaltyPeriodsFromFirstPurchase } from "../utils/loyaltyExpiry.js";

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
        { rows: loyaltyTotals },
        { rows: topStoresLoyalty },
        { rows: recentOrders },
        { rows: noBuyByReasonRows },
        { rows: noBuyMonthCount },
        { rows: recentNoBuyVisits },
        { rows: todayStats },
        { rows: yesterdayStats },
        { rows: dailySalesRows },
        { rows: monthPaymentMix },
        { rows: activeRepsToday },
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
        query<{ total_points: string; month_points: string }>(
          `SELECT
             COALESCE(SUM(ol.loyalty_points_earned), 0)::text AS total_points,
             COALESCE(SUM(ol.loyalty_points_earned) FILTER (
               WHERE o.created_at >= date_trunc('month', timezone('Asia/Amman', now()))
             ), 0)::text AS month_points
           FROM order_lines ol
           JOIN orders o ON o.id = ol.order_id`
        ),
        query<{ store_id: number; name: string; area_name: string; balance: string }>(
          `SELECT s.id AS store_id, s.name, a.name AS area_name,
                  s.loyalty_points_balance::text AS balance
           FROM stores s
           JOIN areas a ON a.id = s.area_id
           ORDER BY s.loyalty_points_balance DESC, s.name ASC
           LIMIT 10`
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
        query<{ note: string; count: string }>(
          `SELECT v.note, COUNT(*)::text AS count
           FROM visits v
           WHERE v.note = ANY($1::text[])
             AND ${VISIT_WITHOUT_ORDER_SAME_DAY_SQL}
             AND v.visited_at >= ${monthStart}
           GROUP BY v.note`,
          [NO_BUY_REASONS]
        ),
        query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM visits v
           WHERE v.note = ANY($1::text[])
             AND ${VISIT_WITHOUT_ORDER_SAME_DAY_SQL}
             AND v.visited_at >= ${monthStart}`,
          [NO_BUY_REASONS]
        ),
        query<{
          id: string;
          visited_at: string;
          note: string;
          store_id: number;
          store_name: string;
          area_name: string;
          rep_name: string;
        }>(
          `SELECT v.id::text, v.visited_at, v.note, s.id AS store_id, s.name AS store_name,
                  a.name AS area_name, r.full_name AS rep_name
           FROM visits v
           JOIN stores s ON s.id = v.store_id
           JOIN areas a ON a.id = s.area_id
           JOIN representatives r ON r.id = v.representative_id
           WHERE v.note = ANY($1::text[])
             AND ${VISIT_WITHOUT_ORDER_SAME_DAY_SQL}
           ORDER BY v.id DESC
           LIMIT 15`,
          [NO_BUY_REASONS]
        ),
        query<{ revenue: string; order_count: string; visit_count: string }>(
          `SELECT
             COALESCE(SUM(o.total_amount), 0)::text AS revenue,
             COUNT(o.id)::text AS order_count,
             (SELECT COUNT(*)::text FROM visits v
              WHERE (v.visited_at AT TIME ZONE 'Asia/Amman')::date = timezone('Asia/Amman', now())::date) AS visit_count
           FROM orders o
           WHERE (o.created_at AT TIME ZONE 'Asia/Amman')::date = timezone('Asia/Amman', now())::date`
        ),
        query<{ revenue: string; order_count: string }>(
          `SELECT
             COALESCE(SUM(o.total_amount), 0)::text AS revenue,
             COUNT(o.id)::text AS order_count
           FROM orders o
           WHERE (o.created_at AT TIME ZONE 'Asia/Amman')::date = timezone('Asia/Amman', now())::date - 1`
        ),
        query<{ day: string; revenue: string; order_count: string; visit_count: string }>(
          `WITH days AS (
             SELECT (timezone('Asia/Amman', now())::date - offs) AS day
             FROM generate_series(13, 0, -1) AS offs
           )
           SELECT d.day::text AS day,
                  COALESCE(SUM(o.total_amount), 0)::text AS revenue,
                  COUNT(o.id)::text AS order_count,
                  (SELECT COUNT(*)::text FROM visits v
                   WHERE (v.visited_at AT TIME ZONE 'Asia/Amman')::date = d.day) AS visit_count
           FROM days d
           LEFT JOIN orders o ON (o.created_at AT TIME ZONE 'Asia/Amman')::date = d.day
           GROUP BY d.day
           ORDER BY d.day ASC`
        ),
        query<{ cash_revenue: string; deferred_revenue: string }>(
          `SELECT
             COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END), 0)::text AS cash_revenue,
             COALESCE(SUM(CASE WHEN payment_type = 'deferred' THEN total_amount ELSE 0 END), 0)::text AS deferred_revenue
           FROM orders
           WHERE created_at >= ${monthStart}`
        ),
        query<{ count: string }>(
          `SELECT COUNT(DISTINCT representative_id)::text AS count
           FROM orders
           WHERE (created_at AT TIME ZONE 'Asia/Amman')::date = timezone('Asia/Amman', now())::date`
        ),
      ]);

      const noBuyCountByNote = new Map(noBuyByReasonRows.map((r) => [r.note, parseInt(r.count, 10)]));

      const t = totals[0];
      const p = period[0];
      const deferredRevenue = parseFloat(t?.deferred_revenue ?? "0");
      const paymentsRecorded = parseFloat(t?.payments_recorded ?? "0");
      const todayRevenue = parseFloat(todayStats[0]?.revenue ?? "0");
      const todayOrderCount = parseInt(todayStats[0]?.order_count ?? "0", 10);
      const todayVisitCount = parseInt(todayStats[0]?.visit_count ?? "0", 10);
      const yesterdayRevenue = parseFloat(yesterdayStats[0]?.revenue ?? "0");
      const yesterdayOrderCount = parseInt(yesterdayStats[0]?.order_count ?? "0", 10);

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
        today: {
          revenue: todayRevenue,
          orderCount: todayOrderCount,
          visitCount: todayVisitCount,
          activeReps: parseInt(activeRepsToday[0]?.count ?? "0", 10),
          avgOrderValue: todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0,
          conversionRate: todayVisitCount > 0 ? todayOrderCount / todayVisitCount : 0,
        },
        yesterday: {
          revenue: yesterdayRevenue,
          orderCount: yesterdayOrderCount,
        },
        dailySales: dailySalesRows.map((row) => ({
          date: row.day,
          revenue: parseFloat(row.revenue),
          orderCount: parseInt(row.order_count, 10),
          visitCount: parseInt(row.visit_count, 10),
        })),
        paymentMixMonth: {
          cash: parseFloat(monthPaymentMix[0]?.cash_revenue ?? "0"),
          deferred: parseFloat(monthPaymentMix[0]?.deferred_revenue ?? "0"),
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
        loyalty: {
          totalPointsIssued: parseInt(loyaltyTotals[0]?.total_points ?? "0", 10),
          monthPointsEarned: parseInt(loyaltyTotals[0]?.month_points ?? "0", 10),
        },
        topStoresLoyalty: topStoresLoyalty.map((row) => ({
          storeId: row.store_id,
          name: row.name,
          areaName: row.area_name,
          balance: parseInt(row.balance, 10),
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
        noBuyVisits: {
          monthCount: parseInt(noBuyMonthCount[0]?.count ?? "0", 10),
          byReason: NO_BUY_REASONS.map((reason) => ({
            reason,
            count: noBuyCountByNote.get(reason) ?? 0,
          })),
          recent: recentNoBuyVisits.map((row) => ({
            id: row.id,
            visitedAt: row.visited_at,
            reason: row.note,
            storeId: row.store_id,
            storeName: row.store_name,
            areaName: row.area_name,
            repName: row.rep_name,
          })),
        },
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
        `SELECT id, name, governorate, center_lat, center_lng, radius_km, created_at FROM areas ORDER BY governorate NULLS LAST, name ASC`
      );
      res.json({ areas: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/areas/voronoi",
  adminAuthMiddleware,
  requireAdminPermission("areas.read"),
  async (_req, res, next) => {
    try {
      res.json(await buildJordanVoronoiPayload());
    } catch (e) {
      next(e);
    }
  }
);

const areaSchema = z.object({
  name: z.string().trim().min(2).max(255),
  governorate: z.string().trim().min(2).max(64).optional().nullable(),
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
        `INSERT INTO areas (name, governorate, center_lat, center_lng, radius_km)
         VALUES ($1, $2, $3, $4, COALESCE($5, 2.5))
         RETURNING id, name, governorate, center_lat, center_lng, radius_km, created_at`,
        [
          body.name,
          body.governorate ?? null,
          body.centerLat ?? null,
          body.centerLng ?? null,
          body.radiusKm ?? null,
        ]
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
           governorate = COALESCE($2, governorate),
           center_lat = COALESCE($3, center_lat),
           center_lng = COALESCE($4, center_lng),
           radius_km = COALESCE($5, radius_km)
         WHERE id = $6
         RETURNING id, name, governorate, center_lat, center_lng, radius_km, created_at`,
        [
          body.name,
          body.governorate ?? null,
          body.centerLat ?? null,
          body.centerLng ?? null,
          body.radiusKm ?? null,
          id,
        ]
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

router.get(
  "/areas/governorate-coverage",
  adminAuthMiddleware,
  requireAdminPermission("areas.read"),
  async (_req, res, next) => {
    try {
      const items = [];
      for (const g of JORDAN_GOVERNORATES) {
        const areaName = `${g.name}${GOVERNORATE_AREA_SUFFIX}`;
        const { rows } = await query<{
          id: number;
          governorate_full_coverage: boolean;
          radius_km: string;
        }>(
          `SELECT id, governorate_full_coverage, radius_km FROM areas WHERE name = $1 LIMIT 1`,
          [areaName]
        );
        const row = rows[0];
        items.push({
          governorate: g.name,
          areaId: row?.id ?? null,
          areaName,
          enabled: row?.governorate_full_coverage ?? true,
          centerLat: g.centerLat,
          centerLng: g.centerLng,
          radiusKm: row ? parseFloat(row.radius_km) : g.radiusKm,
        });
      }
      res.json({ governorates: items });
    } catch (e) {
      next(e);
    }
  }
);

const governorateCoverageSchema = z.object({
  governorate: z.string().trim().min(2).max(64),
  enabled: z.boolean(),
});

router.patch(
  "/areas/governorate-coverage",
  adminAuthMiddleware,
  requireAdminPermission("areas.write"),
  async (req, res, next) => {
    try {
      const body = governorateCoverageSchema.parse(req.body);
      const known = JORDAN_GOVERNORATES.some((g) => g.name === body.governorate);
      if (!known) throw new HttpError(400, "محافظة غير معروفة");
      const areaName = `${body.governorate}${GOVERNORATE_AREA_SUFFIX}`;
      const { rows } = await query(
        `UPDATE areas SET governorate_full_coverage = $1 WHERE name = $2
         RETURNING id, name, governorate, governorate_full_coverage, radius_km`,
        [body.enabled, areaName]
      );
      if (!rows[0]) throw new HttpError(404, "منطقة تغطية المحافظة غير موجودة — شغّل seed:jordan-areas");
      res.json({
        governorate: body.governorate,
        areaId: rows[0].id,
        areaName: rows[0].name,
        enabled: rows[0].governorate_full_coverage,
        radiusKm: parseFloat(String(rows[0].radius_km)),
      });
    } catch (e) {
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
  loyaltyPointsPerUnit: z.number().int().min(0).optional(),
  redeemPointsPerUnit: z.number().int().min(0).optional(),
  redeemEnabled: z.boolean().optional(),
});

router.get(
  "/products",
  adminAuthMiddleware,
  requireAdminPermission("products.read"),
  async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, name, designation, unit_label, carton_spec, dimensions_cm, carton_weight_kg, image_url, price,
                loyalty_points_per_unit, redeem_points_per_unit, redeem_enabled, is_active, created_at
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
        `INSERT INTO products (name, designation, unit_label, carton_spec, dimensions_cm, carton_weight_kg, image_url, price,
                              loyalty_points_per_unit, redeem_points_per_unit, redeem_enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
          body.loyaltyPointsPerUnit ?? 0,
          body.redeemPointsPerUnit ?? 0,
          body.redeemEnabled ?? false,
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
  loyaltyPointsPerUnit: z.number().int().min(0).optional(),
  redeemPointsPerUnit: z.number().int().min(0).optional(),
  redeemEnabled: z.boolean().optional(),
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
      if (body.loyaltyPointsPerUnit !== undefined) {
        map.push(["loyalty_points_per_unit", body.loyaltyPointsPerUnit]);
      }
      if (body.redeemPointsPerUnit !== undefined) {
        map.push(["redeem_points_per_unit", body.redeemPointsPerUnit]);
      }
      if (body.redeemEnabled !== undefined) map.push(["redeem_enabled", body.redeemEnabled]);
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

router.get(
  "/redeem/redemptions",
  adminAuthMiddleware,
  requireAdminPermission("redeem.read"),
  async (req, res, next) => {
    try {
      const limit = Math.min(100, Math.max(1, z.coerce.number().int().parse(req.query.limit ?? 50)));
      const { rows } = await query<{
        id: string;
        created_at: string;
        total_points_spent: number;
        store_id: number;
        store_name: string;
        rep_name: string;
        lines_json: string;
      }>(
        `SELECT pr.id::text, pr.created_at, pr.total_points_spent, pr.store_id, s.name AS store_name,
                r.full_name AS rep_name,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'productId', p.id,
                      'productName', p.name,
                      'quantity', prl.quantity,
                      'pointsPerUnit', prl.points_per_unit,
                      'pointsSpent', prl.points_spent
                    )
                    ORDER BY prl.id
                  ) FILTER (WHERE prl.id IS NOT NULL),
                  '[]'
                )::text AS lines_json
         FROM prize_redemptions pr
         JOIN stores s ON s.id = pr.store_id
         JOIN representatives r ON r.id = pr.representative_id
         LEFT JOIN prize_redemption_lines prl ON prl.redemption_id = pr.id
         LEFT JOIN products p ON p.id = prl.product_id
         GROUP BY pr.id, pr.created_at, pr.total_points_spent, pr.store_id, s.name, r.full_name
         ORDER BY pr.created_at DESC
         LIMIT $1`,
        [limit]
      );
      res.json({
        redemptions: rows.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          totalPointsSpent: row.total_points_spent,
          storeId: row.store_id,
          storeName: row.store_name,
          repName: row.rep_name,
          lines: JSON.parse(row.lines_json) as unknown[],
        })),
      });
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
});

router.get(
  "/representatives",
  adminAuthMiddleware,
  requireAdminPermission("reps.read"),
  async (_req, res, next) => {
    try {
      const { rows } = await query(`
        SELECT r.*,
          COALESCE(
            json_agg(
              json_build_object('dayOfWeek', rs.day_of_week, 'zoneName', rz.name)
              ORDER BY rs.day_of_week
            ) FILTER (WHERE rs.day_of_week IS NOT NULL),
            '[]'
          ) AS route_schedule
        FROM representatives r
        LEFT JOIN rep_route_schedule rs ON rs.representative_id = r.id
        LEFT JOIN route_zones rz ON rz.id = rs.route_zone_id
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
           AND (r.car_fill_at IS NULL OR o.created_at >= r.car_fill_at)
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
         INNER JOIN representatives r ON r.id = o.representative_id
         INNER JOIN order_lines ol ON ol.order_id = o.id
         INNER JOIN products p ON p.id = ol.product_id
         WHERE (o.created_at AT TIME ZONE 'Asia/Amman')::date = $1::date
           AND (r.car_fill_at IS NULL OR o.created_at >= r.car_fill_at)
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
          SELECT r.*,
            COALESCE(
              json_agg(
                json_build_object('dayOfWeek', rs.day_of_week, 'zoneName', rz.name)
                ORDER BY rs.day_of_week
              ) FILTER (WHERE rs.day_of_week IS NOT NULL),
              '[]'
            ) AS route_schedule
          FROM representatives r
          LEFT JOIN rep_route_schedule rs ON rs.representative_id = r.id
          LEFT JOIN route_zones rz ON rz.id = rs.route_zone_id
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
  price: z.number().min(0).nullable().optional(),
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
        `SELECT p.id AS product_id, p.name, p.designation, p.image_url,
                p.price AS catalog_price,
                COALESCE(ri.price, p.price) AS price,
                ri.price AS rep_price,
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
      let salesReset = false;
      try {
        await c.query("BEGIN");
        const { rows: beforeRows } = await c.query<{ product_id: number; quantity: number }>(
          `SELECT product_id, quantity FROM representative_inventory WHERE representative_id = $1`,
          [id]
        );
        const beforeQty = new Map(beforeRows.map((row) => [row.product_id, row.quantity]));

        for (const item of body.items) {
          const repPrice =
            item.price === undefined ? null : item.price === null ? null : item.price.toFixed(2);
          await c.query(
            `INSERT INTO representative_inventory (representative_id, product_id, quantity, price, updated_at)
             VALUES ($1, $2, $3, $4, now())
             ON CONFLICT (representative_id, product_id)
             DO UPDATE SET
               quantity = EXCLUDED.quantity,
               price = CASE
                 WHEN $5::boolean THEN EXCLUDED.price
                 ELSE representative_inventory.price
               END,
               updated_at = now()`,
            [id, item.productId, item.quantity, repPrice, item.price !== undefined]
          );
        }

        salesReset = body.items.some((item) => item.quantity > (beforeQty.get(item.productId) ?? 0));
        if (salesReset) {
          await c.query(`UPDATE representatives SET car_fill_at = now() WHERE id = $1`, [id]);
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
      res.json({ inventory: rows, salesReset });
    } catch (e) {
      next(e);
    }
  }
);

const repRouteScheduleEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  routeZoneId: z.number().int().positive().nullable(),
});

const repRouteSchedulePutSchema = z.object({
  entries: z.array(repRouteScheduleEntrySchema),
});

router.get(
  "/representatives/:id/route-schedule",
  adminAuthMiddleware,
  requireAdminPermission("reps.read"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows: repRows } = await query(`SELECT id FROM representatives WHERE id = $1`, [id]);
      if (!repRows[0]) throw new HttpError(404, "المندوب غير موجود");

      const { rows } = await query<{
        day_of_week: number;
        route_zone_id: number;
        zone_name: string;
      }>(
        `SELECT rs.day_of_week, rs.route_zone_id, rz.name AS zone_name
         FROM rep_route_schedule rs
         JOIN route_zones rz ON rz.id = rs.route_zone_id
         WHERE rs.representative_id = $1
         ORDER BY rs.day_of_week ASC`,
        [id]
      );

      const byDay = new Map(rows.map((r) => [r.day_of_week, r]));
      res.json({
        schedule: ARABIC_WEEKDAY_NAMES.map((dayName, dayOfWeek) => {
          const hit = byDay.get(dayOfWeek);
          return {
            dayOfWeek,
            dayName,
            routeZoneId: hit?.route_zone_id ?? null,
            routeZoneName: hit?.zone_name ?? null,
          };
        }),
      });
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  "/representatives/:id/route-schedule",
  adminAuthMiddleware,
  requireAdminPermission("reps.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = repRouteSchedulePutSchema.parse(req.body);
      const { rows: repRows } = await query(`SELECT id FROM representatives WHERE id = $1`, [id]);
      if (!repRows[0]) throw new HttpError(404, "المندوب غير موجود");

      const zoneIds = body.entries
        .map((e) => e.routeZoneId)
        .filter((z): z is number => z != null);
      if (zoneIds.length) {
        const { rows: zones } = await query<{ id: number }>(
          `SELECT id FROM route_zones WHERE id = ANY($1::int[]) AND is_active = true`,
          [zoneIds]
        );
        if (zones.length !== new Set(zoneIds).size) {
          throw new HttpError(400, "منطقة مسار غير موجودة أو غير مفعّلة");
        }
      }

      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query(`DELETE FROM rep_route_schedule WHERE representative_id = $1`, [id]);
        for (const entry of body.entries) {
          if (entry.routeZoneId == null) continue;
          await c.query(
            `INSERT INTO rep_route_schedule (representative_id, day_of_week, route_zone_id)
             VALUES ($1, $2, $3)`,
            [id, entry.dayOfWeek, entry.routeZoneId]
          );
        }
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }

      const { rows } = await query<{
        day_of_week: number;
        route_zone_id: number;
        zone_name: string;
      }>(
        `SELECT rs.day_of_week, rs.route_zone_id, rz.name AS zone_name
         FROM rep_route_schedule rs
         JOIN route_zones rz ON rz.id = rs.route_zone_id
         WHERE rs.representative_id = $1
         ORDER BY rs.day_of_week ASC`,
        [id]
      );
      const byDay = new Map(rows.map((r) => [r.day_of_week, r]));
      res.json({
        schedule: ARABIC_WEEKDAY_NAMES.map((dayName, dayOfWeek) => {
          const hit = byDay.get(dayOfWeek);
          return {
            dayOfWeek,
            dayName,
            routeZoneId: hit?.route_zone_id ?? null,
            routeZoneName: hit?.zone_name ?? null,
          };
        }),
      });
    } catch (e) {
      next(e);
    }
  }
);

const googlePlacesImportSchema = z.object({
  governorate: z.string().min(1).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusM: z.coerce.number().min(200).max(50000).optional(),
  gridStepKm: z.coerce.number().min(0.8).max(12).optional(),
  /** Clear unmatched prospects for the governorate (or all) before re-importing groceries/markets. */
  regenerate: z.boolean().optional(),
});

router.get(
  "/google-places",
  adminAuthMiddleware,
  requireAdminPermission("stores.read"),
  async (req, res, next) => {
    try {
      const governorate = typeof req.query.governorate === "string" ? req.query.governorate : undefined;
      const unmatchedOnly = req.query.unmatched === "1" || req.query.unmatched === "true";
      const params: (string | boolean)[] = [];
      let where = "WHERE 1=1";
      if (governorate) {
        params.push(governorate);
        where += ` AND a.governorate = $${params.length}`;
      }
      if (unmatchedOnly) {
        where += " AND g.matched_store_id IS NULL";
      }
      const { rows } = await query(
        `SELECT g.id, g.place_id, g.name, g.phone, g.address_text,
                g.location_lat, g.location_lng, g.google_maps_url, g.business_status,
                g.imported_at, g.matched_store_id,
                a.name AS area_name, a.governorate,
                s.name AS matched_store_name
         FROM google_map_places g
         LEFT JOIN areas a ON a.id = g.area_id
         LEFT JOIN stores s ON s.id = g.matched_store_id
         ${where}
         ORDER BY g.name ASC
         LIMIT 2000`,
        params
      );
      res.json({ places: rows, googlePlacesEnabled: isGooglePlacesEnabled() });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/google-places/import",
  adminAuthMiddleware,
  requireAdminPermission("stores.write"),
  async (req, res, next) => {
    try {
      if (!isGooglePlacesEnabled()) {
        throw new HttpError(
          503,
          "Google Places غير مفعّل — أضف GOOGLE_MAPS_API_KEY مع تفعيل Places API في Google Cloud"
        );
      }
      const body = googlePlacesImportSchema.parse(req.body ?? {});
      const result = await importGooglePlaces(body);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

const prospectStatusSchema = z.enum(["open", "converted", "dismissed"]).optional();

router.get(
  "/prospect-stores",
  adminAuthMiddleware,
  requireAdminPermission("stores.read"),
  async (req, res, next) => {
    try {
      const status = prospectStatusSchema.parse(req.query.status);
      const params: unknown[] = [];
      const statusFilter = status ? `AND ps.status = $1` : "";
      if (status) params.push(status);
      const { rows } = await query(
        `SELECT ps.id, ps.name, ps.phone, ps.owner_name, ps.location_lat, ps.location_lng,
                ps.address_text, ps.image_url, ps.area_id, ps.status, ps.converted_store_id,
                ps.created_at, ps.updated_at,
                a.name AS area_name,
                r.full_name AS created_by_rep_name,
                cs.name AS converted_store_name
         FROM prospect_stores ps
         JOIN areas a ON a.id = ps.area_id
         JOIN representatives r ON r.id = ps.created_by_representative_id
         LEFT JOIN stores cs ON cs.id = ps.converted_store_id
         WHERE 1=1 ${statusFilter}
         ORDER BY ps.id DESC
         LIMIT 500`,
        params
      );
      res.json({ prospects: rows });
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/prospect-stores/:id",
  adminAuthMiddleware,
  requireAdminPermission("stores.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = z
        .object({
          status: z.enum(["open", "dismissed"]).optional(),
          name: z.string().min(2).optional(),
          phone: z.string().min(6).optional(),
          ownerName: z.string().min(2).optional(),
        })
        .parse(req.body);
      const sets: string[] = ["updated_at = now()"];
      const vals: unknown[] = [];
      let i = 1;
      if (body.status) {
        sets.push(`status = $${i++}`);
        vals.push(body.status);
      }
      if (body.name) {
        sets.push(`name = $${i++}`);
        vals.push(body.name);
      }
      if (body.phone) {
        sets.push(`phone = $${i++}`);
        vals.push(body.phone);
      }
      if (body.ownerName) {
        sets.push(`owner_name = $${i++}`);
        vals.push(body.ownerName);
      }
      vals.push(id);
      const { rows } = await query(
        `UPDATE prospect_stores SET ${sets.join(", ")} WHERE id = $${i} AND status <> 'converted' RETURNING id`,
        vals
      );
      if (!rows[0]) throw new HttpError(404, "العميل المحتمل غير موجود أو تم تحويله");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/loyalty/settings",
  adminAuthMiddleware,
  requireAdminPermission("stores.read"),
  async (_req, res, next) => {
    try {
      const expiryDays = await getLoyaltyExpiryDays();
      res.json({ expiryDays });
    } catch (e) {
      next(e);
    }
  }
);

const patchLoyaltySettingsSchema = z.object({
  expiryDays: z.number().int().min(1).max(3650),
});

router.patch(
  "/loyalty/settings",
  adminAuthMiddleware,
  requireAdminPermission("stores.write"),
  async (req, res, next) => {
    try {
      const body = patchLoyaltySettingsSchema.parse(req.body);
      await query(
        `UPDATE loyalty_settings SET expiry_days = $1, updated_at = now() WHERE id = 1`,
        [body.expiryDays]
      );
      res.json({ expiryDays: body.expiryDays });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/loyalty/period-audit",
  adminAuthMiddleware,
  requireAdminPermission("stores.read"),
  async (_req, res, next) => {
    try {
      const audit = await getLoyaltyPeriodAudit();
      res.json(audit);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/loyalty/sync-periods",
  adminAuthMiddleware,
  requireAdminPermission("stores.write"),
  async (_req, res, next) => {
    try {
      const result = await syncLoyaltyPeriodsFromFirstPurchase();
      const audit = await getLoyaltyPeriodAudit();
      res.json({ ...result, audit });
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
        SELECT s.*, a.name AS area_name, qc.public_token AS qr_public_token,
          r.full_name AS registered_by_rep_name
        FROM stores s
        JOIN areas a ON a.id = s.area_id
        JOIN qr_codes qc ON qc.id = s.qr_code_id
        LEFT JOIN representatives r ON r.id = s.registered_by_representative_id
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

const patchStoreSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  phone: z.string().trim().min(1).max(40).optional(),
  ownerName: z.string().trim().min(1).max(255).optional(),
  locationLat: z.number().finite().optional(),
  locationLng: z.number().finite().optional(),
  addressText: z.string().max(2000).nullable().optional(),
  imageUrl: optionalStoredImagePathNullableSchema.optional(),
  areaId: z.number().int().positive().optional(),
});

router.patch(
  "/stores/:id",
  adminAuthMiddleware,
  requireAdminPermission("stores.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = patchStoreSchema.parse(req.body);

      if (body.areaId != null) {
        const { rows: areaRows } = await query(`SELECT id FROM areas WHERE id = $1`, [body.areaId]);
        if (!areaRows[0]) throw new HttpError(400, "المنطقة غير موجودة");
      }

      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (body.name !== undefined) {
        sets.push(`name = $${i++}`);
        vals.push(body.name);
      }
      if (body.phone !== undefined) {
        sets.push(`phone = $${i++}`);
        vals.push(body.phone);
      }
      if (body.ownerName !== undefined) {
        sets.push(`owner_name = $${i++}`);
        vals.push(body.ownerName);
      }
      if (body.locationLat !== undefined) {
        sets.push(`location_lat = $${i++}`);
        vals.push(body.locationLat);
      }
      if (body.locationLng !== undefined) {
        sets.push(`location_lng = $${i++}`);
        vals.push(body.locationLng);
      }
      if (body.addressText !== undefined) {
        sets.push(`address_text = $${i++}`);
        vals.push(body.addressText);
      }
      if (body.imageUrl !== undefined) {
        sets.push(`image_url = $${i++}`);
        vals.push(body.imageUrl);
      }
      if (body.areaId !== undefined) {
        sets.push(`area_id = $${i++}`);
        vals.push(body.areaId);
      }

      if (sets.length === 0) throw new HttpError(400, "لا توجد حقول للتحديث");

      vals.push(id);
      const { rowCount } = await query(
        `UPDATE stores SET ${sets.join(", ")}, updated_at = now() WHERE id = $${i}`,
        vals
      );
      if (!rowCount) throw new HttpError(404, "المتجر غير موجود");

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
      res.json({ store: rows[0] });
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/stores/:id",
  adminAuthMiddleware,
  requireAdminPermission("stores.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows: ord } = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM orders WHERE store_id = $1`,
        [id]
      );
      if (parseInt(ord[0]?.n ?? "0", 10) > 0) {
        throw new HttpError(409, "لا يمكن حذف متجر مرتبط بطلبات.");
      }
      const { rows: redeem } = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM prize_redemptions WHERE store_id = $1`,
        [id]
      );
      if (parseInt(redeem[0]?.n ?? "0", 10) > 0) {
        throw new HttpError(409, "لا يمكن حذف متجر مرتبط باستبدالات جوائز.");
      }
      const { rowCount } = await query(`DELETE FROM stores WHERE id = $1`, [id]);
      if (!rowCount) throw new HttpError(404, "المتجر غير موجود");
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);

const visitsListQuerySchema = z.object({
  noBuyOnly: z
    .enum(["1", "0", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

router.get(
  "/visits",
  adminAuthMiddleware,
  requireAdminPermission("stores.read"),
  async (req, res, next) => {
    try {
      const q = visitsListQuerySchema.parse(req.query);
      const params = q.noBuyOnly ? [[...NO_BUY_REASONS]] : [];
      const noBuyFilter = q.noBuyOnly
        ? `AND v.note = ANY($1::text[]) AND ${VISIT_WITHOUT_ORDER_SAME_DAY_SQL}`
        : "";
      const { rows } = await query<{
        id: string;
        visited_at: string;
        note: string | null;
        store_id: number;
        store_name: string;
        area_name: string;
        rep_id: number;
        rep_name: string;
        had_order_same_day: boolean;
      }>(
        `SELECT v.id::text, v.visited_at, v.note, s.id AS store_id, s.name AS store_name,
                a.name AS area_name, r.id AS rep_id, r.full_name AS rep_name,
                (${VISIT_HAD_ORDER_SAME_DAY_SQL}) AS had_order_same_day
         FROM visits v
         JOIN stores s ON s.id = v.store_id
         JOIN areas a ON a.id = s.area_id
         JOIN representatives r ON r.id = v.representative_id
         WHERE 1=1 ${noBuyFilter}
         ORDER BY v.id DESC
         LIMIT 300`,
        params
      );
      res.json({
        visits: rows.map((v) => ({
          id: v.id,
          visitedAt: v.visited_at,
          note: v.note,
          isNoBuyReason: isNoBuyVisit(v.note, v.had_order_same_day),
          storeId: v.store_id,
          storeName: v.store_name,
          areaName: v.area_name,
          repId: v.rep_id,
          repName: v.rep_name,
        })),
        noBuyReasons: [...NO_BUY_REASONS],
      });
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
      const { rows } = await query<{
        id: string;
        visited_at: string;
        note: string | null;
        rep_name: string;
        had_order_same_day: boolean;
      }>(
        `SELECT v.id::text AS id, v.visited_at, v.note, r.full_name AS rep_name,
                (${VISIT_HAD_ORDER_SAME_DAY_SQL}) AS had_order_same_day
         FROM visits v
         JOIN representatives r ON r.id = v.representative_id
         WHERE v.store_id = $1
         ORDER BY v.id DESC
         LIMIT 100`,
        [id]
      );
      res.json({
        visits: rows.map((v) => ({
          id: v.id,
          visited_at: v.visited_at,
          note: v.note,
          rep_name: v.rep_name,
          isNoBuyReason: isNoBuyVisit(v.note, v.had_order_same_day),
        })),
      });
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
      const monthStart = `date_trunc('month', timezone('Asia/Amman', now()))`;

      const [ordersResult, summaryResult] = await Promise.all([
        query(
          storeId
            ? `SELECT o.id, o.representative_id, o.store_id, o.payment_type, o.total_amount, o.created_at,
                      s.name AS store_name, r.full_name AS rep_name
               FROM orders o
               INNER JOIN stores s ON s.id = o.store_id
               INNER JOIN representatives r ON r.id = o.representative_id
               WHERE o.store_id = $1
               ORDER BY o.id DESC`
            : `SELECT o.id, o.representative_id, o.store_id, o.payment_type, o.total_amount, o.created_at,
                      s.name AS store_name, r.full_name AS rep_name
               FROM orders o
               INNER JOIN stores s ON s.id = o.store_id
               INNER JOIN representatives r ON r.id = o.representative_id
               ORDER BY o.id DESC`,
          storeId ? [storeId] : []
        ),
        storeId
          ? query<{
              total_count: number;
              total_revenue: string;
              month_count: number;
              month_revenue: string;
            }>(
              `SELECT
                 COUNT(*)::int AS total_count,
                 COALESCE(SUM(o.total_amount), 0)::text AS total_revenue,
                 COUNT(*) FILTER (WHERE o.created_at >= ${monthStart})::int AS month_count,
                 COALESCE(SUM(o.total_amount) FILTER (WHERE o.created_at >= ${monthStart}), 0)::text AS month_revenue
               FROM orders o
               WHERE o.store_id = $1`,
              [storeId]
            )
          : query<{
              total_count: number;
              total_revenue: string;
              month_count: number;
              month_revenue: string;
            }>(
              `SELECT
                 COUNT(*)::int AS total_count,
                 COALESCE(SUM(total_amount), 0)::text AS total_revenue,
                 COUNT(*) FILTER (WHERE created_at >= ${monthStart})::int AS month_count,
                 COALESCE(SUM(total_amount) FILTER (WHERE created_at >= ${monthStart}), 0)::text AS month_revenue
               FROM orders`
            ),
      ]);

      const s = summaryResult.rows[0];
      res.json({
        orders: ordersResult.rows,
        summary: {
          totalCount: s?.total_count ?? 0,
          totalRevenue: parseFloat(s?.total_revenue ?? "0"),
          monthOrderCount: s?.month_count ?? 0,
          monthRevenue: parseFloat(s?.month_revenue ?? "0"),
        },
      });
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

const routeZoneBodySchema = z.object({
  name: z.string().trim().min(2).max(255),
  notes: z.string().max(2000).nullable().optional(),
  areaIds: z.array(z.number().int().positive()).min(1),
  isActive: z.boolean().optional(),
});

router.get(
  "/route-zones",
  adminAuthMiddleware,
  requireAdminPermission("areas.read"),
  async (_req, res, next) => {
    try {
      const { rows: zones } = await query<{
        id: number;
        name: string;
        notes: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>(`SELECT * FROM route_zones ORDER BY name ASC`);

      const { rows: links } = await query<{ route_zone_id: number; area_id: number; area_name: string }>(
        `SELECT rza.route_zone_id, rza.area_id, a.name AS area_name
         FROM route_zone_areas rza
         JOIN areas a ON a.id = rza.area_id
         ORDER BY a.name ASC`
      );

      const areasByZone = new Map<number, { id: number; name: string }[]>();
      for (const l of links) {
        if (!areasByZone.has(l.route_zone_id)) areasByZone.set(l.route_zone_id, []);
        areasByZone.get(l.route_zone_id)!.push({ id: l.area_id, name: l.area_name });
      }

      res.json({
        routeZones: zones.map((z) => ({
          id: z.id,
          name: z.name,
          notes: z.notes,
          isActive: z.is_active,
          areas: areasByZone.get(z.id) ?? [],
          createdAt: z.created_at,
          updatedAt: z.updated_at,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/route-zones",
  adminAuthMiddleware,
  requireAdminPermission("areas.write"),
  async (req, res, next) => {
    try {
      const body = routeZoneBodySchema.parse(req.body);
      const { rows: areaCheck } = await query<{ id: number }>(
        `SELECT id FROM areas WHERE id = ANY($1::int[])`,
        [body.areaIds]
      );
      if (areaCheck.length !== body.areaIds.length) {
        throw new HttpError(400, "بعض المناطق المختارة غير موجودة");
      }

      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const ins = await c.query<{ id: number }>(
          `INSERT INTO route_zones (name, notes) VALUES ($1, $2) RETURNING id`,
          [body.name, body.notes ?? null]
        );
        const zoneId = ins.rows[0]!.id;
        for (const aid of body.areaIds) {
          await c.query(
            `INSERT INTO route_zone_areas (route_zone_id, area_id) VALUES ($1, $2)`,
            [zoneId, aid]
          );
        }
        await c.query("COMMIT");
        res.status(201).json({ id: zoneId });
      } catch (e) {
        await c.query("ROLLBACK");
        if (e instanceof DatabaseError && e.code === "23505") {
          throw new HttpError(409, "اسم منطقة المسار مستخدم مسبقاً");
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

router.patch(
  "/route-zones/:id",
  adminAuthMiddleware,
  requireAdminPermission("areas.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const body = routeZoneBodySchema.partial().parse(req.body);

      if (body.areaIds?.length) {
        const { rows: areaCheck } = await query<{ id: number }>(
          `SELECT id FROM areas WHERE id = ANY($1::int[])`,
          [body.areaIds]
        );
        if (areaCheck.length !== body.areaIds.length) {
          throw new HttpError(400, "بعض المناطق المختارة غير موجودة");
        }
      }

      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const sets: string[] = ["updated_at = now()"];
        const vals: unknown[] = [];
        let i = 1;
        if (body.name !== undefined) {
          sets.push(`name = $${i++}`);
          vals.push(body.name);
        }
        if (body.notes !== undefined) {
          sets.push(`notes = $${i++}`);
          vals.push(body.notes);
        }
        if (body.isActive !== undefined) {
          sets.push(`is_active = $${i++}`);
          vals.push(body.isActive);
        }
        if (sets.length > 1) {
          vals.push(id);
          const { rowCount } = await c.query(
            `UPDATE route_zones SET ${sets.join(", ")} WHERE id = $${i}`,
            vals
          );
          if (!rowCount) throw new HttpError(404, "منطقة المسار غير موجودة");
        }

        if (body.areaIds !== undefined) {
          await c.query(`DELETE FROM route_zone_areas WHERE route_zone_id = $1`, [id]);
          for (const aid of body.areaIds) {
            await c.query(
              `INSERT INTO route_zone_areas (route_zone_id, area_id) VALUES ($1, $2)`,
              [id, aid]
            );
          }
        }
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        if (e instanceof DatabaseError && e.code === "23505") {
          throw new HttpError(409, "اسم منطقة المسار مستخدم مسبقاً");
        }
        throw e;
      } finally {
        c.release();
      }

      const { rows: zones } = await query(`SELECT id FROM route_zones WHERE id = $1`, [id]);
      if (!zones[0]) throw new HttpError(404, "منطقة المسار غير موجودة");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/route-zones/:id",
  adminAuthMiddleware,
  requireAdminPermission("areas.write"),
  async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const { rows: used } = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM rep_route_schedule WHERE route_zone_id = $1`,
        [id]
      );
      if (parseInt(used[0]?.n ?? "0", 10) > 0) {
        throw new HttpError(409, "لا يمكن حذف منطقة مسار مربوطة بجدول مندوب — عطّلها أو غيّر الجداول أولاً");
      }
      const { rowCount } = await query(`DELETE FROM route_zones WHERE id = $1`, [id]);
      if (!rowCount) throw new HttpError(404, "منطقة المسار غير موجودة");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
