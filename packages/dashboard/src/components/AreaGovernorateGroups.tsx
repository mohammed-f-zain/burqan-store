import { useMemo, useState } from "react";

import { groupAreasByGovernorate, type AreaWithGovernorate } from "../lib/groupAreasByGovernorate";

type Props<T extends AreaWithGovernorate> = {
  areas: T[];
  unassignedLabel: string;
  expandAllLabel: string;
  collapseAllLabel: string;
  defaultOpen?: boolean;
  layout?: "list" | "grid";
  children: (area: T) => React.ReactNode;
};

export default function AreaGovernorateGroups<T extends AreaWithGovernorate>({
  areas,
  unassignedLabel,
  expandAllLabel,
  collapseAllLabel,
  defaultOpen = false,
  layout = "list",
  children,
}: Props<T>) {
  const groups = useMemo(
    () => groupAreasByGovernorate(areas, unassignedLabel),
    [areas, unassignedLabel]
  );
  const [openKeys, setOpenKeys] = useState<Set<string> | null>(null);

  const effectiveOpen = (key: string) => {
    if (openKeys === null) return defaultOpen;
    return openKeys.has(key);
  };

  function setGroupOpen(key: string, open: boolean) {
    setOpenKeys((prev) => {
      const base = prev ?? new Set(groups.filter((g) => defaultOpen).map((g) => g.key));
      const next = new Set(base);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function expandAll() {
    setOpenKeys(new Set(groups.map((g) => g.key)));
  }

  function collapseAll() {
    setOpenKeys(new Set());
  }

  if (!groups.length) return null;

  return (
    <div className="area-gov-wrap">
      <div className="row spread area-gov-toolbar" style={{ gap: 8, marginBottom: 10 }}>
        <button type="button" className="ghost small" onClick={expandAll}>
          {expandAllLabel}
        </button>
        <button type="button" className="ghost small" onClick={collapseAll}>
          {collapseAllLabel}
        </button>
      </div>
      <div className="area-gov-groups">
        {groups.map((g) => (
          <details
            key={g.key}
            className="area-gov-group"
            open={effectiveOpen(g.key)}
            onToggle={(e) => setGroupOpen(g.key, (e.target as HTMLDetailsElement).open)}
          >
            <summary>
              <span className="area-gov-group__title">{g.label}</span>
              <span className="muted small">({g.areas.length})</span>
            </summary>
            <div className={`area-gov-group__body${layout === "grid" ? " area-gov-checks" : ""}`}>
              {g.areas.map((a) => children(a))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
