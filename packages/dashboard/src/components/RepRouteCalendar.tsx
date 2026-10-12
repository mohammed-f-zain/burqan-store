import { useMemo, useState } from "react";

import SearchableSelect from "./SearchableSelect";
import type { RouteZoneOption, ScheduleRow } from "./RepRouteScheduleFields";
import { useLocale } from "../i18n/LocaleContext";
import { formatMarketDate } from "../utils/formatMarketDateTime";

export type CalendarDay = {
  date: string;
  dayOfWeek: number;
  routeZoneId: number | null;
  routeZoneName: string | null;
  source: "override" | "weekly" | "none";
  assignedAt: string | null;
  weeklyRouteZoneId: number | null;
  weeklyRouteZoneName: string | null;
};

/** Stable pastel color from zone id for calendar chips. */
export function zoneColor(zoneId: number | null | undefined): string {
  if (zoneId == null) return "transparent";
  const hues = [168, 210, 32, 280, 12, 145, 250, 55, 190, 320];
  const h = hues[zoneId % hues.length]!;
  return `hsl(${h} 48% 42%)`;
}

function zoneSoftBg(zoneId: number | null | undefined): string {
  if (zoneId == null) return "transparent";
  const hues = [168, 210, 32, 280, 12, 145, 250, 55, 190, 320];
  const h = hues[zoneId % hues.length]!;
  return `hsl(${h} 55% 92%)`;
}

function shiftMonth(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function monthLabel(yyyyMm: string, locale: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

type Props = {
  zones: RouteZoneOption[];
  weeklyRows: ScheduleRow[];
  onWeeklyChange: (dayOfWeek: number, routeZoneId: number | null) => void;
  month: string;
  onMonthChange: (month: string) => void;
  days: CalendarDay[];
  /** Local pending overrides: date → zoneId | null (explicit off) | undefined means unchanged / remove */
  pendingOverrides: Record<string, number | null | "remove">;
  onSetOverride: (date: string, value: number | null | "remove") => void;
  loading?: boolean;
};

export default function RepRouteCalendar({
  zones,
  weeklyRows,
  onWeeklyChange,
  month,
  onMonthChange,
  days,
  pendingOverrides,
  onSetOverride,
  loading,
}: Props) {
  const { t, locale } = useLocale();
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const weekdayHeaders = useMemo(
    () =>
      locale === "ar"
        ? ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    [locale]
  );

  const effectiveDays = useMemo(() => {
    return days.map((d) => {
      const pending = pendingOverrides[d.date];
      if (pending === undefined) return d;
      if (pending === "remove") {
        // Fall back to weekly template display
        return {
          ...d,
          source: d.weeklyRouteZoneId != null ? ("weekly" as const) : ("none" as const),
          routeZoneId: d.weeklyRouteZoneId,
          routeZoneName: d.weeklyRouteZoneName,
          assignedAt: null,
        };
      }
      // pending is number | null (override)
      const name =
        pending == null ? null : zones.find((z) => z.id === pending)?.name ?? d.routeZoneName;
      return {
        ...d,
        source: "override" as const,
        routeZoneId: pending,
        routeZoneName: name,
        assignedAt: d.assignedAt,
      };
    });
  }, [days, pendingOverrides, zones]);

  const firstDow = effectiveDays[0]?.dayOfWeek ?? 0;
  const leadingBlanks = firstDow; // Sunday-start grid

  const picked = pickedDate ? effectiveDays.find((d) => d.date === pickedDate) : null;
  const pickedPending = pickedDate ? pendingOverrides[pickedDate] : undefined;

  function selectValueForPicked(): string {
    if (!pickedDate || !picked) return "";
    if (pickedPending === "remove") {
      return picked.weeklyRouteZoneId != null ? String(picked.weeklyRouteZoneId) : "";
    }
    if (pickedPending !== undefined) {
      return pickedPending == null ? "" : String(pickedPending);
    }
    if (picked.source === "override") {
      return picked.routeZoneId != null ? String(picked.routeZoneId) : "";
    }
    // weekly / none — show weekly value but selecting will create override
    return picked.routeZoneId != null ? String(picked.routeZoneId) : "";
  }

  if (loading) {
    return <p className="muted">{t.repSchedule.loading}</p>;
  }
  if (zones.length === 0) {
    return <p className="muted">{t.repSchedule.noZones}</p>;
  }

  return (
    <div className="rep-route-calendar">
      <div className="rep-cal-nav">
        <button type="button" className="ghost" onClick={() => onMonthChange(shiftMonth(month, -1))}>
          ‹
        </button>
        <strong className="rep-cal-month-label">{monthLabel(month, locale)}</strong>
        <button type="button" className="ghost" onClick={() => onMonthChange(shiftMonth(month, 1))}>
          ›
        </button>
      </div>

      <div className="rep-cal-legend muted small">
        <span className="rep-cal-legend-item">
          <span className="rep-cal-swatch rep-cal-swatch--override" />
          {t.repSchedule.legendOverride}
        </span>
        <span className="rep-cal-legend-item">
          <span className="rep-cal-swatch rep-cal-swatch--weekly" />
          {t.repSchedule.legendWeekly}
        </span>
        <span className="rep-cal-legend-item">
          <span className="rep-cal-swatch rep-cal-swatch--none" />
          {t.repSchedule.legendNone}
        </span>
      </div>

      <div className="rep-cal-grid" role="grid" aria-label={t.repSchedule.calendarAria}>
        {weekdayHeaders.map((h) => (
          <div key={h} className="rep-cal-dow muted small">
            {h}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} className="rep-cal-cell rep-cal-cell--blank" />
        ))}
        {effectiveDays.map((d) => {
          const isOverride = d.source === "override";
          const hasZone = d.routeZoneId != null;
          const titleParts = [
            d.date,
            d.routeZoneName ?? t.repSchedule.offDay,
            isOverride
              ? t.repSchedule.sourceOverride
              : d.source === "weekly"
                ? t.repSchedule.sourceWeekly
                : t.repSchedule.sourceNone,
          ];
          if (d.assignedAt) {
            titleParts.push(`${t.repSchedule.lastAssigned}: ${formatMarketDate(d.assignedAt, locale)}`);
          }
          return (
            <button
              key={d.date}
              type="button"
              className={[
                "rep-cal-cell",
                isOverride ? "rep-cal-cell--override" : hasZone ? "rep-cal-cell--weekly" : "rep-cal-cell--none",
                pickedDate === d.date ? "rep-cal-cell--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                hasZone
                  ? {
                      borderColor: zoneColor(d.routeZoneId),
                      background: isOverride ? zoneSoftBg(d.routeZoneId) : undefined,
                    }
                  : undefined
              }
              title={titleParts.join(" · ")}
              onClick={() => setPickedDate(d.date)}
            >
              <span className="rep-cal-daynum">{Number(d.date.slice(8, 10))}</span>
              {hasZone ? (
                <span className="rep-cal-zone" style={{ color: zoneColor(d.routeZoneId) }}>
                  {d.routeZoneName}
                </span>
              ) : (
                <span className="rep-cal-zone muted">—</span>
              )}
              {isOverride ? <span className="rep-cal-dot" style={{ background: zoneColor(d.routeZoneId) }} /> : null}
            </button>
          );
        })}
      </div>

      {pickedDate && picked ? (
        <div className="rep-cal-picker card-inset">
          <div className="rep-cal-picker-head">
            <strong>{pickedDate}</strong>
            <span className="muted small">
              {picked.source === "override"
                ? t.repSchedule.sourceOverride
                : picked.source === "weekly"
                  ? t.repSchedule.sourceWeekly
                  : t.repSchedule.sourceNone}
            </span>
          </div>
          <SearchableSelect
            value={selectValueForPicked()}
            onChange={(v) => {
              const zoneId = v ? Number(v) : null;
              // Compare to weekly: if same as weekly, remove override; else set override
              const weeklyId = picked.weeklyRouteZoneId;
              if (zoneId === weeklyId || (zoneId == null && weeklyId == null)) {
                onSetOverride(pickedDate, "remove");
              } else {
                onSetOverride(pickedDate, zoneId);
              }
            }}
            options={zones.map((z) => ({ value: String(z.id), label: z.name }))}
            allLabel={t.repSchedule.offDay}
            searchPlaceholder={t.tableFilters.selectSearch}
            ariaLabel={pickedDate}
          />
          {picked.source === "override" || pickedPending !== undefined ? (
            <button
              type="button"
              className="ghost small"
              style={{ marginTop: 8 }}
              onClick={() => onSetOverride(pickedDate, "remove")}
            >
              {t.repSchedule.clearOverride}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="muted small rep-cal-hint">{t.repSchedule.clickDayHint}</p>
      )}

      <div className="form-section" style={{ marginTop: 16 }}>
        <h4>{t.repSchedule.weeklyDefaults}</h4>
        <p className="muted small">{t.repSchedule.weeklyDefaultsHint}</p>
        <div className="schedule-grid">
          {weeklyRows.map((row) => (
            <div key={row.dayOfWeek} className="schedule-row">
              <div className="schedule-day">
                <strong>{row.dayName}</strong>
              </div>
              <SearchableSelect
                value={row.routeZoneId != null ? String(row.routeZoneId) : ""}
                onChange={(v) => onWeeklyChange(row.dayOfWeek, v ? Number(v) : null)}
                options={zones.map((z) => ({ value: String(z.id), label: z.name }))}
                allLabel={t.repSchedule.offDay}
                searchPlaceholder={t.tableFilters.selectSearch}
                ariaLabel={row.dayName}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
