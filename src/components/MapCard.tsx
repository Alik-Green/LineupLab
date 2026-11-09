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
          className="relative w-full aspect-square overflow-hidden text-left group min-h-[88px] bg-[#121212] flex flex-col items-center justify-center p-2"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Select map"
        >
          {selectedMap ? (
            <>
              <img
                src={selectedMap.listViewIcon ?? selectedMap.splash}
                alt={selectedMap.displayName}
                className="w-full h-full object-contain p-1"
                draggable={false}
                onError={(e) => ((e.target as HTMLImageElement).src = selectedMap.splash)}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6">
                <div className="text-white font-extrabold text-sm leading-none drop-shadow truncate text-center">{selectedMap.displayName}</div>
                <div className="text-white/60 text-[10px] mt-0.5 text-center">Tap to change</div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-xs">Select map</div>
          )}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-panel border border-borderSubtle rounded-card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-borderSubtle flex items-center justify-between shrink-0">
              <h3 className="text-textPrimary font-bold">Select map</h3>
              <button onClick={() => setOpen(false)} className="w-10 h-10 rounded bg-tile hover:bg-tileHover flex items-center justify-center text-muted">✕</button>
            </div>
            <div className="p-3 overflow-auto thin-scrollbar flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {maps.map((m) => (
                  <button
                    key={m.uuid}
                    onClick={() => {
                      onSelect(m.uuid);
                      setOpen(false);
                    }}
                    className={`relative h-[110px] rounded-md overflow-hidden border-2 text-left bg-[#121212] flex flex-col items-center justify-center p-2 ${selectedMap?.uuid === m.uuid ? "border-accent" : "border-transparent hover:border-borderSubtle"}`}
                  >
                    <img
                      src={m.listViewIcon ?? m.splash}
                      alt={m.displayName}
                      className="max-w-full max-h-[70px] object-contain"
                      draggable={false}
                    />
                    <span className="mt-1 text-white text-xs font-bold drop-shadow text-center truncate w-full">{m.displayName}</span>
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
