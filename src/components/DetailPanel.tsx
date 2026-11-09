import { useState, useEffect } from "react";
import type { Lineup } from "../types/lineup";
import ValImage from "./ValImage";

export default function DetailPanel({
  lineup,
  agent,
  onClose,
  onNext,
  onPrev,
}: {
  lineup: Lineup | null;
  agent: any;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  if (!lineup) return null;
  const ability = agent?.abilities?.find((a: any) => a.slot === lineup.abilitySlot);
  const images = [lineup.media.standImage, lineup.media.aimImage, lineup.media.landingImage].filter(Boolean) as string[];
  // carousel index
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [lineup.id]);
  // keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(images.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, images.length]);

  return (
    <div className="absolute inset-0 md:inset-auto md:right-0 md:top-0 md:w-[380px] md:h-full bg-panel border-l border-borderSubtle shadow-2xl z-40 flex flex-col">
      <div className="p-4 border-b border-borderSubtle flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-[18px] font-extrabold text-textPrimary leading-tight">{lineup.title}</h3>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <span className="px-2 py-1 rounded bg-tile border border-borderSubtle text-xs font-bold text-textPrimary">{lineup.side}</span>
            {lineup.site && <span className="px-2 py-1 rounded bg-tile border border-borderSubtle text-xs font-bold text-textPrimary">Site {lineup.site}</span>}
            <span className="px-2 py-1 rounded text-xs font-bold border" style={{ borderColor: lineup.importance === "essential" ? "#22C55E" : lineup.importance === "optional" ? "#E8404F" : "#EDEDED", color: lineup.importance === "essential" ? "#22C55E" : lineup.importance === "optional" ? "#E8404F" : "#EDEDED" }}>{lineup.importance}</span>
            <span className="px-2 py-1 rounded text-xs font-bold border border-borderSubtle text-muted">{lineup.difficulty}</span>
            {lineup.throwType && <span className="px-2 py-1 rounded bg-accent/20 border border-accent text-accent text-xs font-bold">{lineup.throwType}</span>}
          </div>
        </div>
        <button onClick={onClose} className="ml-3 w-9 h-9 rounded bg-tile hover:bg-tileHover flex items-center justify-center text-muted" aria-label="Close detail">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* ability header */}
        <div className="flex items-center gap-3 bg-tile rounded-md p-3 border border-borderSubtle">
          {ability?.displayIcon && <img src={ability.displayIcon} alt="" className="w-10 h-10 object-contain" style={{ filter: "invert(36%) sepia(80%) saturate(1800%) hue-rotate(325deg)" }} />}
          <div>
            <p className="text-sm font-bold text-textPrimary">{ability?.displayName ?? lineup.abilitySlot}</p>
            <p className="text-xs text-muted">{agent?.displayName ?? "Agent"} • {lineup.abilitySlot}</p>
          </div>
        </div>

        {/* images carousel */}
        <div>
          <p className="text-xs font-semibold text-muted mb-2">Preview ({images.length || "no images"})</p>
          {images.length > 0 ? (
            <div className="relative">
              <div className="rounded-md overflow-hidden bg-[#0E0E10] border border-borderSubtle aspect-[16/9] flex items-center justify-center">
                <img src={images[idx]} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
              </div>
              {images.length > 1 && (
                <div className="flex items-center justify-between mt-2">
                  <button onClick={() => setIdx((i) => Math.max(0, i - 1))} className="px-3 py-1.5 rounded bg-tile text-sm text-textPrimary min-h-[40px] disabled:opacity-40" disabled={idx === 0}>‹ Prev</button>
                  <span className="text-xs text-muted">{idx + 1} / {images.length}</span>
                  <button onClick={() => setIdx((i) => Math.min(images.length - 1, i + 1))} className="px-3 py-1.5 rounded bg-tile text-sm text-textPrimary min-h-[40px] disabled:opacity-40" disabled={idx === images.length - 1}>Next ›</button>
                </div>
              )}
              <div className="flex gap-2 mt-2 overflow-auto">
                {images.map((src, i) => (
                  <button key={i} onClick={() => setIdx(i)} className={`w-20 h-14 rounded overflow-hidden border-2 flex-shrink-0 ${i === idx ? "border-accent" : "border-transparent opacity-60"}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-tile border border-borderSubtle h-[160px] flex flex-col items-center justify-center text-muted">
              <span className="text-2xl">🖼️</span>
              <span className="text-sm mt-1">No preview images</span>
              <span className="text-xs text-muted mt-1">Stand / Aim / Landing placeholders</span>
            </div>
          )}
        </div>

        {lineup.notes && (
          <div className="rounded-md bg-tile border border-borderSubtle p-3">
            <p className="text-xs font-semibold text-muted mb-1">Notes</p>
            <p className="text-sm text-textPrimary leading-relaxed whitespace-pre-wrap">{lineup.notes}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-tile rounded p-2 border border-borderSubtle">
            <span className="text-muted">Start</span>
            <p className="font-mono text-textPrimary">{lineup.start.x.toFixed(3)}, {lineup.start.y.toFixed(3)}</p>
          </div>
          <div className="bg-tile rounded p-2 border border-borderSubtle">
            <span className="text-muted">End</span>
            <p className="font-mono text-textPrimary">{lineup.end.x.toFixed(3)}, {lineup.end.y.toFixed(3)}</p>
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-borderSubtle flex gap-2">
        <button onClick={onClose} className="flex-1 min-h-[44px] rounded bg-tile hover:bg-tileHover text-textPrimary font-semibold text-sm border border-borderSubtle">Close</button>
      </div>
    </div>
  );
}


