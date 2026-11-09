import ValImage from "./ValImage";
import type { ValorantAgent } from "../types/lineup";

export default function AgentGrid({
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
    <div className="rounded-card bg-panel border border-borderSubtle p-3">
      <h3 className="text-sm font-semibold text-textPrimary mb-3">Select an agent</h3>
      <div className="grid grid-cols-5 gap-2 max-h-[340px] overflow-auto pr-1">
        {sorted.map((agent) => {
          const isSelected = selectedAgentUuid === agent.uuid;
          const has = hasLineups(agent.uuid);
          return (
            <button
              key={agent.uuid}
              onClick={() => onSelect(isSelected ? null : agent.uuid)}
              title={agent.displayName}
              className={`relative rounded-md overflow-hidden aspect-square bg-tile border-2 transition-all min-h-[44px] min-w-[44px] ${
                isSelected ? "border-accent bg-accent/20 !brightness-110" : "border-transparent"
              } ${!has ? "opacity-40 grayscale-[0.6]" : "opacity-100"}`}
              aria-pressed={isSelected}
            >
              <ValImage src={agent.displayIcon} alt={agent.displayName} className="absolute inset-0" />
              <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] font-semibold text-center leading-3 py-0.5">
                {agent.displayName}
              </span>
              {isSelected && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>
      {selectedAgentUuid && (
        <button
          onClick={() => onSelect(null)}
          className="mt-3 w-full min-h-[40px] rounded bg-tile hover:bg-tileHover text-muted text-sm transition-colors"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
