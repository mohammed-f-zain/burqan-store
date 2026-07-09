import { useEffect, useState } from "react";

import { api } from "../api";
import RepRouteScheduleFields, {
  mergeScheduleZones,
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

export default function RepRouteScheduleModal({ repId, repName, onClose }: Props) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zones, setZones] = useState<RouteZoneOption[]>([]);
  const [rows, setRows] = useState<ScheduleRow[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [z, s] = await Promise.all([
          api.get<{ routeZones: RouteZoneOption[] }>("/route-zones", {
            params: { representativeId: repId },
          }),
          api.get<{ schedule: ScheduleRow[] }>(`/representatives/${repId}/route-schedule`),
        ]);
        const schedule = s.data.schedule;
        setZones(mergeScheduleZones(z.data.routeZones.filter((x) => x.isActive), schedule));
        setRows(schedule);
      } catch (e) {
        toastError(pickAxiosErrorMessage(e, t.repSchedule.loadFailed));
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [repId, onClose, t.repSchedule.loadFailed]);

  function setZoneForDay(dayOfWeek: number, routeZoneId: number | null) {
    setRows((prev) =>
      prev.map((r) =>
        r.dayOfWeek === dayOfWeek
          ? {
              ...r,
              routeZoneId,
              routeZoneName: zones.find((z) => z.id === routeZoneId)?.name ?? null,
            }
          : r
      )
    );
  }

  async function save() {
    setSaving(true);
    try {
      const { data } = await api.put<{ schedule: ScheduleRow[] }>(
        `/representatives/${repId}/route-schedule`,
        {
          entries: rows.map((r) => ({ dayOfWeek: r.dayOfWeek, routeZoneId: r.routeZoneId })),
        }
      );
      setRows(data.schedule);
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

        <RepRouteScheduleFields
          zones={zones}
          rows={rows}
          loading={loading}
          onChange={setZoneForDay}
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
