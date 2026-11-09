import type { Side } from "../types/lineup";

export default function SideToggle({
  side,
  onSideChange,
}: {
  side: Side;
  onSideChange: (s: Side) => void;
}) {
  return (
    <div className="grid grid-cols-3 rounded-md overflow-hidden border border-borderSubtle">
      {(["attack", "both", "defense"] as Side[]).map((s) => {
        const label = s === "attack" ? "Attack" : s === "defense" ? "Defense" : "All";
        return (
          <button
            key={s}
            onClick={() => onSideChange(s)}
            className={`min-h-[44px] text-xs font-bold transition-colors ${
              side === s ? "bg-accent text-white" : "bg-tile text-muted hover:text-textPrimary"
            }`}
            aria-pressed={side === s}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
