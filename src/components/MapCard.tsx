import { useState } from "react";
import type { ValorantMap } from "../types/lineup";

export default function MapCard({
  maps,
  selectedMap,
  onSelect,
}: {
  maps: ValorantMap[];
  selectedMap: ValorantMap | null | undefined;
  onSelect: (uuid: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-card bg-panel border border-borderSubtle overflow-hidden flex-1 flex flex-col">
        <button
          onClick={() => setOpen(true)}
          className="relative w-full aspect-square overflow-hidden text-left group min-h-[88px] bg-black"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Select map"
        >
          {selectedMap ? (
            <>
              <img
                src={selectedMap.splash}
                alt={selectedMap.displayName}
                className="absolute inset-0 w-full h-full object-cover object-center scale-[1.45]"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <div className="text-white font-extrabold text-[13px] leading-none drop-shadow truncate text-center">{selectedMap.displayName}</div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 bg-tile flex items-center justify-center text-muted text-xs">Select map</div>
          )}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-[#1B1B1F] border border-borderSubtle rounded-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-borderSubtle flex items-center justify-between shrink-0 bg-[#1B1B1F]">
              <h3 className="text-white font-bold text-lg">Select map</h3>
              <button onClick={() => setOpen(false)} className="w-10 h-10 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">✕</button>
            </div>
            <div className="p-4 overflow-auto thin-scrollbar flex-1 bg-[#0F0F10]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {maps.map((m) => (
                  <button
                    key={m.uuid}
                    onClick={() => {
                      onSelect(m.uuid);
                      setOpen(false);
                    }}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 text-left group ${selectedMap?.uuid === m.uuid ? "border-accent" : "border-white/10 hover:border-white/30"}`}
                  >
                    <img src={m.splash} alt={m.displayName} className="absolute inset-0 w-full h-full object-cover object-center scale-[1.35]" draggable={false} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <span className="absolute bottom-0 left-0 right-0 p-3 text-white text-[13px] font-bold drop-shadow truncate text-center">{m.displayName}</span>
                    {selectedMap?.uuid === m.uuid && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-xs">✓</span>}
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
