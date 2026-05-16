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

export default function StoreMap({ lat, lng, variant = "thumb" }: Props) {
  const c = coords(lat, lng);
  if (!c) return <span className="muted small">—</span>;
  const { la, lo } = c;

  if (variant === "thumb") {
    const src = `https://staticmap.openstreetmap.de/staticmap.php?center=${la},${lo}&zoom=14&size=140x90&markers=${la},${lo}`;
    return (
      <a
        href={osmExternalUrl(la, lo)}
        target="_blank"
        rel="noopener noreferrer"
        className="store-map-thumb-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={src} alt="" className="store-map-thumb" loading="lazy" />
      </a>
    );
  }

  const pad = 0.01;
  const bbox = `${lo - pad},${la - pad},${lo + pad},${la + pad}`;
  return (
    <div className="store-map-large-wrap">
      <iframe
        className="store-map-embed"
        title="Map"
        loading="lazy"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${la}%2C${lo}`}
      />
      <a href={osmExternalUrl(la, lo)} target="_blank" rel="noopener noreferrer" className="store-map-open-link">
        OpenStreetMap ↗
      </a>
    </div>
  );
}
