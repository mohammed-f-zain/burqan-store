import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchableSelectOption = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  allLabel: string;
  searchPlaceholder: string;
  ariaLabel: string;
};

export default function SearchableSelect({
  value,
  onChange,
  options,
  allLabel,
  searchPlaceholder,
  ariaLabel,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = useMemo(() => {
    if (!value) return allLabel;
    return options.find((o) => o.value === value)?.label ?? value;
  }, [allLabel, options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="searchable-select" ref={rootRef}>
      <button
        type="button"
        className="searchable-select-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value ? "" : "muted"}>{selectedLabel}</span>
        <span className="searchable-select-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="searchable-select-panel" role="listbox" id={listId}>
          <input
            ref={searchRef}
            type="search"
            className="searchable-select-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
            }}
          />
          <ul className="searchable-select-list">
            <li>
              <button
                type="button"
                className={`searchable-select-option${value === "" ? " is-selected" : ""}`}
                onClick={() => pick("")}
              >
                {allLabel}
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="searchable-select-empty muted small">—</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    className={`searchable-select-option${value === opt.value ? " is-selected" : ""}`}
                    onClick={() => pick(opt.value)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
