import { config } from "../config.js";

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [1_000, 2_000, 4_000] as const;
const SENT_IDS_CAP = 8_000;

/** Normalize Burqan payment labels to the Odoo contract. */
export function normalizeOdooPaymentType(raw: string | null | undefined): "cash" | "deferred" {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "cash" || v === "نقدي" || v === "نقد") return "cash";
  if (
    v === "deferred" ||
    v === "deferral" ||
    v === "credit" ||
    v === "آجل" ||
    v === "اجل"
  ) {
    return "deferred";
  }
  return "cash";
}

export type OdooSaleLinePayload = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OdooSaleStorePayload = {
  id: number | null;
  name: string;
  phone: string | null;
};

export type OdooSaleRepPayload = {
  id: number;
  name: string;
  email: string;
};

/** Shared sale fields for completed / updated. */
export type OdooSaleBody = {
  source: "store" | "external";
  orderId: string;
  occurredAt?: string;
  occurredAtAmman?: string;
  paymentType: "cash" | "deferred";
  store: OdooSaleStorePayload;
  representative?: OdooSaleRepPayload;
  lines: OdooSaleLinePayload[];
  totalAmount: number;
};

export type OdooSaleCompletedPayload = OdooSaleBody & { event: "sale.completed" };
export type OdooSaleUpdatedPayload = OdooSaleBody & { event: "sale.updated" };
export type OdooSaleCancelledPayload = {
  event: "sale.cancelled";
  orderId: string;
  source?: "store" | "external";
  reason?: string | null;
};

export type OdooProductPayload = {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unitPrice: number;
  active: boolean;
  uom: string;
  designation?: string | null;
  unitLabel?: string | null;
  /** Absolute https URL for product image, or null. */
  imageUrl: string | null;
};

export type OdooStorePayload = {
  id: number;
  name: string;
  phone: string | null;
  address?: string | null;
  active: boolean;
  representativeId?: number | null;
  ownerName?: string | null;
};

export type OdooRepresentativePayload = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  active?: boolean;
};

type WebhookKind = "sale" | "product" | "store" | "representative";

const inFlightKeys = new Set<string>();
const sentKeys = new Set<string>();
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

function odooBaseUrl(): string {
  return (config.odooBaseUrl || "https://erp.burqan.tech").replace(/\/$/, "");
}

function webhookUrl(kind: WebhookKind): string {
  if (kind === "sale" && config.odooWebhookUrl) {
    return config.odooWebhookUrl;
  }
  const base = odooBaseUrl();
  switch (kind) {
    case "sale":
      return `${base}/burqan/webhook/sale`;
    case "product":
      return `${base}/burqan/webhook/product`;
    case "store":
      return `${base}/burqan/webhook/store`;
    case "representative":
      return `${base}/burqan/webhook/representative`;
  }
}

function rememberSent(key: string): void {
  sentKeys.add(key);
  if (sentKeys.size > SENT_IDS_CAP) {
    const first = sentKeys.values().next().value;
    if (first !== undefined) sentKeys.delete(first);
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

export function shouldRetryOdooStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

type AttemptResult =
  | { kind: "success" }
  | { kind: "fatal" }
  | { kind: "retry"; message: string };

async function postOnce(
  url: string,
  secret: string,
  body: string,
  logId: string
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

  if (res.status === 200 || res.status === 201) {
    console.info("[odoo-webhook] ok", logId, `status=${res.status}`, snippet(text, 120));
    return { kind: "success" };
  }

  if (res.status === 401) {
    console.error("[odoo-webhook] 401 unauthorized — ODOO_WEBHOOK_SECRET does not match Odoo", logId);
    return { kind: "fatal" };
  }

  if (res.status === 422) {
    const missing = json?.missingProductIds ?? json?.missing_product_ids;
    console.error(
      "[odoo-webhook] 422",
      logId,
      missing != null ? `missingProductIds=${JSON.stringify(missing)}` : snippet(text)
    );
    return { kind: "fatal" };
  }

  if (res.status === 400) {
    console.error("[odoo-webhook] 400 invalid payload", logId, snippet(text));
    return { kind: "fatal" };
  }

  const message = `HTTP ${res.status}${text ? `: ${snippet(text)}` : ""}`;
  console.error("[odoo-webhook] http error", logId, `status=${res.status}`, snippet(text));

  if (shouldRetryOdooStatus(res.status)) {
    return { kind: "retry", message };
  }
  return { kind: "fatal" };
}

async function postWithRetry(
  url: string,
  secret: string,
  payload: unknown,
  dedupeKey: string
): Promise<void> {
  const body = JSON.stringify(payload);
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const outcome = await postOnce(url, secret, body, dedupeKey);
      if (outcome.kind === "success") {
        rememberSent(dedupeKey);
        return;
      }
      if (outcome.kind === "fatal") return;
      lastErr = new Error(outcome.message);
    } catch (err) {
      lastErr = err;
      console.error(
        "[odoo-webhook] network/timeout",
        dedupeKey,
        `attempt=${attempt}/${MAX_ATTEMPTS}`,
        err instanceof Error ? err.message : String(err)
      );
    }

    const delay = BACKOFF_MS[attempt - 1];
    if (attempt < MAX_ATTEMPTS && delay !== undefined) await sleep(delay);
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Fire-and-forget POST to Odoo. Never throws to the caller.
 * `dedupeKey` should include event + entity id so retries in-process are skipped.
 */
export function enqueueOdooWebhook(
  kind: WebhookKind,
  payload: unknown,
  dedupeKey: string
): void {
  const secret = config.odooWebhookSecret;
  if (!secret) {
    if (!missingSecretWarned) {
      missingSecretWarned = true;
      console.warn("[odoo-webhook] ODOO_WEBHOOK_SECRET is unset — Odoo webhooks are disabled");
    }
    return;
  }
  const url = webhookUrl(kind);
  if (!url) return;
  if (sentKeys.has(dedupeKey) || inFlightKeys.has(dedupeKey)) {
    console.info("[odoo-webhook] skip duplicate send", dedupeKey);
    return;
  }

  inFlightKeys.add(dedupeKey);
  void postWithRetry(url, secret, payload, dedupeKey)
    .catch((err) => {
      console.error("[odoo-webhook] exhausted retries", dedupeKey, String(err));
    })
    .finally(() => {
      inFlightKeys.delete(dedupeKey);
    });
}

/** Allow admin resync to re-send even if already sent in this process. */
export function enqueueOdooWebhookForce(
  kind: WebhookKind,
  payload: unknown,
  dedupeKey: string
): void {
  sentKeys.delete(dedupeKey);
  inFlightKeys.delete(dedupeKey);
  enqueueOdooWebhook(kind, payload, dedupeKey);
}

function withNormalizedSalePayment<T extends { paymentType: string }>(
  payload: T
): T & { paymentType: "cash" | "deferred" } {
  return { ...payload, paymentType: normalizeOdooPaymentType(payload.paymentType) };
}

export function notifyOdooSaleCompleted(payload: Omit<OdooSaleCompletedPayload, "event"> & { event?: "sale.completed" }): void {
  if (!payload.orderId || !payload.lines?.length) return;
  const body: OdooSaleCompletedPayload = withNormalizedSalePayment({
    ...payload,
    event: "sale.completed",
    source: payload.source ?? "store",
  });
  enqueueOdooWebhook("sale", body, `sale.completed:${body.orderId}`);
}

export function notifyOdooSaleUpdated(payload: Omit<OdooSaleUpdatedPayload, "event"> & { event?: "sale.updated" }): void {
  if (!payload.orderId || !payload.lines?.length) return;
  const body: OdooSaleUpdatedPayload = withNormalizedSalePayment({
    ...payload,
    event: "sale.updated",
    source: payload.source ?? "store",
  });
  // Updates may be re-sent; use timestamp bucket so distinct edits are not dropped forever.
  const stamp = payload.occurredAt ?? new Date().toISOString();
  enqueueOdooWebhook("sale", body, `sale.updated:${body.orderId}:${stamp}`);
}

export function notifyOdooSaleCancelled(payload: {
  orderId: string;
  source?: "store" | "external";
  reason?: string | null;
}): void {
  if (!payload.orderId) return;
  const body: OdooSaleCancelledPayload = {
    event: "sale.cancelled",
    orderId: payload.orderId,
    source: payload.source,
    reason: payload.reason ?? null,
  };
  enqueueOdooWebhook("sale", body, `sale.cancelled:${body.orderId}`);
}

/** Absolute https URL for a stored `/uploads/...` path (or pass-through http(s)). */
export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = String(path).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = config.publicApiBaseUrl.replace(/\/$/, "");
  if (!base) return null;
  return `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export function productPayloadFromRow(row: {
  id: number;
  name: string;
  price: string | number;
  is_active?: boolean;
  designation?: string | null;
  unit_label?: string | null;
  image_url?: string | null;
}): OdooProductPayload {
  const unitPrice = typeof row.price === "number" ? row.price : parseFloat(String(row.price)) || 0;
  return {
    id: row.id,
    name: row.name,
    sku: null,
    barcode: null,
    unitPrice,
    active: row.is_active !== false,
    uom: (row.unit_label && String(row.unit_label).trim()) || "unit",
    designation: row.designation ?? null,
    unitLabel: row.unit_label ?? null,
    imageUrl: productImageUrl(row.image_url) ?? null,
  };
}

export function notifyOdooProductCreated(product: OdooProductPayload): void {
  enqueueOdooWebhook(
    "product",
    { event: "product.created", product },
    `product.created:${product.id}`
  );
}

export function notifyOdooProductUpdated(product: OdooProductPayload): void {
  enqueueOdooWebhookForce(
    "product",
    { event: "product.updated", product },
    `product.updated:${product.id}:${Date.now()}`
  );
}

export function notifyOdooProductDeleted(productId: number): void {
  enqueueOdooWebhook(
    "product",
    {
      event: "product.deleted",
      product: { id: productId, active: false },
    },
    `product.deleted:${productId}`
  );
}

export function notifyOdooStoreUpsert(
  event: "store.created" | "store.updated" | "store.upsert",
  store: OdooStorePayload
): void {
  const key =
    event === "store.created"
      ? `store.created:${store.id}`
      : `store.updated:${store.id}:${Date.now()}`;
  if (event === "store.created") {
    enqueueOdooWebhook("store", { event, store }, key);
  } else {
    enqueueOdooWebhookForce("store", { event, store }, key);
  }
}

export function notifyOdooStoreDeleted(storeId: number): void {
  enqueueOdooWebhook(
    "store",
    {
      event: "store.deleted",
      store: { id: storeId, active: false },
    },
    `store.deleted:${storeId}`
  );
}

export function notifyOdooRepresentativeUpsert(
  event: "representative.upsert" | "representative.created" | "representative.updated",
  representative: OdooRepresentativePayload
): void {
  const key =
    event === "representative.created"
      ? `representative.created:${representative.id}`
      : `representative.upsert:${representative.id}:${Date.now()}`;
  if (event === "representative.created") {
    enqueueOdooWebhook("representative", { event, representative }, key);
  } else {
    enqueueOdooWebhookForce("representative", { event, representative }, key);
  }
}

export function notifyOdooRepresentativeDeleted(representative: {
  id: number;
  email?: string | null;
}): void {
  enqueueOdooWebhook(
    "representative",
    {
      event: "representative.deleted",
      representative: {
        id: representative.id,
        email: representative.email ?? null,
      },
    },
    `representative.deleted:${representative.id}`
  );
}

export function buildStoreOdooPayload(row: {
  id: number;
  name: string;
  phone?: string | null;
  address_text?: string | null;
  registered_by_representative_id?: number | null;
  owner_name?: string | null;
}): OdooStorePayload {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? null,
    address: row.address_text ?? null,
    active: true,
    representativeId: row.registered_by_representative_id ?? null,
    ownerName: row.owner_name ?? null,
  };
}
