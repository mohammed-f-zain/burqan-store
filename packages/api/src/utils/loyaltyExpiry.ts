import type { PoolClient } from "pg";

import { query } from "../db/pool.js";

export const DEFAULT_LOYALTY_EXPIRY_DAYS = 120;

type Queryable = Pick<PoolClient, "query">;

function q(client?: Queryable) {
  return client ?? { query };
}

export async function getLoyaltyExpiryDays(client?: Queryable): Promise<number> {
  const { rows } = await q(client).query<{ expiry_days: number }>(
    `SELECT expiry_days FROM loyalty_settings WHERE id = 1`
  );
  return rows[0]?.expiry_days ?? DEFAULT_LOYALTY_EXPIRY_DAYS;
}

export async function expireStoreLoyaltyIfNeeded(
  storeId: number,
  client?: Queryable
): Promise<{ expired: boolean; pointsExpired: number }> {
  const { rows } = await q(client).query<{ old_balance: number }>(
    `WITH doomed AS (
       SELECT s.id, s.loyalty_points_balance AS old_balance
       FROM stores s
       CROSS JOIN loyalty_settings ls
       WHERE s.id = $1 AND ls.id = 1
         AND s.loyalty_period_started_at IS NOT NULL
         AND (s.loyalty_period_started_at AT TIME ZONE 'Asia/Amman')::date + ls.expiry_days
             <= (NOW() AT TIME ZONE 'Asia/Amman')::date
     )
     UPDATE stores s
     SET loyalty_points_balance = 0,
         loyalty_period_started_at = NULL,
         updated_at = now()
     FROM doomed d
     WHERE s.id = d.id
     RETURNING d.old_balance`,
    [storeId]
  );
  const pointsExpired = rows[0]?.old_balance ?? 0;
  return { expired: rows.length > 0, pointsExpired };
}

export type LoyaltyExpiryInfo = {
  expiryDays: number;
  periodStartedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  periodActive: boolean;
};

export async function getStoreLoyaltyState(
  storeId: number,
  client?: Queryable
): Promise<LoyaltyExpiryInfo & { balance: number }> {
  await expireStoreLoyaltyIfNeeded(storeId, client);
  const { rows } = await q(client).query<{
    balance: number;
    period_started_at: string | null;
    expiry_days: number;
    expires_at: string | null;
    days_remaining: number | null;
  }>(
    `SELECT s.loyalty_points_balance AS balance,
            s.loyalty_period_started_at AS period_started_at,
            ls.expiry_days,
            CASE
              WHEN s.loyalty_period_started_at IS NOT NULL AND s.loyalty_points_balance > 0 THEN
                ((s.loyalty_period_started_at AT TIME ZONE 'Asia/Amman')::date + ls.expiry_days)::text
              ELSE NULL
            END AS expires_at,
            CASE
              WHEN s.loyalty_period_started_at IS NOT NULL AND s.loyalty_points_balance > 0 THEN
                GREATEST(0,
                  ((s.loyalty_period_started_at AT TIME ZONE 'Asia/Amman')::date + ls.expiry_days)
                  - (NOW() AT TIME ZONE 'Asia/Amman')::date
                )
              ELSE NULL
            END AS days_remaining
     FROM stores s
     CROSS JOIN loyalty_settings ls
     WHERE s.id = $1 AND ls.id = 1`,
    [storeId]
  );
  const r = rows[0];
  const balance = r?.balance ?? 0;
  const expiryDays = r?.expiry_days ?? DEFAULT_LOYALTY_EXPIRY_DAYS;
  const periodStartedAt = r?.period_started_at ?? null;
  const periodActive = balance > 0 && periodStartedAt != null;
  return {
    balance,
    expiryDays,
    periodStartedAt,
    expiresAt: periodActive ? r?.expires_at ?? null : null,
    daysRemaining: periodActive ? r?.days_remaining ?? null : null,
    periodActive,
  };
}

export async function awardLoyaltyPoints(
  storeId: number,
  points: number,
  client: Queryable
): Promise<void> {
  if (points <= 0) return;
  await expireStoreLoyaltyIfNeeded(storeId, client);
  await client.query(
    `UPDATE stores SET
       loyalty_points_balance = loyalty_points_balance + $1,
       loyalty_period_started_at = COALESCE(loyalty_period_started_at, now()),
       updated_at = now()
     WHERE id = $2`,
    [points, storeId]
  );
}

const FIRST_LOYALTY_PURCHASE_SQL = `
  SELECT o.store_id, MIN(o.created_at) AS first_loyalty_at
  FROM orders o
  JOIN order_lines ol ON ol.order_id = o.id
  WHERE ol.loyalty_points_earned > 0
  GROUP BY o.store_id
`;

/** Align period start with each store's first loyalty-earning purchase. */
export async function syncLoyaltyPeriodsFromFirstPurchase(): Promise<{ updated: number }> {
  const { rowCount } = await query(
    `UPDATE stores s
     SET loyalty_period_started_at = sub.first_loyalty_at,
         updated_at = now()
     FROM (${FIRST_LOYALTY_PURCHASE_SQL}) sub
     WHERE s.id = sub.store_id
       AND (s.loyalty_period_started_at IS NULL
            OR s.loyalty_period_started_at IS DISTINCT FROM sub.first_loyalty_at)`
  );
  const { rowCount: manualCount } = await query(
    `UPDATE stores
     SET loyalty_period_started_at = now(),
         updated_at = now()
     WHERE loyalty_points_balance > 0
       AND loyalty_period_started_at IS NULL`
  );
  return { updated: (rowCount ?? 0) + (manualCount ?? 0) };
}

export type LoyaltyPeriodAuditRow = {
  storeId: number;
  storeName: string;
  ownerName: string;
  phone: string;
  areaName: string;
  balance: number;
  firstLoyaltyPurchaseAt: string | null;
  periodStartedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  wouldExpireNow: boolean;
  periodMismatch: boolean;
};

export async function getLoyaltyPeriodAudit(): Promise<{
  expiryDays: number;
  stores: LoyaltyPeriodAuditRow[];
}> {
  const expiryDays = await getLoyaltyExpiryDays();
  const { rows } = await query<{
    store_id: number;
    store_name: string;
    owner_name: string;
    phone: string;
    area_name: string;
    balance: number;
    first_loyalty_at: string | null;
    period_started_at: string | null;
    expires_at: string | null;
    days_remaining: number | null;
    would_expire_now: boolean;
    period_mismatch: boolean;
  }>(
    `SELECT s.id AS store_id,
            s.name AS store_name,
            s.owner_name,
            s.phone,
            a.name AS area_name,
            s.loyalty_points_balance AS balance,
            fp.first_loyalty_at,
            s.loyalty_period_started_at AS period_started_at,
            CASE
              WHEN fp.first_loyalty_at IS NOT NULL AND s.loyalty_points_balance > 0 THEN
                ((fp.first_loyalty_at AT TIME ZONE 'Asia/Amman')::date + ls.expiry_days)::text
              ELSE NULL
            END AS expires_at,
            CASE
              WHEN fp.first_loyalty_at IS NOT NULL AND s.loyalty_points_balance > 0 THEN
                GREATEST(0,
                  ((fp.first_loyalty_at AT TIME ZONE 'Asia/Amman')::date + ls.expiry_days)
                  - (NOW() AT TIME ZONE 'Asia/Amman')::date
                )
              ELSE NULL
            END AS days_remaining,
            CASE
              WHEN fp.first_loyalty_at IS NOT NULL
                   AND s.loyalty_points_balance > 0
                   AND (fp.first_loyalty_at AT TIME ZONE 'Asia/Amman')::date + ls.expiry_days
                       <= (NOW() AT TIME ZONE 'Asia/Amman')::date
              THEN true
              ELSE false
            END AS would_expire_now,
            (fp.first_loyalty_at IS NOT NULL
             AND s.loyalty_period_started_at IS DISTINCT FROM fp.first_loyalty_at) AS period_mismatch
     FROM stores s
     JOIN areas a ON a.id = s.area_id
     LEFT JOIN (${FIRST_LOYALTY_PURCHASE_SQL}) fp ON fp.store_id = s.id
     CROSS JOIN loyalty_settings ls
     WHERE ls.id = 1
       AND (s.loyalty_points_balance > 0 OR fp.first_loyalty_at IS NOT NULL)
     ORDER BY s.name ASC`
  );
  return {
    expiryDays,
    stores: rows.map((r) => ({
      storeId: r.store_id,
      storeName: r.store_name,
      ownerName: r.owner_name,
      phone: r.phone,
      areaName: r.area_name,
      balance: r.balance,
      firstLoyaltyPurchaseAt: r.first_loyalty_at,
      periodStartedAt: r.period_started_at,
      expiresAt: r.expires_at,
      daysRemaining: r.days_remaining,
      wouldExpireNow: r.would_expire_now,
      periodMismatch: r.period_mismatch,
    })),
  };
}
