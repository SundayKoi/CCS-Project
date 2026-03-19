interface TwitterFeedItem {
  id: string;
  feed_type: "timeline" | "tweet";
  handle?: string;
  tweet_url?: string;
  title?: string;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  feeds: TwitterFeedItem[];
}

function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

function extractHandle(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status/);
  return match ? match[1] : null;
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
        {/* Timeline embeds */}
        {timelines.map(feed => (
          <div key={feed.id}>
            <a
              href={`https://x.com/${feed.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mb-3 no-underline group"
            >
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs font-heading">
                {(feed.handle || "?").charAt(0).toUpperCase()}
              </div>
              <span className="font-heading text-[13px] text-text-bright font-medium group-hover:text-accent transition-colors">
                @{feed.handle}
              </span>
              <span className="text-text-dim text-[10px] ml-auto">View on X →</span>
            </a>
            <iframe
              src={`https://syndication.twitter.com/srv/timeline-profile/screen-name/${feed.handle}?dnt=true&embedId=tw-${feed.id}&hideBorder=true&hideFooter=true&hideHeader=true&hideScrollBar=false&lang=en&theme=dark&transparent=true&showReplies=false`}
              className="w-full border-0 rounded-md"
              style={{ minHeight: 400, colorScheme: "dark" }}
              title={`@${feed.handle} timeline`}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        ))}

        {/* Individual tweet embeds */}
        {tweets.map(feed => {
          const tweetId = extractTweetId(feed.tweet_url!);
          const handle = extractHandle(feed.tweet_url!) || "unknown";
          if (!tweetId) return null;
          return (
            <div key={feed.id}>
              {feed.title && (
                <p className="text-xs text-text-muted font-heading tracking-wider mb-2 uppercase">
                  {feed.title}
                </p>
              )}
              <a
                href={feed.tweet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block no-underline"
              >
                <iframe
                  src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark&dnt=true`}
                  className="w-full border-0 rounded-md pointer-events-none"
                  height="280"
                  title={feed.title || `Tweet by @${handle}`}
                  sandbox="allow-scripts allow-same-origin"
                />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
