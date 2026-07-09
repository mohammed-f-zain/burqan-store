import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import StoreMap from "../components/StoreMap";
import { useLocale } from "../i18n/LocaleContext";
import { pickAxiosErrorMessage } from "../lib/apiError";
import { mediaUrl } from "../lib/mediaUrl";
import { confirmDanger } from "../lib/swalConfirm";
import { toastError, toastSuccess } from "../lib/toast";
import { isNotRegisterReasonNote } from "../constants/notRegisterReasons";
import { formatMarketDateTime } from "../utils/formatMarketDateTime";

type ProspectDetail = {
  id: number;
  name: string;
  phone: string;
  owner_name: string;
  location_lat: number;
  location_lng: number;
  address_text: string | null;
  image_url: string | null;
  area_name: string;
  status: string;
  created_by_rep_name: string;
  converted_store_id: number | null;
  converted_store_name: string | null;
  dismiss_reason: string | null;
  created_at: string;
  updated_at: string;
};

type VisitRow = {
  id: string;
  visited_at: string;
  note: string | null;
  rep_name: string;
};

export default function PossibleClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { t } = useLocale();
  const canWrite = can("stores.write");

  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const { data } = await api.get<{ prospect: ProspectDetail; visits: VisitRow[] }>(
        `/prospect-stores/${id}`
      );
      setProspect(data.prospect);
      setVisits(data.visits ?? []);
    } catch (e) {
      setLoadFailed(true);
      toastError(pickAxiosErrorMessage(e, t.prospects.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [id, t.prospects.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function dismiss() {
    if (!prospect || !canWrite || prospect.status !== "open") return;
    const ok = await confirmDanger({
      title: t.prospects.dismissTitle,
      text: t.prospects.dismissConfirm,
      confirmText: t.prospects.dismiss,
      cancelText: t.stores.cancel,
    });
    if (!ok) return;
    try {
      await api.patch(`/prospect-stores/${prospect.id}`, { status: "dismissed" });
      toastSuccess(t.prospects.dismissed);
      await load();
    } catch (e) {
      toastError(pickAxiosErrorMessage(e, t.prospects.dismissFailed));
    }
  }

  if (loading) return <p className="muted">{t.common.loading}</p>;
  if (loadFailed || !prospect) {
    return (
      <div className="card">
        <p className="muted">{t.prospects.loadFailed}</p>
        <Link to="/app/possible-clients" className="linkish">
          {t.prospects.backToList}
        </Link>
      </div>
    );
  }

  const lastReason =
    prospect.status === "dismissed" && prospect.dismiss_reason?.trim()
      ? prospect.dismiss_reason.trim()
      : visits.find((v) => v.note?.trim())?.note?.trim() ?? null;
  const photo = mediaUrl(prospect.image_url);

  return (
    <div className="grid prospect-detail">
      <div className="card">
        <div className="row spread" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <Link to="/app/possible-clients" className="muted small linkish">
              ← {t.prospects.backToList}
            </Link>
            <h2 style={{ margin: "8px 0 0" }}>{prospect.name}</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              #{prospect.id} · {prospect.area_name}
            </p>
            <div className="prospect-detail-badges">
              <span className={`status-pill status-pill--${prospect.status}`}>
                {statusLabel(prospect.status, t)}
              </span>
              <span className="prospect-area-chip">{prospect.area_name}</span>
            </div>
          </div>
          {canWrite && prospect.status === "open" ? (
            <button type="button" className="ghost danger" onClick={() => void dismiss()}>
              {t.prospects.dismiss}
            </button>
          ) : null}
        </div>

        <div className="store-detail-grid">
          <div className="store-detail-info">
            {photo ? <img src={photo} alt="" className="store-detail-photo" /> : null}

            {lastReason ? (
              <div className="prospect-reason-callout">
                <span className="prospect-reason-callout__label">{t.prospects.colReason}</span>
                <span
                  className={
                    isNotRegisterReasonNote(lastReason) ? "visit-reason-pill" : "prospect-reason-callout__text"
                  }
                >
                  {lastReason}
                </span>
              </div>
            ) : null}

            <dl className="store-detail-dl">
              <dt>{t.prospects.colOwner}</dt>
              <dd>{prospect.owner_name}</dd>
              <dt>{t.prospects.colPhone}</dt>
              <dd>
                <a href={`tel:${prospect.phone}`} className="linkish">
                  {prospect.phone}
                </a>
              </dd>
              <dt>{t.prospects.colRep}</dt>
              <dd>{prospect.created_by_rep_name}</dd>
              <dt>{t.prospects.colCreated}</dt>
              <dd>{formatMarketDateTime(prospect.created_at)}</dd>
              {prospect.address_text ? (
                <>
                  <dt>{t.stores.colLocation}</dt>
                  <dd>{prospect.address_text}</dd>
                </>
              ) : null}
              {prospect.converted_store_id ? (
                <>
                  <dt>{t.prospects.convertedStore}</dt>
                  <dd>
                    <Link to={`/app/stores/${prospect.converted_store_id}`} className="linkish">
                      {prospect.converted_store_name ?? `#${prospect.converted_store_id}`}
                    </Link>
                  </dd>
                </>
              ) : null}
              {!lastReason ? (
                <>
                  <dt>{t.prospects.colReason}</dt>
                  <dd className="muted">{t.prospects.noReason}</dd>
                </>
              ) : null}
            </dl>
          </div>

          <div className="store-detail-map-card">
            <p className="muted small" style={{ margin: 0 }}>
              {t.prospects.detailMap}
            </p>
            <StoreMap lat={prospect.location_lat} lng={prospect.location_lng} variant="large" />
            <p className="muted small mono" style={{ marginTop: 8 }}>
              {prospect.location_lat.toFixed(6)}, {prospect.location_lng.toFixed(6)}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t.prospects.detailVisits}</h3>
        {visits.length === 0 ? (
          <p className="muted">{t.prospects.noVisits}</p>
        ) : (
          <div className="prospect-visit-timeline">
            {visits.map((v) => (
              <div key={v.id} className="prospect-visit-card">
                <div className="prospect-visit-card__head">
                  <time className="prospect-visit-card__date">{formatMarketDateTime(v.visited_at)}</time>
                  <span className="prospect-visit-card__rep">{v.rep_name}</span>
                </div>
                <div className="prospect-visit-card__body">
                  {v.note?.trim() ? (
                    <span className={isNotRegisterReasonNote(v.note) ? "visit-reason-pill" : undefined}>
                      {v.note.trim()}
                    </span>
                  ) : (
                    <span className="muted">{t.prospects.noReason}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function statusLabel(
  status: string,
  t: { prospects: { statusOpen: string; statusConverted: string; statusDismissed: string } }
) {
  if (status === "open") return t.prospects.statusOpen;
  if (status === "converted") return t.prospects.statusConverted;
  if (status === "dismissed") return t.prospects.statusDismissed;
  return status;
}
