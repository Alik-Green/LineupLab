import { useState } from "react";
import ValImage from "./ValImage";
import type { ValorantMap, Side } from "../types/lineup";

export default function MapCard({
  maps,
  selectedMap,
  onSelect,
  side,
  onSideChange,
}: {
  maps: ValorantMap[];
  selectedMap: ValorantMap | null | undefined;
  onSelect: (uuid: string) => void;
  side: Side;
  onSideChange: (s: Side) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-card bg-panel border border-borderSubtle overflow-hidden flex-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-full h-[68px] overflow-hidden text-left flex items-center gap-2 px-2 bg-tile hover:bg-tileHover"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Select map"
      >
        {selectedMap ? (
          <>
            <div className="w-10 h-10 rounded-md overflow-hidden bg-[#1B1B1F] border border-borderSubtle shrink-0">
              <ValImage
                src={selectedMap.listViewIcon ?? selectedMap.splash}
                alt={selectedMap.displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-xs leading-none truncate">{selectedMap.displayName}</div>
              <div className="text-white/60 text-[10px] mt-0.5">Tap to change</div>
            </div>
          </>
        ) : (
          <div className="flex-1 text-muted text-xs">Select map</div>
        )}
        <span className="w-8 h-8 rounded bg-black/40 flex items-center justify-center text-white border border-white/10 text-xs shrink-0">
          ▾
        </span>
      </button>

      {open && (
        <div className="p-2 bg-panel border-t border-borderSubtle max-h-[320px] overflow-auto thin-scrollbar">
          <div className="grid grid-cols-2 gap-2">
            {maps.map((m) => (
              <button
                key={m.uuid}
                onClick={() => {
                  onSelect(m.uuid);
                  setOpen(false);
                }}
                className={`relative h-[84px] rounded-md overflow-hidden border-2 text-left group ${
                  selectedMap?.uuid === m.uuid ? "border-accent" : "border-transparent hover:border-borderSubtle"
                }`}
              >
                <ValImage src={m.splash} alt={m.displayName} className="absolute inset-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute bottom-1.5 left-2 text-white text-xs font-bold drop-shadow">{m.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-2 bg-panel">
        <div className="grid grid-cols-2 rounded-md overflow-hidden border border-borderSubtle">
          <button
            onClick={() => onSideChange("attack")}
            className={`min-h-[36px] text-xs font-bold transition-colors ${
              side === "attack" ? "bg-accent text-white" : "bg-tile text-muted hover:text-textPrimary"
            }`}
            aria-pressed={side === "attack"}
          >
            Attack
          </button>
          <button
            onClick={() => onSideChange("defense")}
            className={`min-h-[36px] text-xs font-bold transition-colors ${
              side === "defense" ? "bg-accent text-white" : "bg-tile text-muted hover:text-textPrimary"
            }`}
            aria-pressed={side === "defense"}
          >
            Defense
          </button>
        </div>
      </div>
    </div>
  );
}
