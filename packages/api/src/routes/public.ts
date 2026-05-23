import { Router } from "express";
import { z } from "zod";

import { query } from "../db/pool.js";
import { HttpError } from "../utils/errors.js";

const router = Router();

const tokenQuery = z.object({ t: z.string().min(16).max(64) });
const qrTokenParam = z.string().min(16).max(64);

async function storeByOwnerToken(token: string) {
  const { rows } = await query<{
    id: number;
    name: string;
    owner_name: string;
    phone: string;
    image_url: string | null;
    deferred_payment_enabled: boolean;
  }>(
    `SELECT id, name, owner_name, phone, image_url, deferred_payment_enabled
     FROM stores WHERE owner_portal_token = $1`,
    [token]
  );
  return rows[0] ?? null;
}

/** Scan printed card QR → owner portal token (opens in phone browser). */
router.get("/qr/:token", async (req, res, next) => {
  try {
    const publicToken = qrTokenParam.parse(req.params.token);
    const { rows } = await query<{ owner_portal_token: string }>(
      `SELECT s.owner_portal_token
       FROM stores s
       JOIN qr_codes qc ON qc.id = s.qr_code_id
       WHERE qc.public_token = $1`,
      [publicToken]
    );
    if (!rows[0]) {
      throw new HttpError(404, "لم يُعثر على متجر لهذا الرمز");
    }
    res.json({ ownerPortalToken: rows[0].owner_portal_token });
  } catch (e) {
    next(e);
  }
});

router.get("/owner/summary", async (req, res, next) => {
  try {
    const { t } = tokenQuery.parse(req.query);
    const store = await storeByOwnerToken(t);
    if (!store) {
      return res.status(404).json({ error: "غير موجود" });
    }

    const [
      { rows: orderAgg },
      { rows: payAgg },
      { rows: counts },
      { rows: orders },
      { rows: visits },
      { rows: topProducts },
      { rows: monthly },
    ] = await Promise.all([
      query<{ deferred_total: string; cash_total: string }>(
        `SELECT
           COALESCE(SUM(CASE WHEN payment_type = 'deferred' THEN total_amount ELSE 0 END), 0)::text AS deferred_total,
           COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END), 0)::text AS cash_total
         FROM orders WHERE store_id = $1`,
        [store.id]
      ),
      query<{ paid: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS paid FROM store_payments WHERE store_id = $1`,
        [store.id]
      ),
      query<{ order_count: string; visit_count: string; month_orders: string; month_total: string }>(
        `SELECT
           (SELECT COUNT(*)::text FROM orders WHERE store_id = $1) AS order_count,
           (SELECT COUNT(*)::text FROM visits WHERE store_id = $1) AS visit_count,
           (SELECT COUNT(*)::text FROM orders WHERE store_id = $1
              AND created_at >= date_trunc('month', timezone('Asia/Amman', now()))) AS month_orders,
           (SELECT COALESCE(SUM(total_amount), 0)::text FROM orders WHERE store_id = $1
              AND created_at >= date_trunc('month', timezone('Asia/Amman', now()))) AS month_total`,
        [store.id]
      ),
      query<{
        id: string;
        payment_type: string;
        total_amount: string;
        created_at: string;
        rep_name: string;
        rep_image_url: string | null;
        rep_phone: string;
        line_count: string;
        item_qty: string;
        products_preview: string | null;
      }>(
        `SELECT o.id::text, o.payment_type, o.total_amount::text AS total_amount, o.created_at,
                r.full_name AS rep_name, r.image_url AS rep_image_url, r.phone AS rep_phone,
                (SELECT COUNT(*)::text FROM order_lines ol WHERE ol.order_id = o.id) AS line_count,
                (SELECT COALESCE(SUM(ol.quantity), 0)::text FROM order_lines ol WHERE ol.order_id = o.id) AS item_qty,
                (
                  SELECT STRING_AGG(sub.name, ' · ' ORDER BY sub.ord)
                  FROM (
                    SELECT p.name, ol.id AS ord
                    FROM order_lines ol
                    JOIN products p ON p.id = ol.product_id
                    WHERE ol.order_id = o.id
                    ORDER BY ol.id
                    LIMIT 4
                  ) sub
                ) AS products_preview
         FROM orders o
         JOIN representatives r ON r.id = o.representative_id
         WHERE o.store_id = $1
         ORDER BY o.id DESC
         LIMIT 50`,
        [store.id]
      ),
      query<{
        id: string;
        visited_at: string;
        note: string | null;
        rep_name: string;
        rep_image_url: string | null;
        rep_phone: string;
      }>(
        `SELECT v.id::text, v.visited_at, v.note,
                r.full_name AS rep_name, r.image_url AS rep_image_url, r.phone AS rep_phone
         FROM visits v
         JOIN representatives r ON r.id = v.representative_id
         WHERE v.store_id = $1
         ORDER BY v.id DESC
         LIMIT 50`,
        [store.id]
      ),
      query<{ product_id: number; name: string; image_url: string | null; qty: string; total: string }>(
        `SELECT p.id AS product_id, p.name, p.image_url,
                SUM(ol.quantity)::text AS qty,
                SUM(ol.line_total)::text AS total
         FROM order_lines ol
         JOIN orders o ON o.id = ol.order_id
         JOIN products p ON p.id = ol.product_id
         WHERE o.store_id = $1
         GROUP BY p.id, p.name, p.image_url
         ORDER BY SUM(ol.quantity) DESC
         LIMIT 8`,
        [store.id]
      ),
      query<{ month: string; total: string; count: string }>(
        `SELECT date_trunc('month', created_at AT TIME ZONE 'Asia/Amman')::date::text AS month,
                COALESCE(SUM(total_amount), 0)::text AS total,
                COUNT(*)::text AS count
         FROM orders
         WHERE store_id = $1 AND created_at >= (now() - interval '6 months')
         GROUP BY 1
         ORDER BY 1 ASC`,
        [store.id]
      ),
    ]);

    const deferredTotal = parseFloat(orderAgg[0]?.deferred_total ?? "0");
    const paid = parseFloat(payAgg[0]?.paid ?? "0");
    const balanceDue = Math.max(0, deferredTotal - paid);

    res.json({
      store: {
        id: store.id,
        name: store.name,
        ownerName: store.owner_name,
        phone: store.phone,
        imageUrl: store.image_url,
        deferredPaymentEnabled: store.deferred_payment_enabled,
      },
      totals: {
        deferredPurchases: deferredTotal,
        cashPurchases: parseFloat(orderAgg[0]?.cash_total ?? "0"),
        paymentsRecorded: paid,
        balanceDue,
      },
      stats: {
        orderCount: parseInt(counts[0]?.order_count ?? "0", 10),
        visitCount: parseInt(counts[0]?.visit_count ?? "0", 10),
        monthOrderCount: parseInt(counts[0]?.month_orders ?? "0", 10),
        monthOrderTotal: parseFloat(counts[0]?.month_total ?? "0"),
      },
      orders: orders.map((o) => ({
        id: o.id,
        payment_type: o.payment_type,
        total_amount: o.total_amount,
        created_at: o.created_at,
        rep_name: o.rep_name,
        rep_image_url: o.rep_image_url,
        rep_phone: o.rep_phone,
        line_count: parseInt(o.line_count, 10),
        item_qty: parseInt(o.item_qty, 10),
        products_preview: o.products_preview,
      })),
      visits: visits.map((v) => ({
        id: v.id,
        visited_at: v.visited_at,
        note: v.note,
        rep_name: v.rep_name,
        rep_image_url: v.rep_image_url,
        rep_phone: v.rep_phone,
      })),
      topProducts: topProducts.map((r) => ({
        productId: r.product_id,
        name: r.name,
        imageUrl: r.image_url,
        quantity: parseInt(r.qty, 10),
        total: parseFloat(r.total),
      })),
      monthly: monthly.map((r) => ({
        month: r.month,
        total: parseFloat(r.total),
        count: parseInt(r.count, 10),
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.get("/owner/orders/:orderId", async (req, res, next) => {
  try {
    const { t } = tokenQuery.parse(req.query);
    const orderId = z.coerce.number().int().positive().parse(req.params.orderId);
    const store = await storeByOwnerToken(t);
    if (!store) {
      return res.status(404).json({ error: "غير موجود" });
    }
    const { rows } = await query<{
      id: string;
      payment_type: string;
      total_amount: string;
      created_at: string;
      rep_name: string;
      rep_image_url: string | null;
      rep_phone: string;
    }>(
      `SELECT o.id::text, o.payment_type, o.total_amount::text AS total_amount, o.created_at,
              r.full_name AS rep_name, r.image_url AS rep_image_url, r.phone AS rep_phone
       FROM orders o
       JOIN representatives r ON r.id = o.representative_id
       WHERE o.id = $1 AND o.store_id = $2`,
      [orderId, store.id]
    );
    const order = rows[0];
    if (!order) {
      throw new HttpError(404, "الطلب غير موجود");
    }
    const { rows: lines } = await query<{
      product_id: number;
      product_name: string;
      designation: string | null;
      unit_label: string | null;
      image_url: string | null;
      quantity: number;
      unit_price: string;
      line_total: string;
    }>(
      `SELECT ol.product_id, p.name AS product_name, p.designation, p.unit_label, p.image_url,
              ol.quantity, ol.unit_price::text AS unit_price, ol.line_total::text AS line_total
       FROM order_lines ol
       JOIN products p ON p.id = ol.product_id
       WHERE ol.order_id = $1
       ORDER BY ol.id ASC`,
      [orderId]
    );
    res.json({
      order: {
        id: order.id,
        paymentType: order.payment_type,
        totalAmount: parseFloat(order.total_amount),
        createdAt: order.created_at,
        repName: order.rep_name,
        repImageUrl: order.rep_image_url,
        repPhone: order.rep_phone,
        lines: lines.map((l) => ({
          productId: l.product_id,
          name: l.product_name,
          designation: l.designation,
          unitLabel: l.unit_label,
          imageUrl: l.image_url,
          quantity: l.quantity,
          unitPrice: parseFloat(l.unit_price),
          lineTotal: parseFloat(l.line_total),
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get("/owner/products", async (req, res, next) => {
  try {
    const { t } = tokenQuery.parse(req.query);
    const store = await storeByOwnerToken(t);
    if (!store) {
      return res.status(404).json({ error: "غير موجود" });
    }
    const { rows } = await query<{
      id: number;
      name: string;
      designation: string | null;
      unit_label: string | null;
      image_url: string | null;
      price: string;
    }>(
      `SELECT id, name, designation, unit_label, image_url, price::text AS price
       FROM products
       WHERE is_active = true
       ORDER BY name ASC`
    );
    res.json({ products: rows });
  } catch (e) {
    next(e);
  }
});

export default router;
