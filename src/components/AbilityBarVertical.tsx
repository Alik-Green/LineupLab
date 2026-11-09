import ValImage from "./ValImage";
import type { ValorantAgent } from "../types/lineup";

export default function AbilityBarVertical({
  agents,
  abilities,
  selectedAgent,
  onAbilityToggle,
}: {
  agents: ValorantAgent[];
  abilities: { slot: string; uuid: string; displayName: string; displayIcon: string | null; agentUuid: string }[];
  selectedAgent: ValorantAgent | null;
  onAbilityToggle: (slot: string | null) => void;
}) {
  const byAgent = new Map<string, typeof abilities>();
  abilities.forEach((ab) => {
    const arr = byAgent.get(ab.agentUuid) ?? [];
    arr.push(ab);
    byAgent.set(ab.agentUuid, arr);
  });

  return (
    <div className="flex flex-col gap-1 overflow-auto overscroll-contain thin-scrollbar py-2 pr-1">
      {selectedAgent && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted font-semibold">{selectedAgent.displayName}</p>
          <div className="flex flex-col gap-1">
            {(byAgent.get(selectedAgent.uuid) ?? []).map((ab) => (
              <button
                key={ab.uuid}
                onClick={() => onAbilityToggle(ab.slot)}
                className="w-12 h-12 min-h-[40px] min-w-[40px] rounded bg-tile border border-borderSubtle overflow-hidden p-1 flex items-center justify-center"
                title={`${ab.displayName} (${ab.slot})`}
              >
                {ab.displayIcon ? <ValImage src={ab.displayIcon} alt={ab.displayName} /> : <span className="text-[10px] text-muted">{ab.slot}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
