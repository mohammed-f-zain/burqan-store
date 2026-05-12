import { useEffect, useMemo, useState } from "react";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export function useClientPagination<T>(items: readonly T[], defaultPageSize = 10) {
  const safeDefault = PAGE_SIZE_OPTIONS.includes(defaultPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? defaultPageSize
    : 10;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(safeDefault);

  const total = items.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(page * pageSize, total);

  const slice = useMemo(() => {
    if (total === 0) return [];
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize, total]);

  function setPageSize(n: number) {
    setPageSizeState(n);
    setPage(1);
  }

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    slice,
    total,
    totalPages,
    from,
    to,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  };
}
