import { useState } from "react";
import ValImage from "./ValImage";
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
          className="relative w-full aspect-square overflow-hidden text-left group min-h-[88px]"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Select map"
        >
          {selectedMap ? (
            <>
              <ValImage
                src={selectedMap.listViewIcon ?? selectedMap.splash}
                alt={selectedMap.displayName}
                className="absolute inset-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <div className="text-white font-extrabold text-sm leading-none drop-shadow truncate">{selectedMap.displayName}</div>
                <div className="text-white/60 text-[10px] mt-0.5">Tap to change</div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 bg-tile flex items-center justify-center text-muted text-xs">Select map</div>
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
                    className={`relative h-[110px] rounded-md overflow-hidden border-2 text-left ${selectedMap?.uuid === m.uuid ? "border-accent" : "border-transparent hover:border-borderSubtle"}`}
                  >
                    <ValImage src={m.splash} alt={m.displayName} className="absolute inset-0" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <span className="absolute bottom-1.5 left-2 text-white text-xs font-bold drop-shadow">{m.displayName}</span>
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
