import { useEffect, useRef } from "react";

interface TwitterFeed {
  id: string;
  feed_type: "timeline" | "tweet";
  handle?: string;
  tweet_url?: string;
  title?: string;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  feeds: TwitterFeed[];
}

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load: (el?: HTMLElement) => void;
      };
    };
  }
}

function extractTweetId(url: string): string | null {
  const parts = url.split("/");
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(parts[i])) return parts[i];
  }
  return null;
}

export function TwitterFeedSection({ feeds }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const activeFeeds = feeds
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  useEffect(() => {
    if (activeFeeds.length === 0) return;

    const scriptId = "twitter-widgets-js";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      document.body.appendChild(script);
    }

    // Give the script time to load, then trigger widget rendering
    const timer = setTimeout(() => {
      window.twttr?.widgets?.load(containerRef.current ?? undefined);
    }, 500);

    return () => clearTimeout(timer);
  }, [activeFeeds]);

  if (activeFeeds.length === 0) return null;

  return (
    <div className="bg-bg2 rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border">
        <span className="font-display text-[15px] text-text-bright tracking-widest">
          LATEST FROM X
        </span>
      </div>
      <div ref={containerRef} className="flex flex-col gap-4 p-4">
        {activeFeeds.map((feed) => {
          if (feed.feed_type === "timeline" && feed.handle) {
            return (
              <div key={feed.id}>
                {feed.title && (
                  <p className="text-xs text-text-muted font-display tracking-wider mb-2">
                    {feed.title}
                  </p>
                )}
                <a
                  className="twitter-timeline"
                  href={`https://twitter.com/${feed.handle}`}
                  data-theme="dark"
                  data-chrome="noheader nofooter"
                  data-height="400"
                >
                  Tweets by @{feed.handle}
                </a>
              </div>
            );
          }

          if (feed.feed_type === "tweet" && feed.tweet_url) {
            const tweetId = extractTweetId(feed.tweet_url);
            if (!tweetId) return null;

            return (
              <div key={feed.id}>
                {feed.title && (
                  <p className="text-xs text-text-muted font-display tracking-wider mb-2">
                    {feed.title}
                  </p>
                )}
                <iframe
                  src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark`}
                  className="w-full border-0 rounded-md"
                  height="250"
                  allowFullScreen
                  title={feed.title || `Tweet ${tweetId}`}
                />
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
