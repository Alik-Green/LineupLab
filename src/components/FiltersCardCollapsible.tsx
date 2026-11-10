import type { Importance, Difficulty } from "../types/lineup";

function StarsIcon({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5 items-center justify-center">
      {Array.from({ length: 3 }).map((_, i) => {
        const filled = i < count;
        return (
          <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.4} className={filled ? "text-accent" : "text-muted/50"}>
            <path d="M12 2l2.4 7.2H22l-6.3 4.6 2.4 7.2L12 16.6 5.9 21l2.4-7.2L2 9.2h7.6z" />
          </svg>
        );
      })}
    </span>
  );
}

function DifficultyIcon({ kind }: { kind: Difficulty }) {
  const color = kind === "easy" ? "#22C55E" : kind === "hard" ? "#E8404F" : "#EAB308";
  const dots = kind === "easy" ? 1 : kind === "normal" ? 2 : 3;
  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} className="w-3 h-3 rounded-full" style={{ background: i < dots ? color : "transparent", border: `2px solid ${i < dots ? color : "#475569"}` }} />
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
        <div className="grid grid-cols-3 gap-1.5">
          {(["optional", "useful", "essential"] as Importance[]).map((id) => {
            const sel = importance.has(id);
            const stars = id === "essential" ? 3 : id === "useful" ? 2 : 1;
            return (
              <button key={id} onClick={() => onToggleImportance(id)} aria-pressed={sel} title={id} className={`h-[48px] rounded-md border flex items-center justify-center transition-all ${sel ? "border-accent" : "border-borderSubtle bg-tile opacity-60 hover:opacity-100"}`}>
                <StarsIcon count={stars} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-card bg-panel border border-borderSubtle p-2">
        <p className="text-[10px] font-bold tracking-widest text-muted mb-1.5 text-center">DIFFICULTY</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["easy", "normal", "hard"] as Difficulty[]).map((id) => {
            const sel = difficulty.has(id);
            return (
              <button key={id} onClick={() => onToggleDifficulty(id)} aria-pressed={sel} title={id} className={`h-[48px] rounded-md border flex items-center justify-center transition-all ${sel ? "border-accent" : "border-borderSubtle bg-tile opacity-60 hover:opacity-100"}`}>
                <DifficultyIcon kind={id} />
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={onReset} className="text-xs text-accent underline min-h-[40px] self-center px-3">Reset filters</button>
    </div>
  );
}
