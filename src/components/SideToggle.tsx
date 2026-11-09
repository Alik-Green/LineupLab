import type { Side } from "../types/lineup";

export default function SideToggle({
  side,
  onSideChange,
}: {
  side: Side;
  onSideChange: (s: Side) => void;
}) {
  return (
    <div className="grid grid-cols-2 rounded-md overflow-hidden border border-borderSubtle">
      <button
        onClick={() => onSideChange("attack")}
        className={`min-h-[44px] text-xs font-bold transition-colors ${
          side === "attack" ? "bg-accent text-white" : "bg-tile text-muted hover:text-textPrimary"
        }`}
        aria-pressed={side === "attack"}
      >
        Attack
      </button>
      <button
        onClick={() => onSideChange("defense")}
        className={`min-h-[44px] text-xs font-bold transition-colors ${
          side === "defense" ? "bg-accent text-white" : "bg-tile text-muted hover:text-textPrimary"
        }`}
        aria-pressed={side === "defense"}
      >
        Defense
      </button>
    </div>
  );
}
