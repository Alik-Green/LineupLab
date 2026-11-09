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
    <div className="rounded-card bg-panel border border-borderSubtle overflow-hidden">
      {/* banner */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-full h-[140px] overflow-hidden text-left group"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Select map"
      >
        {selectedMap ? (
          <>
            <ValImage
              src={selectedMap.splash}
              alt={selectedMap.displayName}
              className="absolute inset-0"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
            <div className="absolute bottom-3 left-4 right-10">
              <h2 className="text-white font-extrabold text-[22px] leading-none drop-shadow-lg">
                {selectedMap.displayName}
              </h2>
              <p className="text-white/70 text-xs mt-1">Tap to change map</p>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-tile flex items-center justify-center text-muted">Select map</div>
        )}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 min-w-[40px] min-h-[40px] rounded bg-black/40 flex items-center justify-center text-white border border-white/10">
          ▾
        </span>
      </button>

      {/* dropdown grid */}
      {open && (
        <div className="p-3 bg-panel border-t border-borderSubtle max-h-[340px] overflow-auto">
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
          <button
            onClick={() => setOpen(false)}
            className="mt-3 w-full min-h-[40px] rounded bg-tile text-muted text-sm"
          >
            Close
          </button>
        </div>
      )}

      {/* Attack / Defense toggle */}
      <div className="p-2 bg-panel">
        <div className="grid grid-cols-2 rounded-md overflow-hidden border border-borderSubtle">
          <button
            onClick={() => onSideChange("attack")}
            className={`min-h-[44px] text-sm font-bold transition-colors ${
              side === "attack" ? "bg-accent text-white" : "bg-tile text-muted hover:text-textPrimary"
            }`}
            aria-pressed={side === "attack"}
          >
            Attack
          </button>
          <button
            onClick={() => onSideChange("defense")}
            className={`min-h-[44px] text-sm font-bold transition-colors ${
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
