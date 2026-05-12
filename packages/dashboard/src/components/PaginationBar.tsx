import { useLocale } from "../i18n/LocaleContext";

function interpolate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

/** Compact page list: 1 … 4 5 6 … 12 */
function pageNumbers(current: number, total: number): (number | "gap")[] {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= total) set.add(i);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("gap");
    out.push(n);
  }
  return out;
}

type Props = {
  className?: string;
  page: number;
  totalPages: number;
  totalItems: number;
  from: number;
  to: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
  disabled?: boolean;
};

export default function PaginationBar({
  className,
  page,
  totalPages,
  totalItems,
  from,
  to,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  disabled,
}: Props) {
  const { t } = useLocale();
  const nums = pageNumbers(page, totalPages);
  const summary = interpolate(t.pagination.summary, { from, to, total: totalItems });
  const pageOf = interpolate(t.pagination.pageOf, { current: page, total: totalPages });

  return (
    <div className={`pagination-bar ${className ?? ""}`.trim()} aria-label={t.pagination.aria}>
      <div className="pagination-meta">
        <span className="muted small">{summary}</span>
        <label className="pagination-per">
          <span className="muted small">{t.pagination.perPage}</span>
          <select
            value={pageSize}
            disabled={disabled}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="pagination-select"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="pagination-controls">
        <button type="button" className="ghost pagination-btn" disabled={disabled || page <= 1} onClick={() => onPageChange(1)}>
          {t.pagination.first}
        </button>
        <button type="button" className="ghost pagination-btn" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          {t.pagination.prev}
        </button>
        <div className="pagination-pages" role="group">
          {nums.map((n, i) =>
            n === "gap" ? (
              <span key={`g-${i}`} className="pagination-gap">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                className={n === page ? "pagination-num is-active" : "pagination-num"}
                disabled={disabled}
                onClick={() => onPageChange(n)}
              >
                {n}
              </button>
            )
          )}
        </div>
        <button
          type="button"
          className="ghost pagination-btn"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t.pagination.next}
        </button>
        <button
          type="button"
          className="ghost pagination-btn"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          {t.pagination.last}
        </button>
        <span className="muted small pagination-of">{pageOf}</span>
      </div>
    </div>
  );
}
