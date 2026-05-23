import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useOwnerArabic } from "../owner/useOwnerArabic";
import { publicApi } from "../publicApi";

export default function PublicQrRedirect() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const t = useOwnerArabic();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token?.trim()) {
      setErr(t.owner.missingToken);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await publicApi.get<{ ownerPortalToken: string }>(`/qr/${encodeURIComponent(token.trim())}`);
        if (cancelled) return;
        navigate(`/owner?t=${encodeURIComponent(res.data.ownerPortalToken)}`, { replace: true });
      } catch {
        if (!cancelled) setErr(t.owner.qrNotLinked);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate, t.owner.missingToken, t.owner.qrNotLinked]);

  return (
    <div className="owner-shell">
      <div className="owner-loading">
        {err ? <p className="owner-error">{err}</p> : <p className="owner-muted">{t.common.loading}</p>}
      </div>
    </div>
  );
}
