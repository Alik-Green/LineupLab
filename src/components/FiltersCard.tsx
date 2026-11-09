import type { Importance, Difficulty } from "../types/lineup";

export default function FiltersCard({
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
  const impOptions: { id: Importance; label: string; cls: string }[] = [
    { id: "essential", label: "Essential", cls: "essential" },
    { id: "useful", label: "Useful", cls: "useful" },
    { id: "optional", label: "Optional", cls: "optional" },
  ];
  const diffOptions: { id: Difficulty; label: string; cls: string }[] = [
    { id: "easy", label: "Easy", cls: "easy" },
    { id: "normal", label: "Normal", cls: "normal" },
    { id: "hard", label: "Hard", cls: "hard" },
  ];

  return (
    <div className="rounded-card bg-panel border border-borderSubtle p-3">
      <h3 className="text-sm font-semibold text-textPrimary">Filters</h3>

      <div className="mt-3">
        <p className="text-xs font-semibold text-muted mb-2">Importance</p>
        <div className="flex flex-wrap gap-2">
          {impOptions.map((o) => {
            const selected = importance.has(o.id);
            return (
              <button
                key={o.id}
                onClick={() => onToggleImportance(o.id)}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 min-h-[40px] transition-colors ${
                  selected
                    ? o.id === "essential"
                      ? "bg-essential/20 border-essential text-essential"
                      : o.id === "optional"
                        ? "bg-accent/20 border-accent text-accent"
                        : "bg-white/10 border-white text-white"
                    : "bg-transparent border-borderSubtle text-muted opacity-60"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-muted mb-2">Difficulty</p>
        <div className="flex flex-wrap gap-2">
          {diffOptions.map((o) => {
            const selected = difficulty.has(o.id);
            return (
              <button
                key={o.id}
                onClick={() => onToggleDifficulty(o.id)}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 min-h-[40px] transition-colors ${
                  selected
                    ? o.id === "easy"
                      ? "bg-essential/20 border-essential text-essential"
                      : o.id === "hard"
                        ? "bg-accent/20 border-accent text-accent"
                        : "bg-[#EAB308]/20 border-[#EAB308] text-[#EAB308]"
                    : "bg-transparent border-borderSubtle text-muted opacity-60"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onReset}
        className="mt-4 text-xs text-accent hover:text-accentHover underline underline-offset-2"
      >
        Reset filters
      </button>
    </div>
  );
}
