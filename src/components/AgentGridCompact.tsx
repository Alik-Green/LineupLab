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
  const sorted = [...agents].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="rounded-card bg-panel border border-borderSubtle p-2 flex flex-col min-h-0 overflow-hidden">
      <h3 className="text-xs font-semibold text-textPrimary mb-2 shrink-0">Select an agent</h3>
      <div className="grid gap-1.5 overflow-y-auto overflow-x-hidden overscroll-contain thin-scrollbar flex-1 min-h-0 content-start grid-cols-4 auto-rows-[52px]">
        {sorted.map((agent) => {
          const isSelected = selectedAgentUuid === agent.uuid;
          const has = hasLineups(agent.uuid);
          return (
            <button
              key={agent.uuid}
              onClick={() => onSelect(isSelected ? null : agent.uuid)}
              title={agent.displayName}
              className={`relative rounded-md overflow-hidden bg-tile border-2 flex flex-col items-center justify-end h-[52px] min-h-[52px] w-full ${isSelected ? "border-accent bg-accent/20" : "border-transparent"} ${!has ? "opacity-40 grayscale-[0.6]" : "opacity-100"}`}
              aria-pressed={isSelected}
            >
              <ValImage src={agent.displayIcon} alt={agent.displayName} className="absolute inset-0 object-cover" />
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
