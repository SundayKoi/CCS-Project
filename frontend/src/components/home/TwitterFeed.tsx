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

function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
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
      <div className="px-4 py-3.5 border-b border-border">
        <span className="font-display text-[15px] text-text-bright tracking-widest">
          LATEST FROM X
        </span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {/* Timeline embeds using publish.twitter.com iframe */}
        {timelines.map((feed) => (
          <div key={feed.id}>
            <a
              href={`https://x.com/${feed.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent font-heading tracking-wider no-underline hover:underline uppercase mb-2 block"
            >
              @{feed.handle}
            </a>
            <iframe
              src={`https://syndication.twitter.com/srv/timeline-profile/screen-name/${feed.handle}?dnt=true&embedId=tw-${feed.id}&frame=false&hideBorder=true&hideFooter=true&hideHeader=true&hideScrollBar=false&lang=en&theme=dark&transparent=true&showReplies=false`}
              className="w-full border-0 rounded-md bg-transparent"
              height="450"
              title={`@${feed.handle} timeline`}
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        ))}

        {/* Individual tweet embeds */}
        {tweets.map((feed) => {
          const tweetId = extractTweetId(feed.tweet_url!);
          if (!tweetId) return null;
          return (
            <div key={feed.id}>
              {feed.title && (
                <p className="text-xs text-text-muted font-heading tracking-wider mb-2 uppercase">
                  {feed.title}
                </p>
              )}
              <iframe
                src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark&dnt=true`}
                className="w-full border-0 rounded-md"
                height="300"
                title={feed.title || `Tweet ${tweetId}`}
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
