import { timeAgo } from "../../lib/utils";
import type { Article } from "../../hooks/useLeagueData";

interface Props {
  articles: Article[];
  isMobile: boolean;
}

export function NewsFeed({ articles, isMobile }: Props) {
  const features = articles.filter(a => a.article_type === "feature").slice(0, 2);
  const items = articles.filter(a => !["hero", "feature"].includes(a.article_type || "")).slice(0, 5);

  if (!articles.length) {
    return <div className="p-8 text-center text-text-subtle text-[13px]">No articles yet.</div>;
  }

  return (
    <div>
      {features.length > 0 && (
        <div className={`grid gap-3 mb-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          {features.map(f => (
            <div key={f.id} className="bg-bg3 rounded-md cursor-pointer border-l-[3px] border-l-accent" style={{ padding: isMobile ? "14px 12px" : "18px 16px" }}>
              <span className="text-[9px] font-bold text-accent tracking-wider font-display">{f.tag}</span>
              <h3 className="font-heading font-semibold text-text leading-tight my-1.5" style={{ fontSize: isMobile ? 14 : 15 }}>
                {f.title}
              </h3>
              <p className="text-xs text-text-secondary m-0 leading-snug">{f.subtitle}</p>
              <span className="text-[10px] text-text-muted mt-1.5 block">{timeAgo(f.published_at)}</span>
            </div>
          ))}
        </div>
      )}
      {items.map((n, i) => (
        <div
          key={n.id}
          className={`flex gap-3 py-3 cursor-pointer ${i < items.length - 1 ? "border-b border-border" : ""} ${isMobile ? "flex-col items-start" : "flex-row items-center"}`}
        >
          <span className="text-[9px] font-bold text-accent tracking-wider font-display min-w-[80px]">{n.tag}</span>
          <span className="text-[13px] text-text flex-1">{n.title}</span>
          {!isMobile && <span className="text-[10px] text-text-muted whitespace-nowrap">{timeAgo(n.published_at)}</span>}
        </div>
      ))}
    </div>
  );
}
