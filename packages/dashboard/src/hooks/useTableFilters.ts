import { useEffect, useMemo, useState } from "react";

import { filterTableRows, type FilterFieldDef, type SearchAccessor } from "../lib/filterTableRows";
import { useClientPagination } from "./useClientPagination";

export type UseTableFiltersConfig<T> = {
  searchAccessors: SearchAccessor<T>[];
  fields: FilterFieldDef<T>[];
  defaultPageSize?: number;
};

export function useTableFilters<T>(items: readonly T[], config: UseTableFiltersConfig<T>) {
  const { searchAccessors, fields, defaultPageSize } = config;
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const filtered = useMemo(
    () => filterTableRows(items, search, searchAccessors, fields, filters),
    [items, search, searchAccessors, fields, filters]
  );

  const pagination = useClientPagination(filtered, defaultPageSize);

  useEffect(() => {
    pagination.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when query/filters change
  }, [search, filtersKey]);

  function setFilter(id: string, value: string) {
    setFilters((prev) => ({ ...prev, [id]: value }));
  }

  function clearFilters() {
    setSearch("");
    setFilters({});
  }

  const hasActiveFilters =
    search.trim() !== "" || Object.values(filters).some((v) => v !== "");

  return {
    search,
    setSearch,
    filters,
    setFilter,
    clearFilters,
    showFilters,
    setShowFilters,
    filtered,
    pagination,
    hasActiveFilters,
    totalCount: items.length,
    filteredCount: filtered.length,
    fields,
  };
}
