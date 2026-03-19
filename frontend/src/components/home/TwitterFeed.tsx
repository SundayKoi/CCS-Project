import { useState, useEffect } from "react";

interface TwitterFeedItem {
  id: string;
  feed_type: "timeline" | "tweet";
  handle?: string;
  tweet_url?: string;
  title?: string;
  is_active: boolean;
  sort_order: number;
}

interface Tweet {
  id: string;
  text: string;
  created_at: string | null;
  metrics: { likes: number; retweets: number; replies: number };
  url: string;
}

interface Props {
  feeds: TwitterFeedItem[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function TweetCard({ tweet, handle }: { tweet: Tweet; handle: string }) {
  return (
    <a
      href={tweet.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-bg3 rounded-lg p-4 border border-border hover:border-border2 transition-colors no-underline"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs font-heading">
          {handle.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-heading text-[13px] text-text-bright font-medium">@{handle}</span>
          {tweet.created_at && (
            <span className="text-text-dim text-[11px] ml-2">{timeAgo(tweet.created_at)}</span>
          )}
        </div>
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-text-dim shrink-0" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </div>
      <p className="text-text text-[13px] leading-relaxed whitespace-pre-wrap break-words">
        {tweet.text}
      </p>
      <div className="flex gap-4 mt-3 text-text-muted text-[11px]">
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
          {tweet.metrics.replies}
        </span>
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>
          {tweet.metrics.retweets}
        </span>
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
          {tweet.metrics.likes}
        </span>
      </div>
    </a>
  );
}

function TimelineFeed({ handle }: { handle: string }) {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/tweets/${handle}?count=5`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch tweets (${res.status})`);
        return res.json();
      })
      .then(data => {
        if (!cancelled) { setTweets(data.tweets || []); setLoading(false); }
      })
      .catch(err => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [handle]);

  if (loading) return <div className="text-text-dim text-xs py-4 text-center">Loading @{handle}...</div>;
  if (error) return <div className="text-ccs-red text-xs py-2 text-center">{error}</div>;
  if (!tweets.length) return <div className="text-text-dim text-xs py-2 text-center">No recent tweets from @{handle}</div>;

  return (
    <div className="flex flex-col gap-3">
      {tweets.map(tweet => (
        <TweetCard key={tweet.id} tweet={tweet} handle={handle} />
      ))}
    </div>
  );
}

function SingleTweetEmbed({ tweetUrl, title }: { tweetUrl: string; title?: string }) {
  // Extract handle and tweet ID from URL
  const match = tweetUrl.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/);
  const handle = match?.[1] || "unknown";
  const tweetId = match?.[2];

  const [tweet, setTweet] = useState<Tweet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle || handle === "unknown") { setLoading(false); return; }
    let cancelled = false;
    fetch(`${API_BASE}/api/tweets/${handle}?count=10`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data) { setLoading(false); return; }
        const found = (data.tweets || []).find((t: Tweet) => t.id === tweetId);
        if (!cancelled) { setTweet(found || null); setLoading(false); }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [handle, tweetId]);

  if (loading) return <div className="text-text-dim text-xs py-2 text-center">Loading tweet...</div>;

  // If we couldn't find it via API, link out
  if (!tweet) {
    return (
      <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="block bg-bg3 rounded-lg p-4 border border-border no-underline text-center">
        <p className="text-text-secondary text-[13px]">{title || "View tweet on X"}</p>
        <span className="text-accent text-xs mt-1 block">Open on X →</span>
      </a>
    );
  }

  return <TweetCard tweet={tweet} handle={handle} />;
}

export function TwitterFeedSection({ feeds }: Props) {
  const activeFeeds = feeds
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (activeFeeds.length === 0) return null;

  const timelines = activeFeeds.filter(f => f.feed_type === "timeline" && f.handle);
  const tweets = activeFeeds.filter(f => f.feed_type === "tweet" && f.tweet_url);

  return (
    <div className="bg-bg2 rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-text-muted" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span className="font-display text-[15px] text-text-bright tracking-widest">
          LATEST FROM X
        </span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {timelines.map(feed => (
          <div key={feed.id}>
            <TimelineFeed handle={feed.handle!} />
          </div>
        ))}
        {tweets.map(feed => (
          <div key={feed.id}>
            <SingleTweetEmbed tweetUrl={feed.tweet_url!} title={feed.title} />
          </div>
        ))}
      </div>
    </div>
  );
}
