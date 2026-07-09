import { randomBytes } from "node:crypto";

import { Router } from "express";
import { z } from "zod";

import { imageUpload } from "../lib/uploadConfig.js";
import { isNoBuyReasonNote } from "../data/noBuyReasons.js";
import { isNotRegisterReasonNote } from "../data/notRegisterReasons.js";
import { query, pool } from "../db/pool.js";
import { repAuthMiddleware } from "../middleware/repAuth.js";
import { HttpError } from "../utils/errors.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signRepToken } from "../utils/jwt.js";
import { config } from "../config.js";
import {
  optionalStoredImagePathNullableSchema,
  optionalStoredImagePathSchema,
} from "../utils/storedImagePath.js";
import {
  assertWithinScanDistance,
  repLocationSchema,
  resolveAreaIdForRep,
  resolveAreaForRepRoute,
} from "../utils/geo.js";
import { parseQrPublicToken } from "../utils/qrToken.js";
import { buildJordanVoronoiPayload } from "../utils/buildJordanVoronoiPayload.js";
import { expandRepAreaIds } from "../utils/expandRepAreaIds.js";
import {
  awardLoyaltyPoints,
  expireStoreLoyaltyIfNeeded,
  getStoreLoyaltyState,
} from "../utils/loyaltyExpiry.js";
import {
  ammanDayOfWeek,
  ARABIC_WEEKDAY_NAMES,
  formatDistanceM,
  getRepRouteZoneForDay,
  getRepTodayWorkAreaIds,
  sortStoresByDistance,
} from "../utils/routeZones.js";
import {
  countGooglePlacesForRep,
  fetchAllGooglePlacesForRep,
  fetchGooglePlacesForArea,
  fetchGooglePlacesSummary,
  mapGooglePlaceDto,
  searchGooglePlacesForRep,
} from "../utils/repGooglePlacesQuery.js";

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
    const today = await getRepTodayWorkAreaIds(rep.id);
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
        areas: today.route
          ? today.route.routeZone.areaNames.map((name, i) => ({
              id: today.route!.routeZone.areaIds[i] ?? i,
              name,
            }))
          : [],
        routeToday: today.route
          ? {
              dayOfWeek: today.dayOfWeek,
              dayName: today.dayName,
              zoneId: today.route.routeZone.id,
              zoneName: today.route.routeZone.name,
              areas: today.route.routeZone.areaNames,
            }
          : null,
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
    const today = await getRepTodayWorkAreaIds(rep.id);
    if (!today.expandedAreaIds.length) {
      return res.json({ areas: [] });
    }
    const { rows } = await query(
      `SELECT a.id, a.name, a.center_lat, a.center_lng, a.radius_km FROM areas a
       WHERE a.id = ANY($1::int[])
       ORDER BY a.name ASC`,
      [today.expandedAreaIds]
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
    const today = await getRepTodayWorkAreaIds(rep.id);
    if (forRegister) {
      const resolved = await resolveAreaForRepRoute(lat, lng, today.expandedAreaIds);
      return res.json(resolved);
    }
    const resolved = await resolveAreaIdForRep(lat, lng, today.expandedAreaIds);
    res.json({
      ...resolved,
      assignedToRep: today.expandedAreaIds.includes(resolved.areaId),
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

/** Jordan Voronoi map (registration + rep tools). Optional lat/lng narrows visible cells. */
router.get("/areas/jordan", repAuthMiddleware, async (req, res, next) => {
  try {
    const q = jordanAreasQuerySchema.parse(req.query);
    const payload = await buildJordanVoronoiPayload(
      q.lat != null && q.lng != null
        ? { lat: q.lat, lng: q.lng, radiusKm: q.radiusKm ?? 28 }
        : undefined
    );
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

router.get("/areas/voronoi", repAuthMiddleware, async (req, res, next) => {
  try {
    const q = jordanAreasQuerySchema.parse(req.query);
    const payload = await buildJordanVoronoiPayload(
      q.lat != null && q.lng != null
        ? { lat: q.lat, lng: q.lng, radiusKm: q.radiusKm ?? 22 }
        : undefined
    );
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

router.get("/inventory", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    const { rows } = await query(
      `SELECT p.id, p.name, p.designation, p.unit_label, p.carton_spec, p.dimensions_cm,
              p.carton_weight_kg, p.image_url,
              p.price AS catalog_price,
              COALESCE(ri.price, p.price) AS price,
              ri.price AS rep_price,
              ri.quantity
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

function repCanAccessStore(store: { area_id: number }, expandedAreaIds: number[]): boolean {
  return expandedAreaIds.includes(store.area_id);
}

function formatAreaLabel(name: string, governorate: string | null): string {
  const gov = governorate?.trim();
  return gov ? `${name} · ${gov}` : name;
}

async function loadStoreForRep(storeId: number, rep: { id: number }) {
  const today = await getRepTodayWorkAreaIds(rep.id);
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
    governorate: string | null;
    loyalty_points_balance: number;
  }>(
    `SELECT s.*, qc.public_token AS qr_public_token, a.name AS area_name, a.governorate
     FROM stores s
     JOIN qr_codes qc ON qc.id = s.qr_code_id
     JOIN areas a ON a.id = s.area_id
     WHERE s.id = $1`,
    [storeId]
  );
  const s = rows[0];
  if (!s) throw new HttpError(404, "المتجر غير موجود");
  if (!repCanAccessStore(s, today.expandedAreaIds)) {
    throw new HttpError(403, "المتجر ليس ضمن مسار اليوم");
  }
  const ownerPortalUrl = `${config.ownerPortalBaseUrl}/owner?t=${encodeURIComponent(s.owner_portal_token)}`;
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    ownerName: s.owner_name,
    location: { lat: s.location_lat, lng: s.location_lng },
    addressText: s.address_text,
    areaName: formatAreaLabel(s.area_name, s.governorate),
    imageUrl: s.image_url,
    areaId: s.area_id,
    deferredPaymentEnabled: s.deferred_payment_enabled,
    qrPublicToken: s.qr_public_token,
    ownerPortalUrl,
    loyaltyPointsBalance: s.loyalty_points_balance,
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
    const today = await getRepTodayWorkAreaIds(rep.id);
    const resolved = await resolveAreaForRepRoute(
      body.locationLat,
      body.locationLng,
      today.expandedAreaIds
    );
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
        assignedToRep: resolved.assignedToRep,
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

const prospectStoreSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6),
  ownerName: z.string().min(2),
  locationLat: z.number(),
  locationLng: z.number(),
  addressText: z.string().optional(),
  imageUrl: optionalStoredImagePathSchema,
  visitNote: z.string().max(2000).optional(),
});

const prospectConvertSchema = z.object({
  qrPublicToken: z.string().min(16).max(64),
  repLat: z.number().min(-90).max(90),
  repLng: z.number().min(-180).max(180),
});

function mapProspectRow(row: {
  id: number;
  name: string;
  phone: string;
  owner_name: string;
  location_lat: number;
  location_lng: number;
  address_text: string | null;
  image_url: string | null;
  area_id: number;
  area_name: string;
  status: string;
  converted_store_id: number | null;
  created_at: string;
}) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    ownerName: row.owner_name,
    location: { lat: row.location_lat, lng: row.location_lng },
    addressText: row.address_text,
    imageUrl: row.image_url,
    areaId: row.area_id,
    areaName: row.area_name,
    status: row.status,
    convertedStoreId: row.converted_store_id,
    createdAt: row.created_at,
  };
}

async function loadProspectForRep(prospectId: number, rep: { id: number }) {
  const today = await getRepTodayWorkAreaIds(rep.id);
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
    area_name: string;
    status: string;
    converted_store_id: number | null;
    created_by_representative_id: number;
    created_at: string;
  }>(
    `SELECT ps.*, a.name AS area_name
     FROM prospect_stores ps
     JOIN areas a ON a.id = ps.area_id
     WHERE ps.id = $1`,
    [prospectId]
  );
  const p = rows[0];
  if (!p) throw new HttpError(404, "العميل المحتمل غير موجود");
  const canAccess = today.expandedAreaIds.includes(p.area_id);
  if (!canAccess) throw new HttpError(403, "ليس ضمن مسار اليوم");
  return p;
}

/** Possible clients (no QR) — open prospects in today's route zone only. */
router.get("/prospect-stores", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    const today = await getRepTodayWorkAreaIds(rep.id);
    const areaFilterIds = today.expandedAreaIds;
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
      area_name: string;
      status: string;
      converted_store_id: number | null;
      created_at: string;
      visited_today: boolean;
      today_visit_note: string | null;
    }>(
      `SELECT ps.id, ps.name, ps.phone, ps.owner_name, ps.location_lat, ps.location_lng,
              ps.address_text, ps.image_url, ps.area_id, ps.status, ps.converted_store_id,
              ps.created_at, a.name AS area_name,
              EXISTS (
                SELECT 1 FROM prospect_visits pv
                WHERE pv.prospect_store_id = ps.id
                  AND pv.representative_id = $2
                  AND (pv.visited_at AT TIME ZONE 'Asia/Amman')::date =
                      (NOW() AT TIME ZONE 'Asia/Amman')::date
              ) AS visited_today,
              (
                SELECT pv.note FROM prospect_visits pv
                WHERE pv.prospect_store_id = ps.id
                  AND pv.representative_id = $2
                  AND (pv.visited_at AT TIME ZONE 'Asia/Amman')::date =
                      (NOW() AT TIME ZONE 'Asia/Amman')::date
                ORDER BY pv.visited_at DESC
                LIMIT 1
              ) AS today_visit_note
       FROM prospect_stores ps
       JOIN areas a ON a.id = ps.area_id
       WHERE ps.status = 'open'
         AND ps.area_id = ANY($1::int[])
       ORDER BY visited_today ASC, a.name ASC, ps.name ASC`,
      [areaFilterIds, rep.id]
    );
    res.json({
      prospects: rows.map((r) => ({
        ...mapProspectRow(r),
        visitedToday: r.visited_today,
        todayVisitNote: r.today_visit_note,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/prospect-stores", repAuthMiddleware, async (req, res, next) => {
  try {
    const body = prospectStoreSchema.parse(req.body);
    const rep = req.rep!;
    const visitNote = body.visitNote?.trim() || null;
    if (visitNote && !isNotRegisterReasonNote(visitNote)) {
      throw new HttpError(400, "يرجى اختيار سبب عدم التسجيل من القائمة");
    }
    const today = await getRepTodayWorkAreaIds(rep.id);
    const resolved = await resolveAreaForRepRoute(
      body.locationLat,
      body.locationLng,
      today.expandedAreaIds
    );
    const { rows } = await query<{ id: number }>(
      `INSERT INTO prospect_stores (
         name, phone, owner_name, location_lat, location_lng, address_text, image_url,
         area_id, created_by_representative_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        body.name,
        body.phone,
        body.ownerName,
        body.locationLat,
        body.locationLng,
        body.addressText ?? null,
        body.imageUrl || null,
        resolved.areaId,
        rep.id,
      ]
    );
    const prospectId = rows[0]!.id;
    await query(
      `INSERT INTO prospect_visits (prospect_store_id, representative_id, note)
       VALUES ($1, $2, $3)`,
      [prospectId, rep.id, visitNote]
    );
    const loaded = await loadProspectForRep(prospectId, rep);
    res.status(201).json({
      prospect: mapProspectRow(loaded),
      areaName: resolved.areaName,
      assignedToRep: resolved.assignedToRep,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/prospect-stores/:id", repAuthMiddleware, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const p = await loadProspectForRep(id, req.rep!);
    res.json({ prospect: mapProspectRow(p) });
  } catch (e) {
    next(e);
  }
});

/** Link unassigned QR and convert prospect → registered store. */
router.post("/prospect-stores/:id/convert", repAuthMiddleware, async (req, res, next) => {
  try {
    const prospectId = z.coerce.number().int().positive().parse(req.params.id);
    const body = prospectConvertSchema.parse(req.body);
    const rep = req.rep!;
    const prospect = await loadProspectForRep(prospectId, rep);
    if (prospect.status !== "open") {
      throw new HttpError(409, "تم تحويل هذا العميل المحتمل مسبقاً");
    }
    assertWithinScanDistance(
      body.repLat,
      body.repLng,
      prospect.location_lat,
      prospect.location_lng
    );

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
          prospect.name,
          prospect.phone,
          prospect.owner_name,
          prospect.location_lat,
          prospect.location_lng,
          prospect.address_text,
          prospect.image_url,
          prospect.area_id,
          ownerToken,
          rep.id,
        ]
      );
      const storeId = ins.rows[0]!.id;
      await c.query(
        `INSERT INTO visits (representative_id, store_id, note) VALUES ($1, $2, $3)`,
        [rep.id, storeId, "Converted from possible client"]
      );
      await c.query(
        `UPDATE prospect_stores
         SET status = 'converted', converted_store_id = $1, updated_at = now()
         WHERE id = $2`,
        [storeId, prospectId]
      );
      await c.query("COMMIT");
      const store = await loadStoreForRep(storeId, rep);
      res.status(201).json({ store, prospectId, converted: true });
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

const prospectVisitBodySchema = repLocationSchema.extend({
  note: z.string().max(2000).optional().nullable(),
  kind: z.enum(["visit-note", "not-register-reason"]).optional(),
});

const prospectVisitNoteSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
  kind: z.enum(["visit-note", "not-register-reason"]).optional(),
});

async function getProspectTodayVisit(repId: number, prospectId: number) {
  const { rows } = await query<{ id: string; visited_at: string; note: string | null }>(
    `SELECT id, visited_at, note FROM prospect_visits
     WHERE representative_id = $1 AND prospect_store_id = $2
       AND (visited_at AT TIME ZONE 'Asia/Amman')::date =
           (NOW() AT TIME ZONE 'Asia/Amman')::date
     ORDER BY visited_at DESC
     LIMIT 1`,
    [repId, prospectId]
  );
  return rows[0] ?? null;
}

/** Whether today's prospect visit needs a not-register reason. */
router.get("/prospect-stores/:id/today-visit-status", repAuthMiddleware, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const rep = req.rep!;
    const prospect = await loadProspectForRep(id, rep);
    const todayVisit = await getProspectTodayVisit(rep.id, id);
    const visitedToday = Boolean(todayVisit);
    const todayVisitNote = todayVisit?.note ?? null;
    const requiresNotRegisterReason =
      prospect.status === "open" && visitedToday && !isNotRegisterReasonNote(todayVisitNote);
    res.json({
      visitedToday,
      todayVisitNote,
      requiresNotRegisterReason,
    });
  } catch (e) {
    next(e);
  }
});

/** Attach optional visit note or not-register reason to today's latest prospect visit. */
router.patch("/prospect-stores/:id/today-visit-note", repAuthMiddleware, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = prospectVisitNoteSchema.parse(req.body);
    const rep = req.rep!;
    const prospect = await loadProspectForRep(id, rep);
    if (prospect.status !== "open") throw new HttpError(409, "العميل المحتمل مغلق");
    const note = body.note?.trim() ? body.note.trim() : null;
    const kind =
      body.kind ?? (note && isNotRegisterReasonNote(note) ? "not-register-reason" : "visit-note");

    if (kind === "not-register-reason") {
      if (!note || !isNotRegisterReasonNote(note)) {
        throw new HttpError(400, "يرجى اختيار سبب عدم التسجيل من القائمة");
      }
    }

    const todayVisit = await getProspectTodayVisit(rep.id, id);
    if (!todayVisit) throw new HttpError(404, "لا توجد زيارة مسجّلة اليوم لهذا العميل المحتمل");

    const { rows } = await query<{ id: string; visited_at: string; note: string | null }>(
      `UPDATE prospect_visits SET note = $1 WHERE id = $2 RETURNING id, visited_at, note`,
      [note, todayVisit.id]
    );
    res.json({ visit: rows[0] });
  } catch (e) {
    next(e);
  }
});

/** Record a visit to a possible client today. */
router.post("/prospect-stores/:id/visits", repAuthMiddleware, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const rep = req.rep!;
    const prospect = await loadProspectForRep(id, rep);
    if (prospect.status !== "open") throw new HttpError(409, "العميل المحتمل مغلق");
    const body = prospectVisitBodySchema.parse(req.body);
    assertWithinScanDistance(
      body.repLat,
      body.repLng,
      prospect.location_lat,
      prospect.location_lng
    );

    const note = body.note?.trim() ? body.note.trim() : null;
    const kind =
      body.kind ?? (note && isNotRegisterReasonNote(note) ? "not-register-reason" : "visit-note");
    if (kind === "not-register-reason") {
      if (!note || !isNotRegisterReasonNote(note)) {
        throw new HttpError(400, "يرجى اختيار سبب عدم التسجيل من القائمة");
      }
    }

    const existing = await getProspectTodayVisit(rep.id, id);
    if (existing) {
      if (note != null) {
        const { rows } = await query<{ id: string; visited_at: string; note: string | null }>(
          `UPDATE prospect_visits SET note = $1 WHERE id = $2 RETURNING id, visited_at, note`,
          [note, existing.id]
        );
        return res.json({ visit: rows[0], created: false });
      }
      return res.json({ visit: existing, created: false });
    }

    const { rows } = await query<{ id: string; visited_at: string; note: string | null }>(
      `INSERT INTO prospect_visits (prospect_store_id, representative_id, note)
       VALUES ($1, $2, $3)
       RETURNING id, visited_at, note`,
      [id, rep.id, note]
    );
    res.status(201).json({ visit: rows[0], created: true });
  } catch (e) {
    next(e);
  }
});

const routeStoresQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Today's scheduled route zone for this rep (weekday in Asia/Amman). */
router.get("/route/today", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    const dayOfWeek = await ammanDayOfWeek();
    const route = await getRepRouteZoneForDay(rep.id, dayOfWeek);
    if (!route) {
      return res.json({
        active: false,
        dayOfWeek,
        dayName: ARABIC_WEEKDAY_NAMES[dayOfWeek],
        message: "لا يوجد مسار مجدول لهذا اليوم — تواصل مع الإدارة",
      });
    }
    res.json({
      active: true,
      dayOfWeek: route.dayOfWeek,
      dayName: route.dayName,
      routeZone: {
        id: route.routeZone.id,
        name: route.routeZone.name,
        notes: route.routeZone.notes,
        areaCount: route.routeZone.areaIds.length,
        areas: route.routeZone.areaNames,
      },
    });
  } catch (e) {
    next(e);
  }
});

const routeZoneStatusQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/** Today's route zone map + whether rep GPS is inside the zone. */
router.get("/route/zone-status", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    const q = routeZoneStatusQuerySchema.parse(req.query);
    const today = await getRepTodayWorkAreaIds(rep.id);

    if (!today.route) {
      return res.json({
        routeToday: null,
        inZone: null,
        geojson: { type: "FeatureCollection", features: [] },
        message: "لا يوجد مسار مجدول لهذا اليوم",
      });
    }

    if (!today.expandedAreaIds.length) {
      return res.json({
        routeToday: {
          dayName: today.dayName,
          zoneName: today.route.routeZone.name,
          zoneId: today.route.routeZone.id,
          areas: today.route.routeZone.areaNames,
        },
        inZone: null,
        geojson: { type: "FeatureCollection", features: [] },
        message: "منطقة المسار لا تحتوي مناطق",
      });
    }

    let inZone: boolean | null = null;
    if (q.lat != null && q.lng != null) {
      const resolved = await resolveAreaForRepRoute(q.lat, q.lng, today.expandedAreaIds);
      inZone = resolved.assignedToRep;
    }

    const payload = await buildJordanVoronoiPayload(
      q.lat != null && q.lng != null ? { lat: q.lat, lng: q.lng, radiusKm: 32 } : undefined
    );
    const zoneIdSet = new Set(today.expandedAreaIds);
    const geojson = {
      type: "FeatureCollection" as const,
      features: payload.geojson.features.filter((f) => zoneIdSet.has(f.properties.areaId)),
    };

    res.json({
      routeToday: {
        dayName: today.dayName,
        zoneName: today.route.routeZone.name,
        zoneId: today.route.routeZone.id,
        areas: today.route.routeZone.areaNames,
      },
      inZone,
      geojson,
    });
  } catch (e) {
    next(e);
  }
});

/** Stores in today's route zone, nearest first from rep GPS. */
router.get("/stores/route", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    const loc = routeStoresQuerySchema.parse(req.query);
    const dayOfWeek = await ammanDayOfWeek();
    const route = await getRepRouteZoneForDay(rep.id, dayOfWeek);

    if (!route?.expandedAreaIds.length) {
      return res.json({
        active: false,
        dayOfWeek,
        dayName: route?.dayName ?? ARABIC_WEEKDAY_NAMES[dayOfWeek],
        stores: [],
        message: route
          ? "منطقة المسار اليوم لا تحتوي مناطق — راجع الإدارة"
          : "لا يوجد مسار مجدول لهذا اليوم",
      });
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
      image_url: string | null;
      area_name: string;
      governorate: string | null;
      visited_today: boolean;
      visit_note: string | null;
    }>(
      `SELECT s.id, s.name, s.phone, s.owner_name, s.location_lat, s.location_lng,
              s.address_text, s.image_url, s.deferred_payment_enabled,
              a.name AS area_name, a.governorate,
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
       ORDER BY s.name ASC`,
      [route.expandedAreaIds, rep.id]
    );

    const sorted = sortStoresByDistance(rows, loc.lat, loc.lng);

    res.json({
      active: true,
      dayOfWeek: route.dayOfWeek,
      dayName: route.dayName,
      routeZone: {
        id: route.routeZone.id,
        name: route.routeZone.name,
        notes: route.routeZone.notes,
        areaCount: route.routeZone.areaIds.length,
        areas: route.routeZone.areaNames,
      },
      stores: sorted.map((s) => ({
        id: s.id,
        source: "burqan" as const,
        name: s.name,
        phone: s.phone,
        ownerName: s.owner_name,
        location: { lat: s.location_lat, lng: s.location_lng },
        addressText: s.address_text,
        imageUrl: s.image_url,
        areaName: formatAreaLabel(s.area_name, s.governorate),
        deferredPaymentEnabled: s.deferred_payment_enabled,
        visitedToday: s.visited_today,
        visitNote: s.visit_note,
        distanceM: Math.round(s.distance_m),
        distanceLabel: formatDistanceM(s.distance_m),
      })),
    });
  } catch (e) {
    next(e);
  }
});

/** Burqan stores in today's route zone for the home tab. */
router.get("/stores/daily", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    const today = await getRepTodayWorkAreaIds(rep.id);
    if (!today.expandedAreaIds.length) {
      return res.json({
        stores: [],
        googlePlacesReady: false,
        googlePlacesTotal: 0,
        routeToday: today.route
          ? { dayName: today.dayName, zoneName: today.route.routeZone.name }
          : null,
        message: today.route ? "لا متاجر في مسار اليوم" : "لا يوجد مسار مجدول لهذا اليوم",
      });
    }
    const areaFilterIds = today.expandedAreaIds;
    const { rows } = await query<{
      id: number;
      name: string;
      phone: string;
      owner_name: string;
      location_lat: number;
      location_lng: number;
      address_text: string | null;
      deferred_payment_enabled: boolean;
      image_url: string | null;
      area_name: string;
      governorate: string | null;
      visited_today: boolean;
      visit_note: string | null;
    }>(
      `SELECT s.id, s.name, s.phone, s.owner_name, s.location_lat, s.location_lng,
              s.address_text, s.image_url, s.deferred_payment_enabled,
              a.name AS area_name, a.governorate,
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
      [areaFilterIds, rep.id]
    );
    let googlePlacesReady = false;
    let googlePlacesTotal = 0;
    try {
      googlePlacesTotal = await countGooglePlacesForRep(areaFilterIds);
      googlePlacesReady = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("google_map_places")) throw e;
    }

    res.json({
      stores: rows.map((s) => ({
        id: s.id,
        source: "burqan" as const,
        name: s.name,
        phone: s.phone,
        ownerName: s.owner_name,
        location: { lat: s.location_lat, lng: s.location_lng },
        addressText: s.address_text,
        imageUrl: s.image_url,
        areaName: formatAreaLabel(s.area_name, s.governorate),
        deferredPaymentEnabled: s.deferred_payment_enabled,
        visitedToday: s.visited_today,
        visitNote: s.visit_note,
      })),
      googlePlacesReady,
      googlePlacesTotal,
      routeToday: today.route
        ? { dayName: today.dayName, zoneName: today.route.routeZone.name }
        : null,
    });
  } catch (e) {
    next(e);
  }
});

/** Google Maps prospects — summary / per-area / search (lazy load for mobile). */
router.get("/google-places", repAuthMiddleware, async (req, res, next) => {
  try {
    const rep = req.rep!;
    const today = await getRepTodayWorkAreaIds(rep.id);
    if (!today.expandedAreaIds.length) {
      return res.json({ places: [], areas: [], googlePlacesReady: false, total: 0 });
    }
    const areaFilterIds = today.expandedAreaIds;
    const summary = req.query.summary === "1" || req.query.summary === "true";
    const areaIdRaw = typeof req.query.areaId === "string" ? parseInt(req.query.areaId, 10) : NaN;
    const areaId = Number.isFinite(areaIdRaw) && areaIdRaw > 0 ? areaIdRaw : undefined;
    const searchQ = typeof req.query.q === "string" ? req.query.q.trim() : "";

    try {
      if (searchQ.length >= 2) {
        const rows = await searchGooglePlacesForRep(areaFilterIds, searchQ);
        const total = await countGooglePlacesForRep(areaFilterIds);
        return res.json({
          googlePlacesReady: true,
          mode: "search",
          total,
          places: rows.map(mapGooglePlaceDto),
        });
      }

      if (areaId != null) {
        const rows = await fetchGooglePlacesForArea(areaFilterIds, areaId);
        return res.json({
          googlePlacesReady: true,
          mode: "area",
          areaId,
          places: rows.map(mapGooglePlaceDto),
        });
      }

      if (summary || req.query.lazy !== "0") {
        const [areas, total] = await Promise.all([
          fetchGooglePlacesSummary(areaFilterIds),
          countGooglePlacesForRep(areaFilterIds),
        ]);
        return res.json({
          googlePlacesReady: true,
          mode: "summary",
          total,
          areas,
        });
      }

      const { total, places } = await fetchAllGooglePlacesForRep(areaFilterIds);
      return res.json({
        googlePlacesReady: true,
        mode: "full",
        total,
        truncated: places.length < total,
        places: places.map(mapGooglePlaceDto),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("google_map_places")) throw e;
      return res.json({ places: [], areas: [], googlePlacesReady: false, total: 0 });
    }
  } catch (e) {
    next(e);
  }
});

const visitNoteSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
  kind: z.enum(["visit-note", "no-buy-reason"]).optional(),
});

async function repHadOrderAtStoreToday(repId: number, storeId: number): Promise<boolean> {
  const { rows } = await query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM orders o
       WHERE o.representative_id = $1
         AND o.store_id = $2
         AND (o.created_at AT TIME ZONE 'Asia/Amman')::date =
             (NOW() AT TIME ZONE 'Asia/Amman')::date
     ) AS ok`,
    [repId, storeId]
  );
  return Boolean(rows[0]?.ok);
}

/** Whether today's visit needs a no-buy reason (no sale yet). */
router.get("/stores/:id/today-visit-status", repAuthMiddleware, async (req, res, next) => {
  try {
    const storeId = z.coerce.number().int().positive().parse(req.params.id);
    const rep = req.rep!;
    await loadStoreForRep(storeId, rep);
    const hadOrderToday = await repHadOrderAtStoreToday(rep.id, storeId);
    res.json({
      hadOrderToday,
      requiresNoBuyReason: !hadOrderToday,
    });
  } catch (e) {
    next(e);
  }
});

/** Attach optional visit note or no-buy reason to today's latest visit (end-visit modal). */
router.patch("/stores/:id/today-visit-note", repAuthMiddleware, async (req, res, next) => {
  try {
    const storeId = z.coerce.number().int().positive().parse(req.params.id);
    const body = visitNoteSchema.parse(req.body);
    const rep = req.rep!;
    await loadStoreForRep(storeId, rep);
    const note = body.note?.trim() ? body.note.trim() : null;
    const hadOrderToday = await repHadOrderAtStoreToday(rep.id, storeId);
    const kind =
      body.kind ??
      (hadOrderToday ? "visit-note" : note && isNoBuyReasonNote(note) ? "no-buy-reason" : "visit-note");

    if (kind === "no-buy-reason") {
      if (!note || !isNoBuyReasonNote(note)) {
        throw new HttpError(400, "يرجى اختيار سبب عدم الشراء من القائمة");
      }
      if (hadOrderToday) {
        throw new HttpError(400, "لا يمكن تسجيل سبب عدم الشراء بعد إتمام عملية بيع");
      }
    }
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

const repPatchStoreSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  phone: z.string().trim().min(6).max(40).optional(),
  ownerName: z.string().trim().min(2).max(255).optional(),
  addressText: z.string().max(2000).nullable().optional(),
  imageUrl: optionalStoredImagePathNullableSchema.optional(),
  locationLat: z.number().finite().optional(),
  locationLng: z.number().finite().optional(),
  repLat: z.number().min(-90).max(90).optional(),
  repLng: z.number().min(-180).max(180).optional(),
});

router.patch("/stores/:id", repAuthMiddleware, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = repPatchStoreSchema.parse(req.body);
    const rep = req.rep!;
    await loadStoreForRep(id, rep);

    if (body.locationLat !== undefined || body.locationLng !== undefined) {
      if (body.locationLat === undefined || body.locationLng === undefined) {
        throw new HttpError(400, "يجب تحديد خط العرض وخط الطول معاً");
      }
      if (body.repLat === undefined || body.repLng === undefined) {
        throw new HttpError(400, "يلزم موقع المندوب لتحديث موقع المتجر");
      }
      assertWithinScanDistance(body.repLat, body.repLng, body.locationLat, body.locationLng);
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
    if (body.addressText !== undefined) {
      sets.push(`address_text = $${i++}`);
      vals.push(body.addressText);
    }
    if (body.imageUrl !== undefined) {
      sets.push(`image_url = $${i++}`);
      vals.push(body.imageUrl);
    }
    if (body.locationLat !== undefined && body.locationLng !== undefined) {
      const today = await getRepTodayWorkAreaIds(rep.id);
      const resolved = await resolveAreaForRepRoute(
        body.locationLat,
        body.locationLng,
        today.expandedAreaIds
      );
      sets.push(`location_lat = $${i++}`);
      vals.push(body.locationLat);
      sets.push(`location_lng = $${i++}`);
      vals.push(body.locationLng);
      sets.push(`area_id = $${i++}`);
      vals.push(resolved.areaId);
    }

    if (sets.length === 0) throw new HttpError(400, "لا توجد حقول للتحديث");

    vals.push(id);
    const { rowCount } = await query(
      `UPDATE stores SET ${sets.join(", ")}, updated_at = now() WHERE id = $${i}`,
      vals
    );
    if (!rowCount) throw new HttpError(404, "المتجر غير موجود");

    const store = await loadStoreForRep(id, rep);
    res.json({ store });
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

async function loadStoreRowForRep(storeId: number, rep: { id: number }) {
  const today = await getRepTodayWorkAreaIds(rep.id);
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
  if (!repCanAccessStore(s, today.expandedAreaIds)) {
    throw new HttpError(403, "المتجر ليس ضمن مسار اليوم");
  }
  return s;
}

/** Prize catalog for a store visit (redeem enabled products only). */
router.get("/stores/:id/prizes", repAuthMiddleware, async (req, res, next) => {
  try {
    const storeId = z.coerce.number().int().positive().parse(req.params.id);
    const rep = req.rep!;
    await loadStoreForRep(storeId, rep);
    const loyalty = await getStoreLoyaltyState(storeId);
    const { rows: products } = await query<{
      id: number;
      name: string;
      designation: string | null;
      unit_label: string | null;
      image_url: string | null;
      redeem_points_per_unit: number;
    }>(
      `SELECT id, name, designation, unit_label, image_url, redeem_points_per_unit
       FROM products
       WHERE is_active = true
         AND redeem_enabled = true
         AND redeem_points_per_unit > 0
       ORDER BY name ASC`
    );
    res.json({
      loyaltyPointsBalance: loyalty.balance,
      loyaltyExpiryDays: loyalty.expiryDays,
      loyaltyPeriodStartedAt: loyalty.periodStartedAt,
      loyaltyExpiresAt: loyalty.expiresAt,
      loyaltyDaysRemaining: loyalty.daysRemaining,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        designation: p.designation,
        unitLabel: p.unit_label,
        imageUrl: p.image_url,
        redeemPointsPerUnit: p.redeem_points_per_unit,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.get("/stores/:id/prize-redemptions", repAuthMiddleware, async (req, res, next) => {
  try {
    const storeId = z.coerce.number().int().positive().parse(req.params.id);
    const rep = req.rep!;
    await loadStoreForRep(storeId, rep);
    const { rows } = await query<{
      id: string;
      created_at: string;
      total_points_spent: number;
      rep_name: string;
    }>(
      `SELECT pr.id::text, pr.created_at, pr.total_points_spent, r.full_name AS rep_name
       FROM prize_redemptions pr
       JOIN representatives r ON r.id = pr.representative_id
       WHERE pr.store_id = $1
       ORDER BY pr.created_at DESC
       LIMIT 40`,
      [storeId]
    );
    res.json({
      redemptions: rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        totalPointsSpent: r.total_points_spent,
        repName: r.rep_name,
      })),
    });
  } catch (e) {
    next(e);
  }
});

const redeemLineSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

const redeemSchema = z.object({
  storeId: z.number().int().positive(),
  lines: z.array(redeemLineSchema).min(1),
  repLat: z.number().min(-90).max(90),
  repLng: z.number().min(-180).max(180),
});

router.post("/prize-redemptions", repAuthMiddleware, async (req, res, next) => {
  try {
    const body = redeemSchema.parse(req.body);
    const rep = req.rep!;
    const storeRow = await loadStoreRowForRep(body.storeId, rep);
    assertWithinScanDistance(body.repLat, body.repLng, storeRow.location_lat, storeRow.location_lng);

    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await expireStoreLoyaltyIfNeeded(body.storeId, c);
      const balRes = await c.query<{ loyalty_points_balance: number }>(
        `SELECT loyalty_points_balance FROM stores WHERE id = $1 FOR UPDATE`,
        [body.storeId]
      );
      const balance = balRes.rows[0]?.loyalty_points_balance ?? 0;

      const priced: {
        productId: number;
        quantity: number;
        pointsPerUnit: number;
        pointsSpent: number;
      }[] = [];
      let totalPoints = 0;

      for (const line of body.lines) {
        const pr = await c.query<{
          redeem_points_per_unit: number;
          redeem_enabled: boolean;
          is_active: boolean;
        }>(
          `SELECT redeem_points_per_unit, redeem_enabled, is_active FROM products WHERE id = $1`,
          [line.productId]
        );
        const p = pr.rows[0];
        if (!p?.is_active || !p.redeem_enabled || p.redeem_points_per_unit <= 0) {
          throw new HttpError(400, "منتج غير متاح للاستبدال");
        }
        const pointsPerUnit = p.redeem_points_per_unit;
        const pointsSpent = pointsPerUnit * line.quantity;
        totalPoints += pointsSpent;
        priced.push({
          productId: line.productId,
          quantity: line.quantity,
          pointsPerUnit,
          pointsSpent,
        });
      }

      if (totalPoints > balance) {
        throw new HttpError(400, `رصيد النقاط غير كافٍ (المتوفر: ${balance}، المطلوب: ${totalPoints})`);
      }

      const ins = await c.query<{ id: string }>(
        `INSERT INTO prize_redemptions (store_id, representative_id, total_points_spent)
         VALUES ($1, $2, $3) RETURNING id`,
        [body.storeId, rep.id, totalPoints]
      );
      const redemptionId = ins.rows[0]!.id;

      for (const l of priced) {
        await c.query(
          `INSERT INTO prize_redemption_lines (redemption_id, product_id, quantity, points_per_unit, points_spent)
           VALUES ($1, $2, $3, $4, $5)`,
          [redemptionId, l.productId, l.quantity, l.pointsPerUnit, l.pointsSpent]
        );
      }

      await c.query(
        `UPDATE stores SET loyalty_points_balance = loyalty_points_balance - $1, updated_at = now()
         WHERE id = $2`,
        [totalPoints, body.storeId]
      );

      await c.query("COMMIT");
      res.status(201).json({
        redemptionId,
        totalPointsSpent: totalPoints,
        loyaltyPointsBalance: balance - totalPoints,
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
        productName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        loyaltyPoints: number;
      }[] = [];
      let orderLoyaltyTotal = 0;
      for (const line of body.lines) {
        const pr = await c.query<{
          catalog_price: string;
          rep_price: string | null;
          is_active: boolean;
          loyalty_points_per_unit: number;
          name: string;
        }>(
          `SELECT p.price AS catalog_price, ri.price AS rep_price,
                  p.is_active, p.loyalty_points_per_unit, p.name
           FROM products p
           LEFT JOIN representative_inventory ri
             ON ri.product_id = p.id AND ri.representative_id = $2
           WHERE p.id = $1`,
          [line.productId, rep.id]
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
        const unit = parseFloat(p.rep_price ?? p.catalog_price);
        const lineTotal = unit * line.quantity;
        const loyaltyPoints = Math.max(0, Number(p.loyalty_points_per_unit) || 0) * line.quantity;
        total += lineTotal;
        orderLoyaltyTotal += loyaltyPoints;
        priced.push({
          productId: line.productId,
          productName: p.name,
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
        await awardLoyaltyPoints(body.storeId, orderLoyaltyTotal, c);
      }
      await c.query("COMMIT");
      res.status(201).json({
        orderId,
        totalAmount: total,
        loyaltyPointsEarned: orderLoyaltyTotal,
        paymentType: body.paymentType,
        storeName: store.name,
        lines: priced.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })),
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

export default router;
