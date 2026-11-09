import type { Importance, Difficulty } from "../types/lineup";

function ImportanceIcon({ kind, active }: { kind: Importance; active?: boolean }) {
  const color = kind === "essential" ? "#22C55E" : kind === "optional" ? "#E8404F" : "#CBD5E1";
  if (kind === "essential") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth="1.6">
        <path d="M12 2l2.4 7.2H22l-6.3 4.6 2.4 7.2L12 16.6 5.9 21l2.4-7.2L2 9.2h7.6z" />
      </svg>
    );
  }
  if (kind === "useful") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 8 8" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth="1.6">
      <path d="M12 2l8 8-8 12-8-12z" />
    </svg>
  );
}

function DifficultyIcon({ kind, active }: { kind: Difficulty; active?: boolean }) {
  const color = kind === "easy" ? "#22C55E" : kind === "hard" ? "#E8404F" : "#EAB308";
  const dots = kind === "easy" ? 1 : kind === "normal" ? 2 : 3;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: i < dots ? color : "transparent", border: `1px solid ${i < dots ? color : "#475569"}`, opacity: active || i < dots ? 1 : 0.5 }}
        />
      ))}
    </span>
  );
}

export default function FiltersCardCollapsible({
  importance,
  difficulty,
  onToggleImportance,
  onToggleDifficulty,
  onReset,
}: {
  importance: Set<Importance>;
  difficulty: Set<Difficulty>;
  onToggleImportance: (v: Importance) => void;
  onToggleDifficulty: (v: Difficulty) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-card bg-panel border border-borderSubtle p-2">
        <p className="text-[10px] font-bold tracking-widest text-muted mb-1.5 text-center">IMPORTANCE</p>
        <div className="grid grid-cols-3 rounded-md overflow-hidden border border-borderSubtle">
          {(["essential", "useful", "optional"] as Importance[]).map((id) => {
            const sel = importance.has(id);
            return (
              <button
                key={id}
                onClick={() => onToggleImportance(id)}
                aria-pressed={sel}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 ${sel ? "bg-accent text-white" : "bg-tile text-muted hover:text-textPrimary"}`}
              >
                <ImportanceIcon kind={id} active={sel} />
                <span className="text-[9px] font-bold capitalize">{id}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-card bg-panel border border-borderSubtle p-2">
        <p className="text-[10px] font-bold tracking-widest text-muted mb-1.5 text-center">DIFFICULTY</p>
        <div className="grid grid-cols-3 rounded-md overflow-hidden border border-borderSubtle">
          {(["easy", "normal", "hard"] as Difficulty[]).map((id) => {
            const sel = difficulty.has(id);
            return (
              <button
                key={id}
                onClick={() => onToggleDifficulty(id)}
                aria-pressed={sel}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 ${sel ? "bg-accent text-white" : "bg-tile text-muted hover:text-textPrimary"}`}
              >
                <DifficultyIcon kind={id} active={sel} />
                <span className="text-[9px] font-bold capitalize">{id}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={onReset} className="text-xs text-accent underline min-h-[40px] self-center px-3">Reset filters</button>
    </div>
  );
}
