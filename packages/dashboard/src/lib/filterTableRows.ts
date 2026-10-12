export type SearchAccessor<T> = keyof T | ((row: T) => string | number | boolean | null | undefined);

export type FilterFieldDef<T> = {
  id: string;
  label: string;
  type: "text" | "select" | "searchableSelect" | "boolean" | "dateFrom" | "dateTo";
  getValue: (row: T) => string | number | boolean | null | undefined;
  /** When set, used instead of getValue equality for select/searchableSelect filters. */
  matches?: (row: T, filterVal: string) => boolean;
  options?: { value: string; label: string }[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Eastern/Arabic-Indic → ASCII digits (common on Arabic Windows). */
function toLatinDigits(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

/**
 * Asia/Amman wall-clock Y/M/D without trusting locale string shapes.
 * Jordan is UTC+3 year-round since late 2022; used as fallback when Intl is weak
 * (Arabic Windows 7 / old Chromium).
 */
function ammanYmdParts(value: Date): { year: string; month: string; day: string } {
  const AMMAN_OFFSET_MS = 3 * 60 * 60 * 1000;
  try {
    if (typeof Intl?.DateTimeFormat?.prototype?.formatToParts === "function") {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Amman",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        numberingSystem: "latn",
      }).formatToParts(value);
      const pick = (type: Intl.DateTimeFormatPartTypes) =>
        toLatinDigits(parts.find((p) => p.type === type)?.value ?? "");
      const year = pick("year");
      const month = pick("month");
      const day = pick("day");
      if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month) && /^\d{2}$/.test(day)) {
        return { year, month, day };
      }
    }
  } catch {
    /* fall through */
  }
  const shifted = new Date(value.getTime() + AMMAN_OFFSET_MS);
  return {
    year: String(shifted.getUTCFullYear()),
    month: String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    day: String(shifted.getUTCDate()).padStart(2, "0"),
  };
}

/** YYYY-MM-DD in Asia/Amman — safe on Arabic Windows / weak Intl. */
export function toMarketDateString(value: string | number | Date): string {
  const { year, month, day } = ammanYmdParts(new Date(value));
  return `${year}-${month}-${day}`;
}

export function marketToday(): string {
  return toMarketDateString(new Date());
}

/** YYYY-MM in Asia/Amman (route calendar month param). */
export function marketYearMonth(today = marketToday()): string {
  return today.slice(0, 7);
}

export function marketMonthStart(today = marketToday()): string {
  return `${marketYearMonth(today)}-01`;
}

/** Shift a YYYY-MM-DD calendar date by whole days (timezone-safe). */
export function shiftMarketDate(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function filtersFromSearchParams(params: URLSearchParams, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = params.get(key)?.trim();
    if (v) out[key] = v;
  }
  return out;
}

/** Build query string from table filters (omit empty). */
export function searchParamsFromTableState(opts: {
  filters: Record<string, string>;
  search?: string;
  extra?: Record<string, string | undefined | null>;
}): URLSearchParams {
  const next = new URLSearchParams();
  const q = opts.search?.trim();
  if (q) next.set("q", q);
  for (const [k, v] of Object.entries(opts.filters)) {
    const t = v?.trim();
    if (t) next.set(k, t);
  }
  if (opts.extra) {
    for (const [k, v] of Object.entries(opts.extra)) {
      const t = v?.trim();
      if (t) next.set(k, t);
    }
  }
  return next;
}

function cellText(v: string | number | boolean | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function readAccessor<T>(row: T, acc: SearchAccessor<T>): string {
  const v = typeof acc === "function" ? acc(row) : row[acc];
  return cellText(v as string | number | boolean | null | undefined);
}

export function filterTableRows<T>(
  rows: readonly T[],
  search: string,
  searchAccessors: SearchAccessor<T>[],
  fields: FilterFieldDef<T>[],
  filters: Record<string, string>
): T[] {
  const q = norm(search);
  const activeFields = fields.filter((f) => {
    const v = filters[f.id] ?? "";
    return v !== "";
  });

  return rows.filter((row) => {
    if (q) {
      const hit = searchAccessors.some((acc) => norm(readAccessor(row, acc)).includes(q));
      if (!hit) return false;
    }

    for (const field of activeFields) {
      const filterVal = filters[field.id] ?? "";
      const raw = field.getValue(row);

      if (field.type === "boolean") {
        const boolStr = raw === true || raw === "true" ? "true" : "false";
        if (boolStr !== filterVal) return false;
        continue;
      }

      if (field.type === "dateFrom" || field.type === "dateTo") {
        const rowDate = toMarketDateString(String(raw ?? ""));
        if (field.type === "dateFrom" && rowDate < filterVal) return false;
        if (field.type === "dateTo" && rowDate > filterVal) return false;
        continue;
      }

      const text = norm(cellText(raw));
      if (field.type === "select" || field.type === "searchableSelect") {
        if (field.matches) {
          if (!field.matches(row, filterVal)) return false;
        } else if (text !== norm(filterVal)) {
          return false;
        }
      } else if (!text.includes(norm(filterVal))) {
        return false;
      }
    }

    return true;
  });
}
