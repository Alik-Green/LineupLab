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
      <div className="rounded-card bg-panel border border-borderSubtle p-3">
        <h3 className="text-sm font-semibold text-textPrimary mb-2">Abilities</h3>
        <p className="text-muted text-sm">Select an agent to filter by abilities</p>
      </div>
    );
  }
  const lineupSlots: AbilitySlot[] = ["Ability1", "Ability2", "Grenade", "Ultimate"];
  const abilities = agent.abilities.filter((a) => lineupSlots.includes(a.slot as AbilitySlot));

  return (
    <div className="rounded-card bg-panel border border-borderSubtle p-2">
      <h3 className="text-[10px] font-bold tracking-widest text-muted mb-1.5 text-center">ABILITIES</h3>
      <div className="grid grid-cols-4 gap-1.5">
        {abilities.map((ab) => {
          const isSelected = selected.has(ab.slot as AbilitySlot);
          return (
            <button
              key={ab.slot}
              onClick={() => onToggle(ab.slot as AbilitySlot)}
              title={`${ab.displayName} (${ab.slot})`}
              aria-pressed={isSelected}
              className={`relative h-[44px] rounded-md overflow-hidden border bg-tile flex items-center justify-center transition-all ${
                isSelected ? "border-accent bg-accent/20" : "border-borderSubtle opacity-60 hover:opacity-100"
              }`}
            >
              {ab.displayIcon ? (
                <img
                  src={ab.displayIcon}
                  alt={ab.displayName}
                  className="w-7 h-7 object-contain"
                  style={{ filter: isSelected ? "invert(29%) sepia(85%) saturate(2000%) hue-rotate(330deg) brightness(1.2)" : "none" }}
                />
              ) : (
                <span className="text-xs text-muted">{ab.slot}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
