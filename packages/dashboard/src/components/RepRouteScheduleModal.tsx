import { useCallback, useEffect, useState } from "react";

import { api } from "../api";
import RepRouteCalendar, { type CalendarDay } from "./RepRouteCalendar";
import {
  mergeScheduleZones,
  sanitizeScheduleForAllowedZones,
  type RouteZoneOption,
  type ScheduleRow,
} from "./RepRouteScheduleFields";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { toastError, toastSuccess } from "../lib/toast";

type Props = {
  repId: number;
  repName: string;
  onClose: () => void;
};

function currentAmmanMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}

export default function RepRouteScheduleModal({ repId, repName, onClose }: Props) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zones, setZones] = useState<RouteZoneOption[]>([]);
  const [weeklyRows, setWeeklyRows] = useState<ScheduleRow[]>([]);
  const [month, setMonth] = useState(currentAmmanMonth);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [pendingOverrides, setPendingOverrides] = useState<Record<string, number | null | "remove">>({});

  const loadMonth = useCallback(
    async (m: string, keepPending = false) => {
      setLoading(true);
      try {
        const [z, s] = await Promise.all([
          api.get<{ routeZones: RouteZoneOption[] }>("/route-zones", {
            params: { representativeId: repId },
          }),
          api.get<{
            schedule: ScheduleRow[];
            weekly?: ScheduleRow[];
            days?: CalendarDay[];
          }>(`/representatives/${repId}/route-schedule`, { params: { month: m } }),
        ]);
        const weekly = s.data.weekly ?? s.data.schedule;
        const allowed = mergeScheduleZones(
          z.data.routeZones.filter((x) => x.isActive),
          weekly
        );
        setZones(allowed);
        setWeeklyRows(sanitizeScheduleForAllowedZones(weekly, allowed));
        setDays(s.data.days ?? []);
        if (!keepPending) setPendingOverrides({});
      } catch (e) {
        toastError(pickAxiosErrorMessage(e, t.repSchedule.loadFailed));
        onClose();
      } finally {
        setLoading(false);
      }
    },
    [repId, onClose, t.repSchedule.loadFailed]
  );

  useEffect(() => {
    void loadMonth(month);
  }, [loadMonth, month]);

  function setZoneForDay(dayOfWeek: number, routeZoneId: number | null) {
    setWeeklyRows((prev) =>
      prev.map((r) =>
        r.dayOfWeek === dayOfWeek
          ? {
              ...r,
              routeZoneId,
              routeZoneName: zones.find((z) => z.id === routeZoneId)?.name ?? null,
              assignedAt: routeZoneId === r.routeZoneId ? r.assignedAt : null,
            }
          : r
      )
    );
  }

  function onSetOverride(date: string, value: number | null | "remove") {
    setPendingOverrides((prev) => ({ ...prev, [date]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const overrides = Object.entries(pendingOverrides).map(([date, value]) => {
        if (value === "remove") return { date, routeZoneId: null as number | null, remove: true };
        return { date, routeZoneId: value };
      });
      const { data } = await api.put<{
        schedule: ScheduleRow[];
        weekly?: ScheduleRow[];
        days?: CalendarDay[];
      }>(`/representatives/${repId}/route-schedule`, {
        weekly: weeklyRows.map((r) => ({ dayOfWeek: r.dayOfWeek, routeZoneId: r.routeZoneId })),
        overrides: overrides.length ? overrides : undefined,
        month,
      });
      const weekly = data.weekly ?? data.schedule;
      setWeeklyRows(sanitizeScheduleForAllowedZones(weekly, zones));
      setDays(data.days ?? []);
      setPendingOverrides({});
      toastSuccess(t.repSchedule.saved);
      onClose();
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.repSchedule.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal wide card" onClick={(e) => e.stopPropagation()} role="dialog">
        <h3>{t.repSchedule.title}</h3>
        <p className="muted">{t.repSchedule.subtitle.replace("{name}", repName)}</p>

        <RepRouteCalendar
          zones={zones}
          weeklyRows={weeklyRows}
          onWeeklyChange={setZoneForDay}
          month={month}
          onMonthChange={setMonth}
          days={days}
          pendingOverrides={pendingOverrides}
          onSetOverride={onSetOverride}
          loading={loading}
        />

        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="primary"
            disabled={loading || saving || zones.length === 0}
            onClick={() => void save()}
          >
            {saving ? t.repSchedule.saving : t.repSchedule.saveBtn}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            {t.repSchedule.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
