import { useMemo, useState, useEffect } from "react";
import type { Lineup } from "../types/lineup";
import { useLineupMedia, useMediaResolver } from "../hooks/useMediaResolver";
import GameOverlay from "./GameOverlay";

function buildOverlayEntries(lineup: Lineup) {
  // replicate DetailPanel build logic simplified: stand, aim1, aim2, landing order
  const entries: any[] = [];
  const slots: any = (lineup as any).slots ?? {};
  const media: any = (lineup as any).media ?? {};
  const map: any = {
    stand1: slots.stand1 ?? media.standImage,
    aim1: slots.aim1 ?? media.aimImage,
    aim2: slots.aim2,
    landing: slots.landing ?? media.landingImage,
  };
  const throwMap: any = {
    aim1: (lineup as any).throws?.[0],
    aim2: (lineup as any).throws?.[1],
  };
  const circlesMap: any = (lineup as any).slotCircles ?? lineup.attributes?.slotCircles ?? {};
  for (const key of ["stand1","aim1","aim2","landing"]) {
    const src = map[key];
    if (!src) continue;
    entries.push({ src, circles: circlesMap[key] ?? [], slot: key, throwInfo: throwMap[key] });
  }
  if (entries.length===0 && lineup.media) {
    const fallback = [media.standImage, media.aimImage, media.landingImage].filter(Boolean);
    fallback.forEach((s,i)=> entries.push({ src:s, circles:[], slot: ["stand1","aim1","landing"][i] }));
  }
  // dedup
  const dedup = new Map();
  const out:any[]=[];
  for(const e of entries){
    const base = e.src.split("/").pop()!.toLowerCase();
    if(dedup.has(base)) continue;
    dedup.set(base,true);
    out.push(e);
  }
  return out;
}

export default function OverlayHost({ lineup, onClose, onPrevLineup, onNextLineup, canPrev, canNext }: {
  lineup: Lineup | null;
  onClose: () => void;
  onPrevLineup?: () => void;
  onNextLineup?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(()=> setIdx(0), [lineup?.id]);

  const entries = useMemo(()=> lineup ? buildOverlayEntries(lineup) : [], [lineup]);
  const raw = useMemo(()=> entries.map(e=>e.src), [entries]);
  const resolved = useMediaResolver(raw as any);
  const mediaMap = useLineupMedia(lineup?.id ?? null);

  const images = useMemo(()=> {
    return entries.map((e,i)=>{
      const short = e.src.split("/").pop()!.toLowerCase();
      const fromMap = mediaMap[short] ?? mediaMap[e.src.toLowerCase()];
      const src = fromMap ?? resolved[i] ?? e.src;
      return { src, circles: e.circles, slot: e.slot, throwInfo: e.throwInfo };
    });
  }, [entries, resolved, mediaMap]);

  if (!lineup) return null;

  return (
    <GameOverlay lineup={lineup} images={images} idx={idx} total={images.length} onClose={onClose}
      onPrev={()=>{
        if(idx>0) setIdx(i=>i-1);
        else onPrevLineup?.();
      }}
      onNext={()=>{
        if(idx < images.length-1) setIdx(i=>i+1);
        else onNextLineup?.();
      }}
    />
  );
}
