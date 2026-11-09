import { useState } from "react";
import type { Importance, Difficulty } from "../types/lineup";

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
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-card bg-panel border border-borderSubtle flex flex-col min-h-0 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between p-2 shrink-0 min-h-[40px]">
        <h3 className="text-xs font-semibold text-textPrimary">Filters</h3>
        <span className="text-muted text-xs">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-2 pb-2 overflow-auto overscroll-contain thin-scrollbar flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-semibold text-muted mb-1">Importance</p>
              <div className="flex flex-col gap-1">
                {(["essential", "useful", "optional"] as Importance[]).map((id) => {
                  const sel = importance.has(id);
                  return (
                    <button key={id} onClick={() => onToggleImportance(id)} aria-pressed={sel} className={`h-8 min-h-[40px] md:min-h-[32px] px-2 rounded-md text-[11px] font-bold border flex items-center justify-center ${sel ? (id === "essential" ? "bg-essential/20 border-essential text-essential" : id === "optional" ? "bg-accent/20 border-accent text-accent" : "bg-white/10 border-white text-white") : "border-borderSubtle text-muted opacity-60"} `}>
                      {id}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted mb-1">Difficulty</p>
              <div className="flex flex-col gap-1">
                {(["easy", "normal", "hard"] as Difficulty[]).map((id) => {
                  const sel = difficulty.has(id);
                  return (
                    <button key={id} onClick={() => onToggleDifficulty(id)} aria-pressed={sel} className={`h-8 min-h-[40px] md:min-h-[32px] px-2 rounded-md text-[11px] font-bold border flex items-center justify-center ${sel ? (id === "easy" ? "bg-essential/20 border-essential text-essential" : id === "hard" ? "bg-accent/20 border-accent text-accent" : "bg-[#EAB308]/20 border-[#EAB308] text-[#EAB308]") : "border-borderSubtle text-muted opacity-60"}`}>
                      {id}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <button onClick={onReset} className="mt-2 text-xs text-accent underline min-h-[40px]">Reset filters</button>
        </div>
      )}
    </div>
  );
}
