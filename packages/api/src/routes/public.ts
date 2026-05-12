import { Router } from "express";
import { z } from "zod";

import { query } from "../db/pool.js";

const router = Router();

router.get("/owner/summary", async (req, res, next) => {
  try {
    const token = z.string().min(16).max(64).parse(req.query.t);
    const { rows } = await query<{
      id: number;
      name: string;
      owner_name: string;
      phone: string;
      deferred_payment_enabled: boolean;
    }>(`SELECT id, name, owner_name, phone, deferred_payment_enabled FROM stores WHERE owner_portal_token = $1`, [
      token,
    ]);
    const store = rows[0];
    if (!store) {
      return res.status(404).json({ error: "Not found" });
    }

    const [{ rows: orderAgg }, { rows: payAgg }] = await Promise.all([
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
    ]);

    const deferredTotal = parseFloat(orderAgg[0]?.deferred_total ?? "0");
    const paid = parseFloat(payAgg[0]?.paid ?? "0");
    const balanceDue = Math.max(0, deferredTotal - paid);

    const { rows: orders } = await query(
      `SELECT id, payment_type, total_amount, created_at FROM orders WHERE store_id = $1 ORDER BY id DESC LIMIT 50`,
      [store.id]
    );

    res.json({
      store: {
        id: store.id,
        name: store.name,
        ownerName: store.owner_name,
        phone: store.phone,
        deferredPaymentEnabled: store.deferred_payment_enabled,
      },
      totals: {
        deferredPurchases: deferredTotal,
        cashPurchases: parseFloat(orderAgg[0]?.cash_total ?? "0"),
        paymentsRecorded: paid,
        balanceDue,
      },
      orders,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
