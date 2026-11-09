import type { Lineup } from "../types/lineup";
import { useEffect, useState } from "react";
import { getMediaUrl } from "../lib/indexedDBRepository";

function LineupCard({ lineup, agent, onClick }: { lineup: Lineup; agent: any; onClick: () => void }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      const candidates = [
        lineup.slots?.landing ?? lineup.media.landingImage,
        lineup.media.standImage ?? lineup.slots?.stand1,
        lineup.slots?.stand1,
        lineup.steps?.[0]?.image,
        lineup.attributes?.projectiles?.[0]?.landingImage,
      ].filter(Boolean) as string[];
      for (const src of candidates) {
        if (!src) continue;
        if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("blob:")) {
          if (!cancelled) setThumbUrl(src);
          return;
        }
        try {
          const u = await getMediaUrl(src);
          if (u && !cancelled) { setThumbUrl(u); url = u; return; }
        } catch {}
      }
      // fallback: try any media by lineupId
      // If still null, no preview
    })();
    return () => {
      cancelled = true;
      if (url) setTimeout(() => { try { URL.revokeObjectURL(url!); } catch {} }, 5000);
    };
  }, [lineup]);

  return (
    <button
      onClick={onClick}
      className="rounded-card bg-panel border border-borderSubtle overflow-hidden text-left hover:border-accent transition-colors flex flex-col"
    >
      <div className="h-[140px] bg-black relative overflow-hidden">
        {thumbUrl ? (
          thumbUrl.endsWith(".mp4") || thumbUrl.endsWith(".webm") ? (
            <video src={thumbUrl} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img src={thumbUrl} alt={lineup.title} className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-tile text-muted text-xs">No preview</div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <span className="text-white text-xs font-bold">{lineup.site ? `Site ${lineup.site}` : lineup.side}</span>
        </div>
      </div>
      <div className="p-2 flex-1 flex flex-col gap-1">
        <p className="text-sm font-bold text-textPrimary leading-tight line-clamp-2">{lineup.title}</p>
        <p className="text-xs text-muted">{agent?.displayName ?? "Agent"} • {lineup.abilitySlot}</p>
        <div className="flex gap-1 mt-1 flex-wrap">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border" style={{ borderColor: lineup.importance === "essential" ? "#22C55E" : lineup.importance === "optional" ? "#E8404F" : "#EDEDED", color: lineup.importance === "essential" ? "#22C55E" : lineup.importance === "optional" ? "#E8404F" : "#EDEDED" }}>{lineup.importance}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-borderSubtle text-muted">{lineup.difficulty}</span>
        </div>
      </div>
    </button>
  );
}

export default function LineupListView({
  lineups,
  agentsMap,
  onSelect,
}: {
  lineups: Lineup[];
  agentsMap: Map<string, any>;
  onSelect: (id: string) => void;
}) {
  if (lineups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#131315] p-6">
        <div className="bg-panel/90 border border-borderSubtle rounded-card p-6 text-center">
          <p className="text-textPrimary font-semibold">No lineups match your filters</p>
          <p className="text-muted text-sm mt-1">Try adjusting filters</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-auto p-3 bg-[#131315]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {lineups.map((l) => (
          <LineupCard key={l.id} lineup={l} agent={agentsMap.get(l.agentUuid)} onClick={() => onSelect(l.id)} />
        ))}
      </div>
    </div>
  );
}
