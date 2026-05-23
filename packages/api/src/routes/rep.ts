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
} from "../utils/geo.js";
import { parseQrPublicToken } from "../utils/qrToken.js";

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
    const resolved = await resolveAreaIdForRep(lat, lng, req.rep!.areaIds);
    res.json(resolved);
  } catch (e) {
    next(e);
  }
});

router.get("/inventory", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    const { rows } = await query(
      `SELECT p.id, p.name, p.designation, p.unit_label, p.image_url, p.price, ri.quantity
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

async function loadStoreForRep(storeId: number, rep: { areaIds: number[] }) {
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
    deferred_payment_enabled: boolean;
    owner_portal_token: string;
    qr_public_token: string;
  }>(
    `SELECT s.*, qc.public_token AS qr_public_token
     FROM stores s
     JOIN qr_codes qc ON qc.id = s.qr_code_id
     WHERE s.id = $1`,
    [storeId]
  );
  const s = rows[0];
  if (!s) throw new HttpError(404, "المتجر غير موجود");
  if (!rep.areaIds.includes(s.area_id)) throw new HttpError(403, "المتجر ليس ضمن مناطقك");
  const ownerPortalUrl = `${config.ownerPortalBaseUrl}/owner?t=${encodeURIComponent(s.owner_portal_token)}`;
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    ownerName: s.owner_name,
    location: { lat: s.location_lat, lng: s.location_lng },
    addressText: s.address_text,
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
    let areaId = body.areaId;
    if (areaId == null) {
      const resolved = await resolveAreaIdForRep(body.locationLat, body.locationLng, rep.areaIds);
      areaId = resolved.areaId;
    }
    if (!rep.areaIds.includes(areaId)) throw new HttpError(403, "المنطقة غير مخصصة لك");

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
      res.status(201).json({ store });
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

async function loadStoreRowForRep(storeId: number, rep: { areaIds: number[] }) {
  const { rows } = await query<{
    id: number;
    area_id: number;
    location_lat: number;
    location_lng: number;
    deferred_payment_enabled: boolean;
  }>(`SELECT id, area_id, location_lat, location_lng, deferred_payment_enabled FROM stores WHERE id = $1`, [
    storeId,
  ]);
  const s = rows[0];
  if (!s) throw new HttpError(404, "المتجر غير موجود");
  if (!rep.areaIds.includes(s.area_id)) throw new HttpError(403, "المتجر ليس ضمن مناطقك");
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
      const priced: { productId: number; quantity: number; unitPrice: number; lineTotal: number }[] = [];
      for (const line of body.lines) {
        const pr = await c.query<{ price: string; is_active: boolean }>(
          `SELECT price, is_active FROM products WHERE id = $1`,
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
        total += lineTotal;
        priced.push({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: unit,
          lineTotal,
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
          `INSERT INTO order_lines (order_id, product_id, quantity, unit_price, line_total)
           VALUES ($1,$2,$3,$4,$5)`,
          [orderId, l.productId, l.quantity, l.unitPrice, l.lineTotal.toFixed(2)]
        );
        await c.query(
          `UPDATE representative_inventory
           SET quantity = quantity - $1, updated_at = now()
           WHERE representative_id = $2 AND product_id = $3`,
          [l.quantity, rep.id, l.productId]
        );
      }
      await c.query("COMMIT");
      res.status(201).json({ orderId, totalAmount: total });
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
