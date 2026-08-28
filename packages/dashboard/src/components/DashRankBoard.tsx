import { Link } from "react-router-dom";

import { mediaUrl } from "../lib/mediaUrl";

export type DashRankRow = {
  id: string | number;
  name: string;
  to?: string;
  imageUrl?: string | null;
  roundImage?: boolean;
  primary: string;
  secondary: string;
  share: number;
};

type Props = {
  title: string;
  hint?: string;
  countLabel?: string;
  items: DashRankRow[];
  empty?: string;
  variant?: "list" | "cards";
};

export default function DashRankBoard({ title, hint, countLabel, items, empty, variant = "list" }: Props) {
  return (
    <section className={`dash-rank-board dash-rank-board--${variant}`}>
      <div className="dash-rank-board-head">
        <div>
          <h4 className="dash-section-title">{title}</h4>
          {hint ? <p className="muted small dash-rank-board-hint">{hint}</p> : null}
        </div>
        {countLabel ? <span className="dash-rank-board-count">{countLabel}</span> : null}
      </div>
      {items.length === 0 ? (
        empty ? <p className="muted small">{empty}</p> : null
      ) : (
        <ol className="dash-rank-board-list">
          {items.map((item, i) => {
            const rank = i + 1;
            const img = mediaUrl(item.imageUrl);
            const barWidth = item.share > 0 ? Math.max(item.share * 100, 6) : 0;
            const inner = (
              <>
                <span className={`dash-rank-badge${rank <= 3 ? ` dash-rank-badge--${rank}` : ""}`}>{rank}</span>
                {img ? (
                  <img
                    src={img}
                    alt=""
                    className={`dash-rank-board-thumb${item.roundImage ? " dash-rank-board-thumb--round" : ""}`}
                  />
                ) : (
                  <div
                    className={`dash-rank-board-thumb dash-rank-board-thumb--empty${item.roundImage ? " dash-rank-board-thumb--round" : ""}`}
                  />
                )}
                <div className="dash-rank-board-body">
                  <div className="dash-rank-board-top">
                    <span className="dash-rank-board-name">{item.name}</span>
                    <strong className="dash-rank-board-primary">{item.primary}</strong>
                  </div>
                  <div className="dash-rank-board-meta">{item.secondary}</div>
                  <div className="dash-rank-board-track" aria-hidden>
                    <div className="dash-rank-board-fill" style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              </>
            );
            return (
              <li key={item.id} className={`dash-rank-row${rank <= 3 ? ` dash-rank-row--top${rank}` : ""}`}>
                {item.to ? (
                  <Link to={item.to} className="dash-rank-row-inner">
                    {inner}
                  </Link>
                ) : (
                  <div className="dash-rank-row-inner">{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
