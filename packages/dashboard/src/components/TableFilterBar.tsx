import type { FilterFieldDef } from "../lib/filterTableRows";

export type TableFilterLabels = {
  searchPlaceholder: string;
  filtersToggle: string;
  filtersHide: string;
  clear: string;
  all: string;
  yes: string;
  no: string;
  noResults: string;
  filteredSummary: (filtered: number, total: number) => string;
};

type Props<T> = {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<string, string>;
  onFilterChange: (id: string, value: string) => void;
  onClear: () => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  fields: FilterFieldDef<T>[];
  totalCount: number;
  filteredCount: number;
  hasActiveFilters: boolean;
  labels: TableFilterLabels;
};

export default function TableFilterBar<T>({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  onClear,
  showFilters,
  onToggleFilters,
  fields,
  totalCount,
  filteredCount,
  hasActiveFilters,
  labels,
}: Props<T>) {
  if (totalCount === 0) return null;

  return (
    <div className="table-filter-bar">
      <div className="table-filter-bar-row">
        <input
          type="search"
          className="table-filter-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
        />
        {fields.length > 0 ? (
          <button type="button" className="ghost table-filter-toggle" onClick={onToggleFilters}>
            {showFilters ? labels.filtersHide : labels.filtersToggle}
          </button>
        ) : null}
        {hasActiveFilters ? (
          <button type="button" className="ghost table-filter-clear" onClick={onClear}>
            {labels.clear}
          </button>
        ) : null}
        {hasActiveFilters ? (
          <span className="muted small table-filter-summary">
            {labels.filteredSummary(filteredCount, totalCount)}
          </span>
        ) : null}
      </div>

      {showFilters && fields.length > 0 ? (
        <div className="table-filter-grid">
          {fields.map((field) => (
            <label key={field.id} className="table-filter-field">
              <span className="table-filter-field-label">{field.label}</span>
              {field.type === "boolean" ? (
                <select
                  value={filters[field.id] ?? ""}
                  onChange={(e) => onFilterChange(field.id, e.target.value)}
                >
                  <option value="">{labels.all}</option>
                  <option value="true">{labels.yes}</option>
                  <option value="false">{labels.no}</option>
                </select>
              ) : field.type === "select" ? (
                <select
                  value={filters[field.id] ?? ""}
                  onChange={(e) => onFilterChange(field.id, e.target.value)}
                >
                  <option value="">{labels.all}</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={filters[field.id] ?? ""}
                  onChange={(e) => onFilterChange(field.id, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>
      ) : null}

      {hasActiveFilters && filteredCount === 0 ? (
        <p className="muted small table-filter-empty">{labels.noResults}</p>
      ) : null}
    </div>
  );
}
