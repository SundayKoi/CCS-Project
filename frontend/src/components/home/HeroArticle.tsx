import { timeAgo } from "../../lib/utils";
import type { Article } from "../../hooks/useLeagueData";

interface Props {
  article: Article;
  isMobile: boolean;
}

export function HeroArticle({ article, isMobile }: Props) {
  return (
    <div
      className="relative overflow-hidden cursor-pointer flex flex-col justify-end"
      style={{
        background: article.image_url || "linear-gradient(135deg, #6B21A8 0%, #1E1B4B 100%)",
        borderRadius: isMobile ? 6 : 8,
        minHeight: isMobile ? 200 : 280,
      }}
    >
      <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)" }} />
      <div className="relative z-[2]" style={{ padding: isMobile ? "20px 16px" : "32px 28px" }}>
        {article.tag && (
          <span className="inline-block bg-accent text-white font-extrabold rounded font-display tracking-wider mb-2" style={{ fontSize: isMobile ? 9 : 10, padding: "3px 8px" }}>
            {article.tag}
          </span>
        )}
        <h2 className="font-display font-normal text-white leading-tight mb-1.5" style={{ fontSize: isMobile ? 22 : 30 }}>
          {article.title}
        </h2>
        {article.subtitle && (
          <p className="text-text-secondary leading-normal m-0" style={{ fontSize: isMobile ? 12 : 14 }}>
            {article.subtitle}
          </p>
        )}
        <span className="text-[11px] text-text-muted mt-2 block">
          {article.author} · {timeAgo(article.published_at)}
        </span>
      </div>
    </div>
  );
}
