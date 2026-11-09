import { useState, useEffect, useMemo } from "react";
import type { Lineup } from "../types/lineup";
import AnnotatedImage from "./AnnotatedImage";
import { useMediaResolver } from "../hooks/useMediaResolver";

type ImageEntry = { src: string; circles: any[] };

function buildImageEntries(lineup: Lineup): ImageEntry[] {
  const entries: ImageEntry[] = [];
  const slotKeys: Array<{ key: string; fallback?: string }> = [
    { key: "stand1", fallback: "standImage" },
    { key: "aim1", fallback: "aimImage" },
    { key: "stand2" },
    { key: "aim2" },
    { key: "landing", fallback: "landingImage" },
  ];
  const slotCirclesMap: Record<string, any[]> =
    (lineup as any).slotCircles ??
    lineup.attributes?.slotCircles ??
    (lineup.legacy?.raw?.attributes?.slotCircles) ??
    {};
  const attrProjectiles: any[] =
    lineup.attributes?.projectiles ??
    (lineup.legacy?.raw?.attributes?.projectiles) ??
    (lineup.legacy?.raw?.projectiles) ??
    [];
  for (const { key, fallback } of slotKeys) {
    const src = (lineup.slots as any)?.[key] ?? (fallback ? (lineup.media as any)?.[fallback] : undefined);
    if (!src) continue;
    const circles = (slotCirclesMap as any)[key] ?? [];
    entries.push({ src, circles: [...circles] });
  }
  if (Array.isArray(attrProjectiles)) {
    for (const p of attrProjectiles) {
      const pCircles = p.focusCircles ?? p.circles ?? [];
      const pImages: string[] = [];
      if (p.standImage) pImages.push(p.standImage);
      if (p.aimImage) pImages.push(p.aimImage);
      if (p.landingImage) pImages.push(p.landingImage);
      if (p.stand1) pImages.push(p.stand1);
      if (p.aim1) pImages.push(p.aim1);
      if (p.stand2) pImages.push(p.stand2);
      if (p.aim2) pImages.push(p.aim2);
      if (Array.isArray(p.images)) pImages.push(...p.images.filter((x: any) => typeof x === "string"));
      if (p.media && typeof p.media === "object") {
        for (const v of Object.values(p.media)) if (typeof v === "string") pImages.push(v);
      }
      for (const imgSrc of pImages) {
        if (!imgSrc) continue;
        entries.push({ src: imgSrc, circles: [...(pCircles ?? [])] });
      }
    }
  }
  for (const step of lineup.steps ?? []) {
    if (step.image) entries.push({ src: step.image, circles: [...(step.circles ?? [])] });
  }
  if (entries.length === 0 && lineup.media) {
    const fallbackMedia = [lineup.media.standImage, lineup.media.aimImage, lineup.media.landingImage].filter(Boolean) as string[];
    for (const src of fallbackMedia) entries.push({ src, circles: [] });
  }
  const dedup = new Map<string, ImageEntry>();
  for (const e of entries) {
    const norm = e.src.toLowerCase();
    const existing = dedup.get(norm);
    if (existing) {
      const byId = new Map(existing.circles.map((c: any) => c.id ?? `${c.x}-${c.y}`));
      for (const c of e.circles) {
        const id = (c as any).id ?? `${(c as any).x}-${(c as any).y}`;
        if (!byId.has(id)) existing.circles.push(c);
      }
    } else {
      dedup.set(norm, { src: e.src, circles: [...e.circles] });
    }
  }
  return Array.from(dedup.values());
}

export default function DetailPanel({
  lineup,
  agent,
  onClose,
  onDelete,
  onEdit,
}: {
  lineup: Lineup | null;
  agent: any;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  if (!lineup) return null;
  if (!lineup.start || !lineup.end) {
    return (
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-panel border border-borderSubtle rounded-card w-full max-w-4xl p-6 text-center" onClick={(e)=>e.stopPropagation()}>
          <p className="text-textPrimary font-bold">Lineup data incomplete</p><p className="text-muted text-sm mt-1">Missing coordinates — reimport from pack.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded bg-accent text-white font-bold min-h-[44px]">Close</button>
        </div>
      </div>
    );
  }

  const imageEntries = useMemo(() => {
    try { return buildImageEntries(lineup); }
    catch (e) { console.error("DetailPanel buildImageEntries", e); return []; }
  }, [lineup]);
  const rawSources = useMemo(() => imageEntries.map((e) => e.src), [imageEntries]);
  let resolved: (string | undefined)[] = rawSources as (string | undefined)[];
  try {
    const r = useMediaResolver(rawSources as (string|undefined)[]);
    if (r) resolved = r;
  } catch (e) { console.error("useMediaResolver", e); }

  const images = useMemo(() => {
    return imageEntries.map((e, i) => ({
      src: resolved[i] ?? e.src,
      circles: e.circles,
    }));
  }, [imageEntries, resolved]);

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

  const currentCircles = images[idx]?.circles;
  const ability = agent?.abilities?.find((a: any) => a.slot === lineup.abilitySlot);

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

          <div className="flex gap-2">
            <button onClick={()=>{ if(confirm(`Delete "${lineup.title}"? This cannot be undone.`)) onDelete?.(lineup.id); }} className="flex-1 h-10 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-bold border border-red-700">Delete</button>
            <button onClick={()=>{ if(onEdit) onEdit(lineup.id); else alert("Edit coming soon — create/edit flow is being built."); }} className="flex-1 h-10 rounded bg-tile hover:bg-tileHover border border-borderSubtle text-textPrimary text-sm font-bold">Edit</button>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted mb-2">Preview ({images.length || "no images"})</p>
            {images.length > 0 ? (
              <div className="relative">
                <AnnotatedImage src={images[idx].src} circles={currentCircles} />
                {images.length > 1 && (
                  <div className="flex items-center justify-between mt-2">
                    <button onClick={() => setIdx((i) => Math.max(0, i - 1))} className="px-3 py-1.5 rounded bg-tile text-sm text-textPrimary min-h-[40px] disabled:opacity-40" disabled={idx === 0}>‹ Prev</button>
                    <span className="text-xs text-muted">{idx + 1} / {images.length}</span>
                    <button onClick={() => setIdx((i) => Math.min(images.length - 1, i + 1))} className="px-3 py-1.5 rounded bg-tile text-sm text-textPrimary min-h-[40px] disabled:opacity-40" disabled={idx === images.length - 1}>Next ›</button>
                  </div>
                )}
                <div className="flex gap-2 mt-2 overflow-auto overscroll-contain">
                  {images.map((imgEntry, i) => (
                    <button key={i} onClick={() => setIdx(i)} className={`w-20 h-14 rounded overflow-hidden border-2 flex-shrink-0 bg-black ${i === idx ? "border-accent" : "border-transparent opacity-60"}`}>
                      {imgEntry.src?.toLowerCase().endsWith(".mp4") || imgEntry.src?.toLowerCase().endsWith(".webm") ? (
                        <video src={imgEntry.src} className="w-full h-full object-cover" muted playsInline />
                      ) : (
                        <img src={imgEntry.src} alt="" className="w-full h-full object-cover" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3"}} />
                      )}
                    </button>
                  ))}
                </div>
                {currentCircles && currentCircles.length > 0 && (
                  <p className="text-xs text-muted mt-2">{currentCircles.length} annotation{currentCircles.length>1?'s':''} on this image • hover for zoom lens</p>
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
