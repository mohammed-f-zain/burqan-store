import type { FilterFieldDef } from "../lib/filterTableRows";
import SearchableSelect from "./SearchableSelect";

export type TableFilterLabels = {
  searchPlaceholder: string;
  filtersToggle: string;
  filtersHide: string;
  clear: string;
  all: string;
  yes: string;
  no: string;
  noResults: string;
  selectSearch: string;
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
  pinnedFieldIds?: string[];
  totalCount: number;
  filteredCount: number;
  hasActiveFilters: boolean;
  labels: TableFilterLabels;
};

function renderField<T>(
  field: FilterFieldDef<T>,
  filters: Record<string, string>,
  onFilterChange: (id: string, value: string) => void,
  labels: TableFilterLabels,
  compact?: boolean
) {
  const className = compact ? "table-filter-field table-filter-field--compact" : "table-filter-field";

  return (
    <label key={field.id} className={className}>
      <span className="table-filter-field-label">{field.label}</span>
      {field.type === "boolean" ? (
        <select value={filters[field.id] ?? ""} onChange={(e) => onFilterChange(field.id, e.target.value)}>
          <option value="">{labels.all}</option>
          <option value="true">{labels.yes}</option>
          <option value="false">{labels.no}</option>
        </select>
      ) : field.type === "select" ? (
        <select value={filters[field.id] ?? ""} onChange={(e) => onFilterChange(field.id, e.target.value)}>
          <option value="">{labels.all}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.type === "searchableSelect" ? (
        <SearchableSelect
          value={filters[field.id] ?? ""}
          onChange={(v) => onFilterChange(field.id, v)}
          options={field.options ?? []}
          allLabel={labels.all}
          searchPlaceholder={labels.selectSearch}
          ariaLabel={field.label}
        />
      ) : field.type === "dateFrom" || field.type === "dateTo" ? (
        <input
          type="date"
          value={filters[field.id] ?? ""}
          onChange={(e) => onFilterChange(field.id, e.target.value)}
        />
      ) : (
        <input
          type="text"
          value={filters[field.id] ?? ""}
          onChange={(e) => onFilterChange(field.id, e.target.value)}
        />
      )}
    </label>
  );
}

export default function TableFilterBar<T>({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  onClear,
  showFilters,
  onToggleFilters,
  fields,
  pinnedFieldIds = [],
  totalCount,
  filteredCount,
  hasActiveFilters,
  labels,
}: Props<T>) {
  if (totalCount === 0) return null;

  const pinnedSet = new Set(pinnedFieldIds);
  const pinnedFields = fields.filter((f) => pinnedSet.has(f.id));
  const gridFields = fields.filter((f) => !pinnedSet.has(f.id));

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
        {pinnedFields.map((field) => renderField(field, filters, onFilterChange, labels, true))}
        {gridFields.length > 0 ? (
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

      {showFilters && gridFields.length > 0 ? (
        <div className="table-filter-grid">
          {gridFields.map((field) => renderField(field, filters, onFilterChange, labels))}
        </div>
      ) : null}

      {hasActiveFilters && filteredCount === 0 ? (
        <p className="muted small table-filter-empty">{labels.noResults}</p>
      ) : null}
    </div>
  );
}
