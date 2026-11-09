import { useState } from "react";
import ValImage from "./ValImage";
import type { ValorantAgent } from "../types/lineup";

export default function AgentCard({
  agents,
  selectedAgent,
  onSelect,
}: {
  agents: ValorantAgent[];
  selectedAgent: ValorantAgent | null | undefined;
  onSelect: (uuid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sorted = [...agents].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div className="rounded-card bg-panel border border-borderSubtle overflow-hidden flex-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-full h-[68px] overflow-hidden text-left flex items-center gap-2 px-2 bg-tile hover:bg-tileHover"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Select agent"
      >
        {selectedAgent ? (
          <>
            <div className="w-10 h-10 rounded-md overflow-hidden bg-[#1B1B1F] border border-borderSubtle shrink-0">
              <ValImage src={selectedAgent.displayIconSmall ?? selectedAgent.displayIcon} alt={selectedAgent.displayName} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-xs leading-none truncate">{selectedAgent.displayName}</div>
              <div className="text-white/60 text-[10px] mt-0.5">{selectedAgent.role?.displayName ?? "Agent"}</div>
            </div>
          </>
        ) : (
          <div className="flex-1 text-muted text-xs">Select agent</div>
        )}
        <span className="w-8 h-8 rounded bg-black/40 flex items-center justify-center text-white border border-white/10 text-xs shrink-0">
          ▾
        </span>
      </button>

      {open && (
        <div className="p-2 bg-panel border-t border-borderSubtle max-h-[320px] overflow-auto thin-scrollbar">
          <div className="grid grid-cols-4 gap-1.5">
            {sorted.map((ag) => (
              <button
                key={ag.uuid}
                onClick={() => {
                  onSelect(ag.uuid);
                  setOpen(false);
                }}
                className={`relative rounded-md overflow-hidden h-[52px] bg-tile border-2 flex flex-col items-center justify-end ${selectedAgent?.uuid === ag.uuid ? "border-accent bg-accent/20" : "border-transparent hover:border-borderSubtle"}`}
                title={ag.displayName}
              >
                <ValImage src={ag.displayIcon} alt={ag.displayName} className="absolute inset-0 object-cover" />
                <span className="relative z-10 w-full bg-black/70 text-white text-[8px] font-semibold text-center leading-3 py-0.5 truncate px-1">{ag.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
