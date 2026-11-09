import { useEffect, useRef, useState } from "react";
import ValImage from "./ValImage";
import type { ValorantAgent } from "../types/lineup";

export default function AgentGridCompact({
  agents,
  selectedAgentUuid,
  onSelect,
  hasLineups,
}: {
  agents: ValorantAgent[];
  selectedAgentUuid: string | null;
  onSelect: (uuid: string | null) => void;
  hasLineups: (uuid: string) => boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(6);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      // Compute columns: aim for tile ~48-54px + gap 6
      // w ~ 326 (350-24), so 6 cols => 48+6=54*6=324 fits, 7 cols => 42*7=294 fits with smaller tiles
      if (w < 300) setCols(5);
      else if (w < 340) setCols(6);
      else setCols(7);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = [...agents].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="rounded-card bg-panel border border-borderSubtle p-2 flex flex-col min-h-0 overflow-hidden">
      <h3 className="text-xs font-semibold text-textPrimary mb-2 shrink-0">Select an agent</h3>
      <div
        ref={containerRef}
        className="grid gap-1.5 overflow-auto overscroll-contain thin-scrollbar flex-1 min-h-0 content-start"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {sorted.map((agent) => {
          const isSelected = selectedAgentUuid === agent.uuid;
          const has = hasLineups(agent.uuid);
          return (
            <button
              key={agent.uuid}
              onClick={() => onSelect(isSelected ? null : agent.uuid)}
              title={agent.displayName}
              className={`relative rounded-md overflow-hidden aspect-square bg-tile border-2 flex flex-col items-center justify-end min-h-[40px] min-w-[40px] ${isSelected ? "border-accent bg-accent/20" : "border-transparent"} ${!has ? "opacity-40 grayscale-[0.6]" : "opacity-100"}`}
              aria-pressed={isSelected}
            >
              <ValImage src={agent.displayIcon} alt={agent.displayName} className="absolute inset-0" />
              <span className="relative z-10 w-full bg-black/70 text-white text-[8px] font-semibold text-center leading-3 py-0.5 truncate px-1">{agent.displayName}</span>
            </button>
          );
        })}
      </div>
      {selectedAgentUuid && (
        <button onClick={() => onSelect(null)} className="mt-2 w-full min-h-[36px] rounded bg-tile hover:bg-tileHover text-muted text-xs shrink-0">Clear</button>
      )}
    </div>
  );
}
