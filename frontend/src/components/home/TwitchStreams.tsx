interface TwitchEmbed {
  id: string;
  embed_type: "channel" | "clip";
  channel_name?: string;
  clip_url?: string;
  title?: string;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  embeds: TwitchEmbed[];
  parentDomain: string;
}

function extractClipSlug(url: string): string | null {
  const parts = url.split("/").filter(Boolean);
  // Handles URLs like https://clips.twitch.tv/SomeClipSlug
  // or https://www.twitch.tv/channel/clip/SomeClipSlug
  return parts[parts.length - 1] || null;
}

export function TwitchStreams({ embeds, parentDomain }: Props) {
  const activeEmbeds = embeds
    .filter((e) => e.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const channels = activeEmbeds.filter((e) => e.embed_type === "channel");
  const clips = activeEmbeds.filter((e) => e.embed_type === "clip");
  const sorted = [...channels, ...clips];

  if (sorted.length === 0) return null;

  return (
    <div className="bg-bg2 rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border">
        <span className="font-display text-[15px] text-text-bright tracking-widest">
          TWITCH
        </span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {sorted.map((embed) => {
          if (embed.embed_type === "channel" && embed.channel_name) {
            return (
              <div key={embed.id}>
                {embed.title && (
                  <p className="text-xs text-text-muted font-display tracking-wider mb-2">
                    {embed.title}
                  </p>
                )}
                <div className="aspect-video overflow-hidden rounded-md">
                  <iframe
                    src={`https://player.twitch.tv/?channel=${embed.channel_name}&parent=${parentDomain}&muted=true`}
                    height="300"
                    width="100%"
                    className="border-0 w-full h-full"
                    allowFullScreen
                    title={embed.title || embed.channel_name}
                  />
                </div>
              </div>
            );
          }

          if (embed.embed_type === "clip" && embed.clip_url) {
            const slug = extractClipSlug(embed.clip_url);
            if (!slug) return null;

            return (
              <div key={embed.id}>
                <div className="aspect-video overflow-hidden rounded-md">
                  <iframe
                    src={`https://clips.twitch.tv/embed?clip=${slug}&parent=${parentDomain}&muted=true`}
                    height="200"
                    width="100%"
                    className="border-0 w-full h-full"
                    allowFullScreen
                    title={embed.title || slug}
                  />
                </div>
                {embed.title && (
                  <p className="text-xs text-text-muted font-display tracking-wider mt-2">
                    {embed.title}
                  </p>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
