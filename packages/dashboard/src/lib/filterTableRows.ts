export type SearchAccessor<T> = keyof T | ((row: T) => string | number | boolean | null | undefined);

export type FilterFieldDef<T> = {
  id: string;
  label: string;
  type: "text" | "select" | "searchableSelect" | "boolean" | "dateFrom" | "dateTo";
  getValue: (row: T) => string | number | boolean | null | undefined;
  options?: { value: string; label: string }[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** YYYY-MM-DD in Asia/Amman for order date filtering. */
export function toMarketDateString(value: string | number | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
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
        if (text !== norm(filterVal)) return false;
      } else if (!text.includes(norm(filterVal))) {
        return false;
      }
    }

    return true;
  });
}
