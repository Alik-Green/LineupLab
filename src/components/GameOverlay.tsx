import { useState, useEffect } from "react";
import type { Lineup } from "../types/lineup";
import AnnotatedImage from "./AnnotatedImage";

type Mode = "normal" | "minimal";

export default function GameOverlay({ lineup, images, onClose, onPrev, onNext, idx, total }: {
  lineup: Lineup | null;
  images: { src: string; circles?: any[]; slot?: string; throwInfo?: any }[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  idx: number;
  total: number;
}) {
  const [mode, setMode] = useState<Mode>("normal");
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "m") { e.preventDefault(); setMode(m => m==="normal" ? "minimal" : "normal"); }
      if (k === "h") { e.preventDefault(); setShowHelp(v=>!v); }
      if (k === "q" || e.code==="KeyQ") { e.preventDefault(); onPrev?.(); }
      if (k === "e" || e.code==="KeyE") { e.preventDefault(); onNext?.(); }
      if (k === "x" || e.code==="KeyX") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPrev, onNext, onClose]);

  if (!lineup || images.length===0) return null;
  const cur = images[idx];

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex flex-col" onClick={onClose}>
      <div className="flex-1 relative flex items-center justify-center p-4" onClick={e=>e.stopPropagation()}>
        <div className="relative w-full h-full max-w-[90vw] max-h-[85vh] flex items-center justify-center">
          <AnnotatedImage src={cur.src} circles={cur.circles} />
          {mode==="normal" && cur.throwInfo && (
            <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded border border-white/20">
              {cur.throwInfo.type ?? cur.slot ?? "Throw"} {cur.throwInfo.timing ? `• ${cur.throwInfo.timing}` : ""}
            </div>
          )}
          {mode==="normal" && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full border border-white/20">
              {lineup.title} — {cur.slot ?? `Image ${idx+1}/${total}`}
            </div>
          )}
        </div>

        {mode==="normal" && showHelp && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-panel border border-borderSubtle rounded-card px-4 py-3 shadow-xl max-w-[90vw]">
            <div className="flex gap-4 text-xs">
              <div className="space-y-1">
                <div><b className="text-accent">Alt+1</b> Stand</div>
                <div><b className="text-accent">Alt+2</b> Aim 1</div>
                <div><b className="text-accent">Alt+3</b> Land</div>
                <div><b className="text-accent">Alt+P</b> Capture</div>
              </div>
              <div className="w-px bg-borderSubtle" />
              <div className="space-y-1">
                <div><b>Alt+Q</b> Prev</div>
                <div><b>Alt+E</b> Next</div>
                <div><b>Alt+M</b> {mode==="normal"?"Minimal":"Normal"}</div>
                <div><b>Alt+H</b> Toggle help</div>
                <div><b>Alt+X</b> Close</div>
              </div>
            </div>
            <div className="text-[10px] text-muted mt-2 text-center">
              {mode} mode • {idx+1}/{total} • Press <b>Alt+M</b> for minimal (image only)
            </div>
          </div>
        )}

        <button onClick={onClose} className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center">✕</button>
        <button onClick={onPrev} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center disabled:opacity-30" disabled={idx===0}>‹</button>
        <button onClick={onNext} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center disabled:opacity-30" disabled={idx===total-1}>›</button>
      </div>

      {mode==="normal" && (
        <div className="shrink-0 bg-panel border-t border-borderSubtle p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-bold bg-accent text-white`}>Normal</span>
            <span className={`px-2 py-1 rounded text-xs font-bold bg-tile text-muted`}>Minimal</span>
            <button onClick={()=>setMode(m=>m==="normal"?"minimal":"normal")} className="ml-2 px-3 py-1 rounded bg-tile border border-borderSubtle text-xs text-textPrimary">Toggle Alt+M</button>
          </div>
          <div className="text-xs text-muted hidden sm:block">Use Alt+Q/E to cycle images • Alt+X to close • Ideal for second monitor / overlay</div>
          <button onClick={()=>setShowHelp(v=>!v)} className="px-3 py-1 rounded bg-tile border border-borderSubtle text-xs text-textPrimary">Alt+H Help</button>
        </div>
      )}
    </div>
  );
}
