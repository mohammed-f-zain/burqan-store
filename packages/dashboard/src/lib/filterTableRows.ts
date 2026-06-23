export type SearchAccessor<T> = keyof T | ((row: T) => string | number | boolean | null | undefined);

export type FilterFieldDef<T> = {
  id: string;
  label: string;
  type: "text" | "select" | "searchableSelect" | "boolean";
  getValue: (row: T) => string | number | boolean | null | undefined;
  options?: { value: string; label: string }[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
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
