import { useState } from "react";
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
    <>
      <div className="rounded-card bg-panel border border-borderSubtle overflow-hidden flex-1 flex flex-col">
        <button
          onClick={() => setOpen(true)}
          className="relative w-full aspect-square overflow-hidden text-left group min-h-[88px] bg-black"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Select agent"
        >
          {selectedAgent ? (
            <>
              <img
                src={selectedAgent.displayIcon}
                alt={selectedAgent.displayName}
                className="absolute inset-0 w-full h-full object-cover object-center"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <div className="text-white font-extrabold text-[13px] leading-none truncate text-center">{selectedAgent.displayName}</div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 bg-tile flex items-center justify-center text-muted text-xs">Select agent</div>
          )}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-panel border border-borderSubtle rounded-card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-borderSubtle flex items-center justify-between shrink-0">
              <h3 className="text-textPrimary font-bold">Select agent</h3>
              <button onClick={() => setOpen(false)} className="w-10 h-10 rounded bg-tile hover:bg-tileHover flex items-center justify-center text-muted">✕</button>
            </div>
            <div className="p-3 overflow-auto thin-scrollbar flex-1">
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {sorted.map((ag) => (
                  <button
                    key={ag.uuid}
                    onClick={() => {
                      onSelect(ag.uuid);
                      setOpen(false);
                    }}
                    className={`relative rounded-md overflow-hidden aspect-square bg-black border-2 ${selectedAgent?.uuid === ag.uuid ? "border-accent" : "border-transparent hover:border-borderSubtle"}`}
                    title={ag.displayName}
                  >
                    <img
                      src={ag.displayIcon}
                      alt={ag.displayName}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                    <span className="absolute bottom-0 left-0 right-0 text-white text-[11px] font-bold text-center leading-3 py-1.5 truncate px-1">{ag.displayName}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
