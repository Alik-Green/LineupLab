import { useState, useEffect } from "react";
import type { Lineup } from "../types/lineup";
import AnnotatedImage from "./AnnotatedImage";
import { useMediaResolver } from "../hooks/useMediaResolver";
import { getMediaUrl } from "../lib/indexedDBRepository";

export default function DetailPanel({
  lineup,
  agent,
  onClose,
}: {
  lineup: Lineup | null;
  agent: any;
  onClose: () => void;
}) {
  if (!lineup) return null;
  const ability = agent?.abilities?.find((a: any) => a.slot === lineup.abilitySlot);

  // Collect all raw image refs
  const rawSlotImages = [
    lineup.slots?.stand1 ?? lineup.media.standImage,
    lineup.slots?.aim1 ?? lineup.media.aimImage,
    lineup.slots?.stand2,
    lineup.slots?.aim2,
    lineup.slots?.landing ?? lineup.media.landingImage,
  ].filter(Boolean) as string[];
  const rawStepImages = (lineup.steps ?? []).map((s) => s.image).filter(Boolean) as string[];
  const rawImages = [...rawSlotImages, ...rawStepImages];

  const resolvedImages = useMediaResolver(rawImages);

  // Fallback: also try to resolve via lineupId media lookup for any that didn't resolve
  const [fallbackMap, setFallbackMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!lineup?.id) return;
    (async () => {
      const map: Record<string, string> = {};
      for (const src of rawImages) {
        if (!src) continue;
        if (src.startsWith("http") || src.startsWith("blob:") || src.startsWith("data:")) continue;
        // if already resolved to blob, skip
        const alreadyBlob = resolvedImages.some((r) => r === src && r.startsWith("blob:"));
        if (alreadyBlob) continue;
        try {
          const url = await getMediaUrl(src);
          if (url) map[src] = url;
          else {
            const short = src.split("/").pop()!;
            const url2 = await getMediaUrl(short);
            if (url2) map[src] = url2;
          }
        } catch {}
      }
      if (Object.keys(map).length) setFallbackMap(map);
    })();
  }, [lineup.id, JSON.stringify(rawImages)]);

  // Build final display images: use resolved blob URLs where available, else fallbackMap, else original
  const images = rawImages.map((src, i) => {
    const r = resolvedImages[i];
    if (r && (r.startsWith("blob:") || r.startsWith("http") || r.startsWith("data:"))) return r;
    if (fallbackMap[src]) return fallbackMap[src];
    return src;
  });

  const circlesForIdx = (idx: number) => {
    if (lineup.steps && lineup.steps[idx - rawSlotImages.length]?.circles) {
      return lineup.steps[idx - rawSlotImages.length].circles;
    }
    if (idx === 0 && lineup.circles) return lineup.circles;
    return undefined;
  };

  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [lineup.id]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(images.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, images.length]);

  const currentCircles = circlesForIdx(idx) as any;

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-panel border border-borderSubtle rounded-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-borderSubtle flex items-start justify-between shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-[20px] font-extrabold text-textPrimary leading-tight">{lineup.title}</h3>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <span className="px-2 py-1 rounded bg-tile border border-borderSubtle text-xs font-bold text-textPrimary">{lineup.side}</span>
              {lineup.site && <span className="px-2 py-1 rounded bg-tile border border-borderSubtle text-xs font-bold text-textPrimary">Site {lineup.site}</span>}
              <span className="px-2 py-1 rounded text-xs font-bold border" style={{ borderColor: lineup.importance === "essential" ? "#22C55E" : lineup.importance === "optional" ? "#E8404F" : "#EDEDED", color: lineup.importance === "essential" ? "#22C55E" : lineup.importance === "optional" ? "#E8404F" : "#EDEDED" }}>{lineup.importance}</span>
              <span className="px-2 py-1 rounded text-xs font-bold border border-borderSubtle text-muted">{lineup.difficulty}</span>
              {lineup.throwType && <span className="px-2 py-1 rounded bg-accent/20 border border-accent text-accent text-xs font-bold">{lineup.throwType}</span>}
              {lineup.status && lineup.status !== "ok" && <span className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500 text-amber-500 text-xs font-bold">{lineup.status}</span>}
            </div>
          </div>
          <button onClick={onClose} className="ml-3 w-10 h-10 min-w-[40px] min-h-[40px] rounded bg-tile hover:bg-tileHover flex items-center justify-center text-muted" aria-label="Close detail">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto overscroll-contain p-4 space-y-4 min-h-0 thin-scrollbar">
          <div className="flex items-center gap-3 bg-tile rounded-md p-3 border border-borderSubtle">
            {ability?.displayIcon && <img src={ability.displayIcon} alt="" className="w-10 h-10 object-contain" style={{ filter: "invert(36%) sepia(80%) saturate(1800%) hue-rotate(325deg)" }} />}
            <div>
              <p className="text-sm font-bold text-textPrimary">{ability?.displayName ?? lineup.abilitySlot}</p>
              <p className="text-xs text-muted">{agent?.displayName ?? "Agent"} • {lineup.abilitySlot}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted mb-2">Preview ({images.length || "no images"})</p>
            {images.length > 0 ? (
              <div className="relative">
                <AnnotatedImage src={images[idx]!} circles={currentCircles} />
                {images.length > 1 && (
                  <div className="flex items-center justify-between mt-2">
                    <button onClick={() => setIdx((i) => Math.max(0, i - 1))} className="px-3 py-1.5 rounded bg-tile text-sm text-textPrimary min-h-[40px] disabled:opacity-40" disabled={idx === 0}>‹ Prev</button>
                    <span className="text-xs text-muted">{idx + 1} / {images.length}</span>
                    <button onClick={() => setIdx((i) => Math.min(images.length - 1, i + 1))} className="px-3 py-1.5 rounded bg-tile text-sm text-textPrimary min-h-[40px] disabled:opacity-40" disabled={idx === images.length - 1}>Next ›</button>
                  </div>
                )}
                <div className="flex gap-2 mt-2 overflow-auto overscroll-contain">
                  {images.map((src, i) => (
                    <button key={i} onClick={() => setIdx(i)} className={`w-20 h-14 rounded overflow-hidden border-2 flex-shrink-0 ${i === idx ? "border-accent" : "border-transparent opacity-60"}`}>
                      <img src={src} alt="" className="w-full h-full object-cover" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display="none"}} />
                    </button>
                  ))}
                </div>
                {lineup.circles && lineup.circles.length > 0 && (
                  <p className="text-xs text-muted mt-2">{lineup.circles.length} annotation{lineup.circles.length>1?'s':''} • hover image for zoom lens (no lens under 200px)</p>
                )}
              </div>
            ) : (
              <div className="rounded-md bg-tile border border-borderSubtle h-[160px] flex flex-col items-center justify-center text-muted">
                <span className="text-2xl">🖼️</span>
                <span className="text-sm mt-1">No preview images</span>
                <span className="text-xs text-muted mt-1">Stand / Aim / Landing placeholders</span>
              </div>
            )}
          </div>

          {lineup.throws && lineup.throws.length > 0 && (
            <div className="rounded-md bg-tile border border-borderSubtle p-3">
              <p className="text-xs font-semibold text-muted mb-1">Throws</p>
              <div className="flex flex-wrap gap-1">
                {lineup.throws.map((t,i)=> <span key={i} className="px-2 py-1 bg-panel border border-borderSubtle rounded text-xs text-textPrimary">{t.type ?? `Throw ${i+1}`}{t.note?` • ${t.note}`:''}</span>)}
              </div>
            </div>
          )}

          {lineup.steps && lineup.steps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted">Steps</p>
              {lineup.steps.map((s,i)=> (
                <div key={i} className="rounded-md bg-tile border border-borderSubtle p-3">
                  <p className="text-sm font-semibold text-textPrimary">{s.title ?? `Step ${i+1}`}</p>
                  {s.description && <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{s.description}</p>}
                  {s.circles && s.circles.length>0 && <p className="text-xs text-muted mt-1">{s.circles.length} pin{ s.circles.length>1?'s':''}</p>}
                </div>
              ))}
            </div>
          )}

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
          {lineup.importBatchId && <p className="text-xs text-muted">Batch: {lineup.importBatchId}</p>}
        </div>

        <div className="p-3 border-t border-borderSubtle flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 min-h-[44px] rounded bg-accent hover:bg-accentHover text-white font-semibold text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
