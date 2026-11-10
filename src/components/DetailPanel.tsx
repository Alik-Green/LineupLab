import { useState, useEffect, useMemo } from "react";
import type { Lineup } from "../types/lineup";
import AnnotatedImage from "./AnnotatedImage";
import { useMediaResolver, useLineupMedia } from "../hooks/useMediaResolver";

type ImageEntry = { src: string; circles: any[]; slot?: string; throwInfo?: any };

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

  let aimIdx = 0;
  const throws: any[] = (lineup as any).throws ?? [];

  for (const { key, fallback } of slotKeys) {
    const src = (lineup.slots as any)?.[key] ?? (fallback ? (lineup.media as any)?.[fallback] : undefined);
    if (!src) continue;
    const circles = (slotCirclesMap as any)[key] ?? [];
    let throwInfo: any = undefined;
    if (key.startsWith("aim") && throws[aimIdx]) { throwInfo = throws[aimIdx]; aimIdx++; }
    entries.push({ src, circles: [...circles], slot: key, throwInfo });
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
        const isAim = imgSrc.toLowerCase().includes("aim");
        entries.push({ src: imgSrc, circles: [...(pCircles ?? [])], slot: isAim ? `aim${aimIdx + 1}` : undefined, throwInfo: isAim ? p : undefined });
      }
    }
  }
  for (const step of lineup.steps ?? []) {
    if (step.image) entries.push({ src: step.image, circles: [...(step.circles ?? [])], slot: "step" });
  }
  // legacy direct media fallback
  if (entries.length === 0 && lineup.media) {
    const fallbackMedia = [lineup.media.standImage, lineup.media.aimImage, lineup.media.landingImage].filter(Boolean) as string[];
    for (const src of fallbackMedia) entries.push({ src, circles: [] });
  }
  // also collect any legacy attributes that might hold image refs as plain strings
  const legacyCollect = (obj: any, out: string[]) => {
    if (!obj || typeof obj !== "object") return;
    for (const [, v] of Object.entries(obj)) {
      if (typeof v === "string" && (v.startsWith("media/") || v.endsWith(".jpg") || v.endsWith(".png") || v.endsWith(".mp4") || v.endsWith(".webm"))) {
        if (!out.includes(v)) out.push(v);
      }
    }
  };
  if (entries.length === 0) {
    const extra: string[] = [];
    legacyCollect((lineup as any).legacy?.raw, extra);
    legacyCollect((lineup as any).attributes, extra);
    for (const s of extra) if (!entries.some(e=>e.src===s)) entries.push({ src: s, circles: [] });
  }

  const dedup = new Map<string, ImageEntry>();
  for (const e of entries) {
    // dedup by basename lowercased (handles media/asset.jpg vs asset.jpg vs http url variants)
    const base = e.src.split("/").pop()!.split("?")[0].split("#")[0].toLowerCase();
    const norm = base;
    const existing = dedup.get(norm);
    if (existing) {
      const byId = new Map(existing.circles.map((c: any) => c.id ?? `${c.x}-${c.y}`));
      for (const c of e.circles) {
        const id = (c as any).id ?? `${(c as any).x}-${(c as any).y}`;
        if (!byId.has(id)) existing.circles.push(c);
      }
      if (!existing.throwInfo && e.throwInfo) existing.throwInfo = e.throwInfo;
    } else {
      dedup.set(norm, { src: e.src, circles: [...e.circles], slot: e.slot, throwInfo: e.throwInfo });
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
    try { return buildImageEntries(lineup); } catch (e) { console.error("buildImageEntries", e); return []; }
  }, [lineup]);
  const rawSources = useMemo(() => imageEntries.map((e) => e.src), [imageEntries]);

  // two resolvers: by asset name (getMediaUrl) and by lineupId (direct media table)
  let resolved: (string | undefined)[] = rawSources as (string|undefined)[];
  try { const r = useMediaResolver(rawSources as (string|undefined)[]); if (r) resolved = r; } catch {}

  const lineupMediaMap = useLineupMedia(lineup.id);

  const images = useMemo(() => {
    return imageEntries.map((e, i) => {
      const short = e.src.split("/").pop()!.toLowerCase();
      const exact = e.src.toLowerCase();
      // priority: direct lineup media map, then resolved via getMediaUrl, then original
      const fromMap = lineupMediaMap[exact] ?? lineupMediaMap[short];
      let src = fromMap ?? resolved[i] ?? e.src;
      // if src is still a media/ path (relative), it means not resolved — try map again with short without extension variations
      if (src && src.startsWith("media/") && !src.startsWith("blob:") && !src.startsWith("http")) {
        // if we have any media for this lineup, use first as fallback for this entry (better than broken)
        const fallback = Object.values(lineupMediaMap)[0];
        if (fallback && !imageEntries.some(entry => lineupMediaMap[entry.src.split("/").pop()!.toLowerCase()] === fallback && false)) {
          // don't auto fallback to wrong image — keep original to show placeholder rather than wrong
        }
      }
      return { src, circles: e.circles, slot: e.slot, throwInfo: e.throwInfo };
    });
  }, [imageEntries, resolved, lineupMediaMap]);

  // If build found nothing but lineupMediaMap has entries, show those directly as fallback
  const fallbackMediaImages = useMemo(() => {
    if (images.length > 0) return [];
    const vals = Object.entries(lineupMediaMap);
    if (vals.length === 0) return [];
    return vals.map(([k, url]) => ({ src: url, circles: [], slot: k.includes("landing") ? "landing" : k.includes("aim") ? "aim1" : "stand1", throwInfo: undefined }));
  }, [images.length, lineupMediaMap]);

  const allImages = images.length > 0 ? images : fallbackMediaImages;

  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [lineup.id]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(allImages.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, allImages.length]);

  const current = allImages[idx];
  const currentCircles = current?.circles;
  const ability = agent?.abilities?.find((a: any) => a.slot === lineup.abilitySlot);

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-panel border border-borderSubtle rounded-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e)=>e.stopPropagation()}>
        <div className="p-4 border-b border-borderSubtle flex items-start justify-between shrink-0 gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-[20px] font-extrabold text-textPrimary leading-tight">{lineup.title}</h3>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <span className="px-2 py-1 rounded text-xs font-bold border" style={{ borderColor: lineup.importance === "essential" ? "#22C55E" : lineup.importance === "optional" ? "#E8404F" : "#EDEDED", color: lineup.importance === "essential" ? "#22C55E" : lineup.importance === "optional" ? "#E8404F" : "#EDEDED" }}>{lineup.importance}</span>
              <span className="px-2 py-1 rounded text-xs font-bold border border-borderSubtle text-muted">{lineup.difficulty}</span>
              {lineup.throwType && <span className="px-2 py-1 rounded bg-accent/20 border border-accent text-accent text-xs font-bold">{lineup.throwType}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => { if (onEdit) onEdit(lineup.id); else alert("Edit coming soon."); }} className="w-8 h-8 rounded bg-tile hover:bg-tileHover border border-borderSubtle flex items-center justify-center text-muted" aria-label="Edit" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L11 16l-4 1 1-4 10.5-10.5z"/></svg>
            </button>
            <button onClick={() => { if (confirm(`Delete "${lineup.title}"?`)) onDelete?.(lineup.id); }} className="w-8 h-8 rounded bg-tile hover:bg-red-500/20 border border-borderSubtle hover:border-red-500 flex items-center justify-center text-muted hover:text-red-500" aria-label="Delete" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded bg-tile hover:bg-tileHover border border-borderSubtle flex items-center justify-center text-muted" aria-label="Close detail">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto overscroll-contain p-4 space-y-4 min-h-0 thin-scrollbar">
          <div>
            {allImages.length > 0 ? (
              <div className="relative">
                <AnnotatedImage src={current.src} circles={currentCircles} />
                {current?.throwInfo && (
                  <div className="absolute top-2 left-2 bg-accent text-white text-xs font-bold px-2 py-1 rounded shadow">
                    {current.throwInfo.type ?? current.throwInfo.label ?? "Throw"} {current.throwInfo.note ? `• ${current.throwInfo.note}` : ""}
                  </div>
                )}
                {current?.slot === "landing" && <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded">Landing</div>}
                {current?.slot?.startsWith("stand") && <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded">Stand position</div>}
                {allImages.length > 1 && (
                  <div className="flex items-center justify-between mt-2">
                    <button onClick={() => setIdx((i) => Math.max(0, i - 1))} className="px-3 py-1.5 rounded bg-tile text-sm text-textPrimary min-h-[40px] disabled:opacity-40" disabled={idx === 0}>‹ Prev</button>
                    <span className="text-xs text-muted">{idx + 1} / {allImages.length}</span>
                    <button onClick={() => setIdx((i) => Math.min(allImages.length - 1, i + 1))} className="px-3 py-1.5 rounded bg-tile text-sm text-textPrimary min-h-[40px] disabled:opacity-40" disabled={idx === allImages.length - 1}>Next ›</button>
                  </div>
                )}
                <div className="flex gap-2 mt-2 overflow-auto overscroll-contain">
                  {allImages.map((imgEntry, i) => (
                    <button key={i} onClick={() => setIdx(i)} className={`relative w-20 h-14 rounded overflow-hidden border-2 flex-shrink-0 bg-black ${i === idx ? "border-accent" : "border-transparent opacity-60"}`}>
                      {imgEntry.src?.toLowerCase().endsWith(".mp4") || imgEntry.src?.toLowerCase().endsWith(".webm") ? (
                        <video src={imgEntry.src} className="w-full h-full object-cover" muted playsInline />
                      ) : (
                        <img src={imgEntry.src} alt="" className="w-full h-full object-cover" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.opacity="0.3"}} />
                      )}
                      {imgEntry.throwInfo && <span className="absolute bottom-0 left-0 right-0 bg-accent text-white text-[9px] font-bold text-center py-0.5 leading-none">{imgEntry.throwInfo.type ?? "Throw"}</span>}
                    </button>
                  ))}
                </div>
                {currentCircles && currentCircles.length > 0 && <p className="text-xs text-muted mt-2">{currentCircles.length} annotation{currentCircles.length>1?'s':''} on this image • hover for zoom lens</p>}
              </div>
            ) : (
              <div className="rounded-md bg-tile border border-borderSubtle h-[160px] flex flex-col items-center justify-center text-muted p-4 text-center">
                <span className="text-2xl">🖼️</span>
                <span className="text-sm mt-1">No preview images</span>
                <span className="text-xs text-muted mt-1">This lineup has no stand / aim / landing images yet.</span>
              </div>
            )}
          </div>

          {lineup.steps && lineup.steps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted">Steps</p>
              {lineup.steps.map((s,i)=> (
                <div key={i} className="rounded-md bg-tile border border-borderSubtle p-3">
                  <p className="text-sm font-semibold text-textPrimary">{s.title ?? `Step ${i+1}`}</p>
                  {s.description && <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{s.description}</p>}
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
        </div>

        <div className="p-3 border-t border-borderSubtle flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 min-h-[44px] rounded bg-accent hover:bg-accentHover text-white font-semibold text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
