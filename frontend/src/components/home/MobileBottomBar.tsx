interface Props {
  active: string;
  setActive: (tab: string) => void;
}

const ITEMS = [
  { k: "Home", i: "🏠" },
  { k: "Scores", i: "📋" },
  { k: "Standings", i: "🏆" },
  { k: "Stats", i: "📊" },
  { k: "Teams", i: "⚔️" },
];

export function MobileBottomBar({ active, setActive }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[rgba(10,10,10,0.95)] backdrop-blur-xl border-t border-border flex justify-around items-center z-[200]" style={{ padding: "6px 0 env(safe-area-inset-bottom, 8px)" }}>
      {ITEMS.map(t => (
        <button
          key={t.k}
          onClick={() => setActive(t.k)}
          className="bg-transparent border-none cursor-pointer flex flex-col items-center gap-0.5 py-1.5 px-3 min-w-[56px]"
        >
          <span className="text-lg" style={{ filter: active === t.k ? "none" : "grayscale(1) opacity(0.5)" }}>{t.i}</span>
          <span className={`font-heading text-[9px] tracking-wide uppercase ${active === t.k ? "text-accent font-bold" : "text-text-muted font-normal"}`}>
            {t.k}
          </span>
        </button>
      ))}
    </div>
  );
}
