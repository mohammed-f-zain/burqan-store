type Props = {
  lat: number | string;
  lng: number | string;
  variant?: "thumb" | "large";
};

function coords(lat: number | string, lng: number | string): { la: number; lo: number } | null {
  const la = typeof lat === "number" ? lat : parseFloat(String(lat));
  const lo = typeof lng === "number" ? lng : parseFloat(String(lng));
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return { la, lo };
}

export function osmExternalUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

/** OSM embed (www.openstreetmap.org). Do not use staticmap.openstreetmap.de — that host often fails DNS. */
function osmEmbedUrl(la: number, lo: number, pad: number): string {
  const bbox = `${lo - pad},${la - pad},${lo + pad},${la + pad}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${la}%2C${lo}`;
}

export default function StoreMap({ lat, lng, variant = "thumb" }: Props) {
  const c = coords(lat, lng);
  if (!c) return <span className="muted small">—</span>;
  const { la, lo } = c;

  const pad = variant === "thumb" ? 0.006 : 0.01;
  const embedSrc = osmEmbedUrl(la, lo, pad);

  if (variant === "thumb") {
    return (
      <a
        href={osmExternalUrl(la, lo)}
        target="_blank"
        rel="noopener noreferrer"
        className="store-map-thumb-wrap"
        onClick={(e) => e.stopPropagation()}
        title={`${la.toFixed(4)}, ${lo.toFixed(4)}`}
      >
        <iframe className="store-map-embed store-map-embed--thumb" title="Map" loading="lazy" src={embedSrc} />
      </a>
    );
  }

  return (
    <div className="store-map-large-wrap">
      <iframe className="store-map-embed store-map-embed--large" title="Map" loading="lazy" src={embedSrc} />
      <a href={osmExternalUrl(la, lo)} target="_blank" rel="noopener noreferrer" className="store-map-open-link">
        OpenStreetMap ↗
      </a>
    </div>
  );
}
