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
  schedule: ScheduleRow[]
): RouteZoneOption[] {
  const byId = new Map(filtered.map((z) => [z.id, z]));
  for (const row of schedule) {
    if (row.routeZoneId != null && !byId.has(row.routeZoneId)) {
      byId.set(row.routeZoneId, {
        id: row.routeZoneId,
        name: row.routeZoneName ?? String(row.routeZoneId),
        isActive: true,
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "ar"));
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
