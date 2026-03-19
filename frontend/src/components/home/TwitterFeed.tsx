import { useEffect, useRef, useState } from "react";

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
      widgets: {
        load: (el?: HTMLElement) => void;
        createTimeline: (
          source: { sourceType: string; screenName: string },
          target: HTMLElement,
          options?: Record<string, unknown>
        ) => Promise<HTMLElement>;
        createTweet: (
          tweetId: string,
          target: HTMLElement,
          options?: Record<string, unknown>
        ) => Promise<HTMLElement>;
      };
    };
  }
}

function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

function loadTwitterScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.twttr?.widgets) {
      resolve();
      return;
    }
    const existing = document.getElementById("twitter-wjs");
    if (existing) {
      // Script tag exists but not loaded yet, wait for it
      const check = setInterval(() => {
        if (window.twttr?.widgets) { clearInterval(check); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 5000);
      return;
    }
    const script = document.createElement("script");
    script.id = "twitter-wjs";
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => {
      const check = setInterval(() => {
        if (window.twttr?.widgets) { clearInterval(check); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 5000);
    };
    document.head.appendChild(script);
  });
}

function TimelineEmbed({ handle }: { handle: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTwitterScript().then(() => {
      if (cancelled || !ref.current || !window.twttr?.widgets) return;
      ref.current.innerHTML = "";
      window.twttr.widgets
        .createTimeline(
          { sourceType: "profile", screenName: handle },
          ref.current,
          { theme: "dark", chrome: "noheader nofooter noborders transparent", height: 450, dnt: true }
        )
        .then(() => { if (!cancelled) setLoaded(true); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [handle]);

  return (
    <div>
      <div ref={ref} className="min-h-[100px]" />
      {!loaded && (
        <div className="text-text-dim text-xs py-4 text-center">Loading @{handle} timeline...</div>
      )}
    </div>
  );
}

function TweetEmbed({ tweetUrl }: { tweetUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const tweetId = extractTweetId(tweetUrl);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!tweetId) return;
    let cancelled = false;
    loadTwitterScript().then(() => {
      if (cancelled || !ref.current || !window.twttr?.widgets) return;
      ref.current.innerHTML = "";
      window.twttr.widgets
        .createTweet(tweetId, ref.current, { theme: "dark", dnt: true })
        .then(() => { if (!cancelled) setLoaded(true); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [tweetId]);

  if (!tweetId) return null;

  return (
    <div>
      <div ref={ref} />
      {!loaded && (
        <div className="text-text-dim text-xs py-2 text-center">Loading tweet...</div>
      )}
    </div>
  );
}

export function TwitterFeedSection({ feeds }: Props) {
  const activeFeeds = feeds
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (activeFeeds.length === 0) return null;

  return (
    <div className="bg-bg2 rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border">
        <span className="font-display text-[15px] text-text-bright tracking-widest">
          LATEST FROM X
        </span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {activeFeeds.map((feed) => {
          if (feed.feed_type === "timeline" && feed.handle) {
            return (
              <div key={feed.id}>
                {feed.title && (
                  <p className="text-xs text-text-muted font-heading tracking-wider mb-2 uppercase">
                    @{feed.handle}
                  </p>
                )}
                <TimelineEmbed handle={feed.handle} />
              </div>
            );
          }

          if (feed.feed_type === "tweet" && feed.tweet_url) {
            return (
              <div key={feed.id}>
                {feed.title && (
                  <p className="text-xs text-text-muted font-heading tracking-wider mb-2 uppercase">
                    {feed.title}
                  </p>
                )}
                <TweetEmbed tweetUrl={feed.tweet_url} />
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
