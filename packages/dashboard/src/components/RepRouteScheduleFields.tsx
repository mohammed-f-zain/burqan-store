import SearchableSelect from "./SearchableSelect";
import { useLocale } from "../i18n/LocaleContext";
import { formatMarketDate } from "../utils/formatMarketDateTime";

export type RouteZoneOption = { id: number; name: string; isActive: boolean };
export type ZoneLastAssigned = { routeZoneId: number; assignedAt: string };
export type ScheduleRow = {
  dayOfWeek: number;
  dayName: string;
  routeZoneId: number | null;
  routeZoneName: string | null;
  assignedAt?: string | null;
  zoneLastAssigned?: ZoneLastAssigned[];
};

export function mergeScheduleZones(
  filtered: RouteZoneOption[],
  _schedule?: ScheduleRow[]
): RouteZoneOption[] {
  return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

/** Drop day assignments that are inactive or not allowed for this rep (would fail on save). */
export function sanitizeScheduleForAllowedZones(
  schedule: ScheduleRow[],
  allowedZones: RouteZoneOption[]
): ScheduleRow[] {
  const allowedIds = new Set(allowedZones.map((z) => z.id));
  return schedule.map((row) => {
    if (row.routeZoneId == null || allowedIds.has(row.routeZoneId)) return row;
    return {
      ...row,
      routeZoneId: null,
      routeZoneName: null,
      assignedAt: null,
    };
  });
}

type Props = {
  zones: RouteZoneOption[];
  rows: ScheduleRow[];
  onChange: (dayOfWeek: number, routeZoneId: number | null) => void;
  loading?: boolean;
};

export default function RepRouteScheduleFields({ zones, rows, onChange, loading }: Props) {
  const { t, locale } = useLocale();

  if (loading) {
    return <p className="muted">{t.repSchedule.loading}</p>;
  }
  if (zones.length === 0) {
    return <p className="muted">{t.repSchedule.noZones}</p>;
  }

  return (
    <div className="schedule-grid">
      {rows.map((row) => (
        <div key={row.dayOfWeek} className="schedule-row">
          <div className="schedule-day">
            <strong>{row.dayName}</strong>
          </div>
          <SearchableSelect
            value={row.routeZoneId != null ? String(row.routeZoneId) : ""}
            onChange={(v) => onChange(row.dayOfWeek, v ? Number(v) : null)}
            options={zones.map((z) => {
              const last = row.zoneLastAssigned?.find((a) => a.routeZoneId === z.id)?.assignedAt;
              return {
                value: String(z.id),
                label: z.name,
                hint: last ? `${t.repSchedule.lastAssigned}: ${formatMarketDate(last, locale)}` : undefined,
              };
            })}
            allLabel={t.repSchedule.offDay}
            searchPlaceholder={t.tableFilters.selectSearch}
            ariaLabel={row.dayName}
          />
        </div>
      ))}
    </div>
  );
}
