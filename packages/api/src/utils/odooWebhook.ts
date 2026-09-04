import { config } from "../config.js";

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [1_000, 2_000, 4_000] as const;
const SENT_IDS_CAP = 5_000;

export type OdooSaleLinePayload = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/** POST body sent to Odoo when a sale is completed. Field names are the contract. */
export type OdooSaleCompletedPayload = {
  event: "sale.completed";
  /** "store" = rep app order linked to a real store; "external" = admin Fill Car external sale. */
  source: "store" | "external";
  orderId: string;
  occurredAt: string;
  occurredAtAmman: string;
  paymentType: "cash" | "deferred";
  store: {
    /** Null for external sales (free-text name only, not a Burqan store row). */
    id: number | null;
    name: string;
    phone: string | null;
  };
  representative?: {
    id: number;
    name: string;
    email: string;
  };
  lines: OdooSaleLinePayload[];
  totalAmount: number;
};

const inFlightOrderIds = new Set<string>();
const sentOrderIds = new Set<string>();
let missingSecretWarned = false;

export function formatAmmanDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const g = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

/**
 * Fire-and-forget after the Burqan order COMMIT. Odoo downtime must not fail the mobile sale.
 * Safe to call twice for the same orderId (in-process skip + Odoo idempotency).
 */
export function notifyOdooSaleCompleted(payload: OdooSaleCompletedPayload): void {
  const url = config.odooWebhookUrl;
  const secret = config.odooWebhookSecret;
  if (!secret) {
    if (!missingSecretWarned) {
      missingSecretWarned = true;
      console.warn("[odoo-webhook] ODOO_WEBHOOK_SECRET is unset — sale webhooks are disabled");
    }
    return;
  }
  if (!url) return;
  if (!payload.orderId || payload.lines.length === 0) return;
  if (sentOrderIds.has(payload.orderId) || inFlightOrderIds.has(payload.orderId)) {
    console.info("[odoo-webhook] skip duplicate send", payload.orderId);
    return;
  }

  inFlightOrderIds.add(payload.orderId);
  void postSaleWebhookWithRetry(url, secret, payload)
    .catch((err) => {
      console.error("[odoo-webhook] sale.completed exhausted retries", payload.orderId, String(err));
    })
    .finally(() => {
      inFlightOrderIds.delete(payload.orderId);
    });
}

export function shouldRetryOdooStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function rememberSent(orderId: string): void {
  sentOrderIds.add(orderId);
  if (sentOrderIds.size > SENT_IDS_CAP) {
    const first = sentOrderIds.values().next().value;
    if (first !== undefined) sentOrderIds.delete(first);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snippet(text: string, max = 400): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return null;
}

async function postSaleWebhookWithRetry(
  url: string,
  secret: string,
  payload: OdooSaleCompletedPayload
): Promise<void> {
  const body = JSON.stringify(payload);
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const outcome = await postSaleWebhookOnce(url, secret, body, payload.orderId);
      if (outcome.kind === "success") {
        rememberSent(payload.orderId);
        return;
      }
      if (outcome.kind === "fatal") return;
      lastErr = new Error(outcome.message);
    } catch (err) {
      lastErr = err;
      console.error(
        "[odoo-webhook] network/timeout",
        payload.orderId,
        `attempt=${attempt}/${MAX_ATTEMPTS}`,
        err instanceof Error ? err.message : String(err)
      );
    }

    const delay = BACKOFF_MS[attempt - 1];
    if (attempt < MAX_ATTEMPTS && delay !== undefined) await sleep(delay);
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

type AttemptResult =
  | { kind: "success" }
  | { kind: "fatal" }
  | { kind: "retry"; message: string };

async function postSaleWebhookOnce(
  url: string,
  secret: string,
  body: string,
  orderId: string
): Promise<AttemptResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await res.text().catch(() => "");
  const json = parseJsonObject(text);
  const saleOrderId = json && (json.saleOrderId ?? json.sale_order_id);

  if (res.status === 200 || res.status === 201) {
    console.info(
      "[odoo-webhook] ok",
      orderId,
      `status=${res.status}`,
      saleOrderId != null ? `saleOrderId=${String(saleOrderId)}` : ""
    );
    return { kind: "success" };
  }

  if (res.status === 401) {
    console.error("[odoo-webhook] 401 unauthorized — ODOO_WEBHOOK_SECRET does not match Odoo", orderId);
    return { kind: "fatal" };
  }

  if (res.status === 422) {
    const missing = json?.missingProductIds ?? json?.missing_product_ids;
    console.error(
      "[odoo-webhook] 422 products not mapped in Odoo (x_integration_id)",
      orderId,
      missing != null ? `missingProductIds=${JSON.stringify(missing)}` : snippet(text)
    );
    return { kind: "fatal" };
  }

  if (res.status === 400) {
    console.error("[odoo-webhook] 400 invalid payload", orderId, snippet(text));
    return { kind: "fatal" };
  }

  const message = `HTTP ${res.status}${text ? `: ${snippet(text)}` : ""}`;
  console.error("[odoo-webhook] http error", orderId, `status=${res.status}`, snippet(text));

  if (shouldRetryOdooStatus(res.status)) {
    return { kind: "retry", message };
  }
  return { kind: "fatal" };
}
