import { useLocale } from "../i18n/LocaleContext";

export type RouteZoneOption = { id: number; name: string; isActive: boolean };
export type ScheduleRow = {
  dayOfWeek: number;
  dayName: string;
  routeZoneId: number | null;
  routeZoneName: string | null;
};

type Props = {
  zones: RouteZoneOption[];
  rows: ScheduleRow[];
  onChange: (dayOfWeek: number, routeZoneId: number | null) => void;
  loading?: boolean;
};

export default function RepRouteScheduleFields({ zones, rows, onChange, loading }: Props) {
  const { t } = useLocale();

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
          <select
            className="schedule-select"
            value={row.routeZoneId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange(row.dayOfWeek, v ? Number(v) : null);
            }}
          >
            <option value="">{t.repSchedule.offDay}</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
