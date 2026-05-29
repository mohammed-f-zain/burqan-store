import { randomBytes } from "node:crypto";

import { Router } from "express";
import { z } from "zod";

import { imageUpload } from "../lib/uploadConfig.js";
import { query, pool } from "../db/pool.js";
import { repAuthMiddleware } from "../middleware/repAuth.js";
import { HttpError } from "../utils/errors.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signRepToken } from "../utils/jwt.js";
import { config } from "../config.js";
import { optionalStoredImagePathSchema } from "../utils/storedImagePath.js";
import {
  assertWithinScanDistance,
  repLocationSchema,
  resolveAreaIdForRep,
  resolveAreaIdFromAllAreas,
} from "../utils/geo.js";
import { parseQrPublicToken } from "../utils/qrToken.js";
import { areaBboxParams, EXCLUDE_GRID_AREA_SQL } from "../utils/areaQuery.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const { rows } = await query<{
      id: number;
      password_hash: string;
      is_active: boolean;
    }>(`SELECT id, password_hash, is_active FROM representatives WHERE lower(email) = lower($1)`, [
      body.email,
    ]);
    const row = rows[0];
    if (!row || !row.is_active) throw new HttpError(401, "بيانات الدخول غير صحيحة");
    const ok = await verifyPassword(body.password, row.password_hash);
    if (!ok) throw new HttpError(401, "بيانات الدخول غير صحيحة");
    const token = signRepToken(row.id);
    res.json({ token, tokenType: "rep" });
  } catch (e) {
    next(e);
  }
});

router.get("/me", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    const { rows: profileRows } = await query<{
      phone: string;
      image_url: string | null;
      car_plate: string | null;
    }>(`SELECT phone, image_url, car_plate FROM representatives WHERE id = $1`, [rep.id]);
    const profile = profileRows[0];
    const { rows: areaRows } = await query<{ id: number; name: string }>(
      `SELECT a.id, a.name FROM areas a
       INNER JOIN representative_areas ra ON ra.area_id = a.id
       WHERE ra.representative_id = $1
       ORDER BY a.name ASC`,
      [rep.id]
    );
    const { rows: invRows } = await query<{ sku_count: string; total_units: string }>(
      `SELECT COUNT(*)::text AS sku_count,
              COALESCE(SUM(quantity), 0)::text AS total_units
       FROM representative_inventory
       WHERE representative_id = $1 AND quantity > 0`,
      [rep.id]
    );
    const inv = invRows[0];
    res.json({
      representative: {
        id: rep.id,
        email: rep.email,
        fullName: rep.fullName,
        phone: profile?.phone ?? "",
        imageUrl: profile?.image_url ?? null,
        carPlate: profile?.car_plate ?? null,
        areas: areaRows,
        inventory: {
          skuCount: parseInt(inv?.sku_count ?? "0", 10),
          totalUnits: parseInt(inv?.total_units ?? "0", 10),
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/upload",
  repAuthMiddleware,
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

router.get("/areas", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    const { rows } = await query(
      `SELECT a.id, a.name, a.center_lat, a.center_lng, a.radius_km FROM areas a
       INNER JOIN representative_areas ra ON ra.area_id = a.id
       WHERE ra.representative_id = $1
       ORDER BY a.name ASC`,
      [rep.id]
    );
    res.json({ areas: rows });
  } catch (e) {
    next(e);
  }
});

router.get("/areas/resolve", repAuthMiddleware, async (req, res, next) => {
  try {
    const lat = z.coerce.number().parse(req.query.lat);
    const lng = z.coerce.number().parse(req.query.lng);
    const forRegister = req.query.forRegister === "1" || req.query.forRegister === "true";
    const rep = req.rep!;
    const resolved = forRegister
      ? await resolveAreaIdFromAllAreas(lat, lng)
      : await resolveAreaIdForRep(lat, lng, rep.areaIds);
    res.json({
      ...resolved,
      assignedToRep: rep.areaIds.includes(resolved.areaId),
    });
  } catch (e) {
    next(e);
  }
});

const jordanAreasQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(5).max(80).optional(),
});

/** Jordan areas with geo boundaries (for registration map). Optional lat/lng narrows payload. */
router.get("/areas/jordan", repAuthMiddleware, async (req, res, next) => {
  try {
    const q = jordanAreasQuerySchema.parse(req.query);
    const params: (number | string)[] = [];
    let bboxSql = "";
    if (q.lat != null && q.lng != null) {
      const radiusKm = q.radiusKm ?? 22;
      const box = areaBboxParams(q.lat, q.lng, radiusKm);
      bboxSql = ` AND center_lat BETWEEN $1 AND $2 AND center_lng BETWEEN $3 AND $4`;
      params.push(box.minLat, box.maxLat, box.minLng, box.maxLng);
    }
    const { rows } = await query<{
      id: number;
      name: string;
      governorate: string | null;
      center_lat: number;
      center_lng: number;
      radius_km: string;
    }>(
      `SELECT id, name, governorate, center_lat, center_lng, radius_km
       FROM areas
       WHERE center_lat IS NOT NULL AND center_lng IS NOT NULL
         AND ${EXCLUDE_GRID_AREA_SQL}${bboxSql}
       ORDER BY governorate NULLS LAST, name ASC`,
      params
    );
    res.json({
      areas: rows.map((r) => ({
        id: r.id,
        name: r.name,
        governorate: r.governorate,
        centerLat: r.center_lat,
        centerLng: r.center_lng,
        radiusKm: parseFloat(r.radius_km),
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.get("/inventory", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    const { rows } = await query(
      `SELECT p.id, p.name, p.designation, p.unit_label, p.carton_spec, p.dimensions_cm,
              p.carton_weight_kg, p.image_url, p.price, ri.quantity
       FROM representative_inventory ri
       INNER JOIN products p ON p.id = ri.product_id AND p.is_active = true
       WHERE ri.representative_id = $1 AND ri.quantity > 0
       ORDER BY p.name ASC`,
      [rep.id]
    );
    res.json({ inventory: rows });
  } catch (e) {
    next(e);
  }
});

router.get("/products", repAuthMiddleware, async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, designation, unit_label, carton_spec, dimensions_cm, carton_weight_kg, image_url, price
       FROM products WHERE is_active = true ORDER BY name ASC`
    );
    res.json({ products: rows });
  } catch (e) {
    next(e);
  }
});

const qrQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Resolve QR token: unassigned pool code vs existing store */
router.get("/qr/:token", repAuthMiddleware, async (req, res, next) => {
  try {
    const token = z.string().min(16).max(512).transform(parseQrPublicToken).pipe(z.string().min(16).max(64)).parse(req.params.token);
    const loc = qrQuerySchema.parse(req.query);
    const { rows } = await query<{
      qr_id: string;
      public_token: string;
      store_id: number | null;
      location_lat: number | null;
      location_lng: number | null;
    }>(
      `SELECT qc.id::text AS qr_id, qc.public_token, s.id AS store_id,
              s.location_lat, s.location_lng
       FROM qr_codes qc
       LEFT JOIN stores s ON s.qr_code_id = qc.id
       WHERE qc.public_token = $1`,
      [token]
    );
    const row = rows[0];
    if (!row) throw new HttpError(404, "رمز QR غير معروف");
    if (!row.store_id) {
      return res.json({
        status: "unassigned",
        qr: { id: row.qr_id, publicToken: row.public_token },
        assignUrlHint: `${config.qrPayloadBaseUrl}/r/${row.public_token}`,
      });
    }
    if (row.location_lat != null && row.location_lng != null) {
      assertWithinScanDistance(loc.lat, loc.lng, row.location_lat, row.location_lng);
    }
    const store = await loadStoreForRep(row.store_id, req.rep!);
    await recordRepVisit(req.rep!.id, row.store_id);
    res.json({ status: "assigned", store, visitRecorded: true });
  } catch (e) {
    next(e);
  }
});

async function recordRepVisit(repId: number, storeId: number, note?: string | null) {
  const { rows } = await query(
    `INSERT INTO visits (representative_id, store_id, note) VALUES ($1, $2, $3) RETURNING *`,
    [repId, storeId, note ?? null]
  );
  return rows[0];
}

function repCanAccessStore(
  rep: { id: number; areaIds: number[] },
  store: { area_id: number; registered_by_representative_id: number | null }
): boolean {
  return (
    rep.areaIds.includes(store.area_id) || store.registered_by_representative_id === rep.id
  );
}

async function loadStoreForRep(storeId: number, rep: { id: number; areaIds: number[] }) {
  const { rows } = await query<{
    id: number;
    name: string;
    phone: string;
    owner_name: string;
    location_lat: number;
    location_lng: number;
    address_text: string | null;
    image_url: string | null;
    area_id: number;
    registered_by_representative_id: number | null;
    deferred_payment_enabled: boolean;
    owner_portal_token: string;
    qr_public_token: string;
    area_name: string;
  }>(
    `SELECT s.*, qc.public_token AS qr_public_token, a.name AS area_name
     FROM stores s
     JOIN qr_codes qc ON qc.id = s.qr_code_id
     JOIN areas a ON a.id = s.area_id
     WHERE s.id = $1`,
    [storeId]
  );
  const s = rows[0];
  if (!s) throw new HttpError(404, "المتجر غير موجود");
  if (!repCanAccessStore(rep, s)) throw new HttpError(403, "المتجر ليس ضمن مناطقك");
  const ownerPortalUrl = `${config.ownerPortalBaseUrl}/owner?t=${encodeURIComponent(s.owner_portal_token)}`;
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    ownerName: s.owner_name,
    location: { lat: s.location_lat, lng: s.location_lng },
    addressText: s.address_text,
    areaName: s.area_name,
    imageUrl: s.image_url,
    areaId: s.area_id,
    deferredPaymentEnabled: s.deferred_payment_enabled,
    qrPublicToken: s.qr_public_token,
    ownerPortalUrl,
  };
}

const registerStoreSchema = z.object({
  qrPublicToken: z.string().min(16).max(64),
  name: z.string().min(2),
  phone: z.string().min(6),
  ownerName: z.string().min(2),
  locationLat: z.number(),
  locationLng: z.number(),
  addressText: z.string().optional(),
  imageUrl: optionalStoredImagePathSchema,
  areaId: z.number().int().positive().optional(),
});

router.post("/stores/register", repAuthMiddleware, async (req, res, next) => {
  try {
    const body = registerStoreSchema.parse(req.body);
    const rep = req.rep!;
    const resolved = await resolveAreaIdFromAllAreas(body.locationLat, body.locationLng);
    const areaId = resolved.areaId;

    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const qr = await c.query<{ id: string }>(
        `SELECT qc.id FROM qr_codes qc
         WHERE qc.public_token = $1
           AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.qr_code_id = qc.id)
         FOR UPDATE`,
        [body.qrPublicToken]
      );
      if (!qr.rows[0]) throw new HttpError(409, "رمز QR مستخدم مسبقاً أو غير صالح");

      const ownerToken = randomBytes(24).toString("hex");
      const ins = await c.query<{ id: number }>(
        `INSERT INTO stores (
           qr_code_id, name, phone, owner_name, location_lat, location_lng, address_text, image_url,
           area_id, deferred_payment_enabled, owner_portal_token, registered_by_representative_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$11)
         RETURNING id`,
        [
          qr.rows[0].id,
          body.name,
          body.phone,
          body.ownerName,
          body.locationLat,
          body.locationLng,
          body.addressText ?? null,
          body.imageUrl || null,
          areaId,
          ownerToken,
          rep.id,
        ]
      );
      const storeId = ins.rows[0]!.id;
      await c.query(
        `INSERT INTO visits (representative_id, store_id, note) VALUES ($1, $2, $3)`,
        [rep.id, storeId, "Registration visit"]
      );
      await c.query("COMMIT");
      const store = await loadStoreForRep(storeId, rep);
      res.status(201).json({
        store,
        areaName: resolved.areaName,
        assignedToRep: rep.areaIds.includes(areaId),
      });
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  } catch (e) {
    next(e);
  }
});

/** All stores in rep areas; includes visit status for today (Asia/Amman calendar day). */
router.get("/stores/daily", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    if (!rep.areaIds.length) {
      return res.json({ stores: [] });
    }
    const { rows } = await query<{
      id: number;
      name: string;
      phone: string;
      owner_name: string;
      location_lat: number;
      location_lng: number;
      address_text: string | null;
      deferred_payment_enabled: boolean;
      area_name: string;
      visited_today: boolean;
      visit_note: string | null;
    }>(
      `SELECT s.id, s.name, s.phone, s.owner_name, s.location_lat, s.location_lng,
              s.address_text, s.deferred_payment_enabled, a.name AS area_name,
              EXISTS (
                SELECT 1 FROM visits v
                WHERE v.store_id = s.id
                  AND v.representative_id = $2
                  AND (v.visited_at AT TIME ZONE 'Asia/Amman')::date =
                      (NOW() AT TIME ZONE 'Asia/Amman')::date
              ) AS visited_today,
              (
                SELECT v.note FROM visits v
                WHERE v.store_id = s.id
                  AND v.representative_id = $2
                  AND (v.visited_at AT TIME ZONE 'Asia/Amman')::date =
                      (NOW() AT TIME ZONE 'Asia/Amman')::date
                ORDER BY v.visited_at DESC
                LIMIT 1
              ) AS visit_note
       FROM stores s
       JOIN areas a ON a.id = s.area_id
       WHERE s.area_id = ANY($1::int[])
       ORDER BY visited_today ASC, a.name ASC, s.name ASC`,
      [rep.areaIds, rep.id]
    );
    res.json({
      stores: rows.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        ownerName: s.owner_name,
        location: { lat: s.location_lat, lng: s.location_lng },
        addressText: s.address_text,
        areaName: s.area_name,
        deferredPaymentEnabled: s.deferred_payment_enabled,
        visitedToday: s.visited_today,
        visitNote: s.visit_note,
      })),
    });
  } catch (e) {
    next(e);
  }
});

const visitNoteSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
});

/** Attach note to today's latest visit for this rep at the store (from QR scan). */
router.patch("/stores/:id/today-visit-note", repAuthMiddleware, async (req, res, next) => {
  try {
    const storeId = z.coerce.number().int().positive().parse(req.params.id);
    const body = visitNoteSchema.parse(req.body);
    const rep = req.rep!;
    await loadStoreForRep(storeId, rep);
    const note = body.note?.trim() ? body.note.trim() : null;
    const { rows } = await query<{ id: string; visited_at: string; note: string | null }>(
      `UPDATE visits SET note = $1
       WHERE id = (
         SELECT id FROM visits
         WHERE representative_id = $2 AND store_id = $3
           AND (visited_at AT TIME ZONE 'Asia/Amman')::date =
               (NOW() AT TIME ZONE 'Asia/Amman')::date
         ORDER BY visited_at DESC
         LIMIT 1
       )
       RETURNING id, visited_at, note`,
      [note, rep.id, storeId]
    );
    if (!rows[0]) throw new HttpError(404, "لا توجد زيارة مسجّلة اليوم لهذا المتجر");
    res.json({ visit: rows[0] });
  } catch (e) {
    next(e);
  }
});

router.get("/stores/:id/visits", repAuthMiddleware, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    await loadStoreForRep(id, req.rep!);
    const { rows } = await query(
      `SELECT id, visited_at, note FROM visits WHERE store_id = $1 ORDER BY id DESC LIMIT 100`,
      [id]
    );
    res.json({ visits: rows });
  } catch (e) {
    next(e);
  }
});

router.get("/stores/:id", repAuthMiddleware, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const store = await loadStoreForRep(id, req.rep!);
    res.json({ store });
  } catch (e) {
    next(e);
  }
});

router.get("/stores/:id/orders", repAuthMiddleware, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    await loadStoreForRep(id, req.rep!);
    const { rows } = await query(
      `SELECT o.id, o.payment_type, o.total_amount, o.created_at,
              json_agg(json_build_object(
                'productId', ol.product_id,
                'quantity', ol.quantity,
                'unitPrice', ol.unit_price,
                'lineTotal', ol.line_total
              )) AS lines
       FROM orders o
       JOIN order_lines ol ON ol.order_id = o.id
       WHERE o.store_id = $1
       GROUP BY o.id
       ORDER BY o.id DESC
       LIMIT 100`,
      [id]
    );
    res.json({ orders: rows });
  } catch (e) {
    next(e);
  }
});

const visitSchema = z.object({
  storeId: z.number().int().positive(),
  note: z.string().optional(),
  repLat: z.number().min(-90).max(90),
  repLng: z.number().min(-180).max(180),
});

router.post("/visits", repAuthMiddleware, async (req, res, next) => {
  try {
    const body = visitSchema.parse(req.body);
    const storeRow = await loadStoreRowForRep(body.storeId, req.rep!);
    assertWithinScanDistance(body.repLat, body.repLng, storeRow.location_lat, storeRow.location_lng);
    const visit = await recordRepVisit(req.rep!.id, body.storeId, body.note);
    res.status(201).json({ visit });
  } catch (e) {
    next(e);
  }
});

const orderLineSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

const orderSchema = z.object({
  storeId: z.number().int().positive(),
  paymentType: z.enum(["cash", "deferred"]),
  lines: z.array(orderLineSchema).min(1),
  repLat: z.number().min(-90).max(90),
  repLng: z.number().min(-180).max(180),
});

async function loadStoreRowForRep(storeId: number, rep: { id: number; areaIds: number[] }) {
  const { rows } = await query<{
    id: number;
    area_id: number;
    registered_by_representative_id: number | null;
    location_lat: number;
    location_lng: number;
    deferred_payment_enabled: boolean;
  }>(
    `SELECT id, area_id, registered_by_representative_id, location_lat, location_lng, deferred_payment_enabled
     FROM stores WHERE id = $1`,
    [storeId]
  );
  const s = rows[0];
  if (!s) throw new HttpError(404, "المتجر غير موجود");
  if (!repCanAccessStore(rep, s)) throw new HttpError(403, "المتجر ليس ضمن مناطقك");
  return s;
}

router.post("/orders", repAuthMiddleware, async (req, res, next) => {
  try {
    const body = orderSchema.parse(req.body);
    const rep = req.rep!;
    const storeRow = await loadStoreRowForRep(body.storeId, rep);
    assertWithinScanDistance(body.repLat, body.repLng, storeRow.location_lat, storeRow.location_lng);
    const store = await loadStoreForRep(body.storeId, rep);
    if (body.paymentType === "deferred" && !store.deferredPaymentEnabled) {
      throw new HttpError(403, "البيع الآجل غير مفعّل لهذا المتجر");
    }

    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      let total = 0;
      const priced: {
        productId: number;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        loyaltyPoints: number;
      }[] = [];
      let orderLoyaltyTotal = 0;
      for (const line of body.lines) {
        const pr = await c.query<{ price: string; is_active: boolean; loyalty_points_per_unit: number }>(
          `SELECT price, is_active, loyalty_points_per_unit FROM products WHERE id = $1`,
          [line.productId]
        );
        const p = pr.rows[0];
        if (!p?.is_active) throw new HttpError(400, "منتج غير صالح");
        const inv = await c.query<{ quantity: number }>(
          `SELECT quantity FROM representative_inventory
           WHERE representative_id = $1 AND product_id = $2
           FOR UPDATE`,
          [rep.id, line.productId]
        );
        const stock = inv.rows[0]?.quantity ?? 0;
        if (stock < line.quantity) {
          throw new HttpError(400, `الكمية غير كافية في مخزون السيارة (متوفر: ${stock})`);
        }
        const unit = parseFloat(p.price);
        const lineTotal = unit * line.quantity;
        const loyaltyPoints = Math.max(0, Number(p.loyalty_points_per_unit) || 0) * line.quantity;
        total += lineTotal;
        orderLoyaltyTotal += loyaltyPoints;
        priced.push({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: unit,
          lineTotal,
          loyaltyPoints,
        });
      }
      const ord = await c.query<{ id: string }>(
        `INSERT INTO orders (representative_id, store_id, payment_type, total_amount)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [rep.id, body.storeId, body.paymentType, total.toFixed(2)]
      );
      const orderId = ord.rows[0]!.id;
      for (const l of priced) {
        await c.query(
          `INSERT INTO order_lines (order_id, product_id, quantity, unit_price, line_total, loyalty_points_earned)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [orderId, l.productId, l.quantity, l.unitPrice, l.lineTotal.toFixed(2), l.loyaltyPoints]
        );
        await c.query(
          `UPDATE representative_inventory
           SET quantity = quantity - $1, updated_at = now()
           WHERE representative_id = $2 AND product_id = $3`,
          [l.quantity, rep.id, l.productId]
        );
      }
      if (orderLoyaltyTotal > 0) {
        await c.query(
          `UPDATE stores SET loyalty_points_balance = loyalty_points_balance + $1, updated_at = now()
           WHERE id = $2`,
          [orderLoyaltyTotal, body.storeId]
        );
      }
      await c.query("COMMIT");
      res.status(201).json({ orderId, totalAmount: total, loyaltyPointsEarned: orderLoyaltyTotal });
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  } catch (e) {
    next(e);
  }
});

export default router;
