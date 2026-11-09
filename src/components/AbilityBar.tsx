import ValImage from "./ValImage";
import type { ValorantAgent } from "../types/lineup";
import type { AbilitySlot } from "../types/lineup";

export default function AbilityBar({
  agent,
  selected,
  onToggle,
}: {
  agent: ValorantAgent | null | undefined;
  selected: Set<AbilitySlot>;
  onToggle: (slot: AbilitySlot) => void;
}) {
  if (!agent) {
    return (
      <div className="rounded-card bg-panel border border-borderSubtle p-4">
        <h3 className="text-sm font-semibold text-textPrimary mb-2">Abilities</h3>
        <p className="text-muted text-sm">Select an agent to filter by abilities</p>
      </div>
    );
  }
  const lineupSlots: AbilitySlot[] = ["Ability1", "Ability2", "Grenade", "Ultimate"];
  // map agent abilities to slots, filter valid
  const abilities = agent.abilities.filter((a) => lineupSlots.includes(a.slot as AbilitySlot));

  return (
    <div className="rounded-card bg-panel border border-borderSubtle p-3">
      <h3 className="text-sm font-semibold text-textPrimary mb-3">Abilities</h3>
      <div className="flex gap-2 flex-wrap">
        {abilities.map((ab) => {
          const isSelected = selected.has(ab.slot as AbilitySlot);
          return (
            <button
              key={ab.slot}
              onClick={() => onToggle(ab.slot as AbilitySlot)}
              title={`${ab.displayName} (${ab.slot})`}
              aria-pressed={isSelected}
              className={`relative w-[56px] h-[56px] rounded-md overflow-hidden border-2 bg-tile flex items-center justify-center min-h-[48px] min-w-[48px] transition-all ${
                isSelected ? "border-accent bg-accent/20" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {ab.displayIcon ? (
                <img
                  src={ab.displayIcon}
                  alt={ab.displayName}
                  className="w-8 h-8 object-contain"
                  style={{ filter: isSelected ? "invert(29%) sepia(85%) saturate(2000%) hue-rotate(330deg) brightness(1.2)" : "none" }}
                />
              ) : (
                <span className="text-xs text-muted">{ab.slot}</span>
              )}
              {/* tooltip style */}
              <span className="sr-only">{ab.displayName}</span>
            </button>
          );
        })}
      </div>
      <p className="text-muted text-xs mt-2">All abilities start selected; click to toggle</p>
    </div>
  );
}
