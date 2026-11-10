import { useEffect, useMemo, useState, useRef } from "react";
import type { Lineup } from "../types/lineup";
import AnnotatedImage from "./AnnotatedImage";
import { useLineupMedia, useMediaResolver } from "../hooks/useMediaResolver";

function buildEntries(lineup: Lineup) {
  const entries: any[] = [];
  const slots: any = (lineup as any).slots ?? {};
  const media: any = (lineup as any).media ?? {};
  const map: any = { stand1: slots.stand1 ?? media.standImage, aim1: slots.aim1 ?? media.aimImage, aim2: slots.aim2, landing: slots.landing ?? media.landingImage };
  const throwMap: any = { aim1: (lineup as any).throws?.[0], aim2: (lineup as any).throws?.[1] };
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

export default function PipOverlay({ lineup, onClose }: { lineup: Lineup | null; onClose?: () => void }) {
  const [idx, setIdx] = useState(0);
  const pipWinRef = useRef<Window|null>(null);
  const [pipSupported, setPipSupported] = useState<boolean>(() => typeof (window as any).documentPictureInPicture !== "undefined");
  const [isPipOpen, setIsPipOpen] = useState(false);

  useEffect(()=> setIdx(0), [lineup?.id]);

  const entries = useMemo(()=> lineup ? buildEntries(lineup) : [], [lineup]);
  const raw = useMemo(()=> entries.map(e=>e.src), [entries]);
  const resolved = useMediaResolver(raw as any);
  const mediaMap = useLineupMedia(lineup?.id ?? null);
  const images = useMemo(()=> entries.map((e,i)=>{
    const short = e.src.split("/").pop()!.toLowerCase();
    const fromMap = mediaMap[short] ?? mediaMap[e.src.toLowerCase()];
    const src = fromMap ?? resolved[i] ?? e.src;
    return { src, circles: e.circles, slot: e.slot, throwInfo: e.throwInfo };
  }), [entries, resolved, mediaMap]);

  useEffect(()=> {
    setPipSupported(typeof (window as any).documentPictureInPicture !== "undefined");
  }, []);

  const openPip = async () => {
    if (!lineup || images.length===0) return;
    const cur = images[idx];
    try {
      // Try Tauri always-on-top window first
      const tauri: any = (window as any).__TAURI__;
      const invoke: any = tauri?.core?.invoke ?? tauri?.invoke;
      if (invoke) {
        try {
          await invoke("open_pip_overlay", { title: lineup.title, image: cur.src, idx, total: images.length });
          // still open browser PiP as fallback? prefer Tauri
          return;
        } catch {}
      }
    } catch {}
    // Browser Document PiP API
    try {
      const pip: any = (window as any).documentPictureInPicture;
      if (!pip) {
        // fallback: just show inline floating
        setIsPipOpen(true);
        return;
      }
      const pipWindow: Window = await pip.requestWindow({ width: 420, height: 340 });
      pipWinRef.current = pipWindow;
      // copy styles
      [...document.styleSheets].forEach((sheet) => {
        try {
          const cssText = [...sheet.cssRules].map(r=>r.cssText).join("");
          const style = pipWindow.document.createElement("style");
          style.textContent = cssText;
          pipWindow.document.head.appendChild(style);
        } catch {}
      });
      // also copy tailwind via link fallback
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      links.forEach(l=>{
        const nl = pipWindow.document.createElement("link");
        // @ts-ignore
        nl.rel = "stylesheet"; nl.href = (l as any).href;
        pipWindow.document.head.appendChild(nl);
      });
      pipWindow.document.body.style.margin="0";
      pipWindow.document.body.style.background="#0B0E14";
      pipWindow.document.body.style.overflow="hidden";
      pipWindow.document.body.style.fontFamily="system-ui,sans-serif";
      const container = pipWindow.document.createElement("div");
      container.style.cssText = "width:100vw;height:100vh;display:flex;flex-direction:column;background:#0B0E14;color:#EDEDED;";
      const header = pipWindow.document.createElement("div");
      header.style.cssText = "padding:8px 10px;background:#1B1B1F;border-bottom:1px solid #2A2B32;display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:12px;";
      header.innerHTML = `<span>${lineup.title} — ${cur.slot ?? `Image ${idx+1}/${images.length}`}</span><button id="pip-close" style="width:28px;height:28px;border-radius:6px;background:#34353D;border:1px solid #3A3B44;color:#EDEDED;">✕</button>`;
      const imgWrap = pipWindow.document.createElement("div");
      imgWrap.style.cssText = "flex:1;position:relative;display:flex;align-items:center;justify-content:center;background:#131315;padding:8px;overflow:hidden;";
      const img = pipWindow.document.createElement("img");
      img.src = cur.src;
      img.style.cssText = "max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;border:1px solid #2A2B32;";
      imgWrap.appendChild(img);
      const controls = pipWindow.document.createElement("div");
      controls.style.cssText = "display:flex;gap:6px;padding:8px;background:#1B1B1F;border-top:1px solid #2A2B32;align-items:center;justify-content:space-between;";
      controls.innerHTML = `<button id="pip-prev" style="padding:6px 10px;border-radius:6px;background:#34353D;color:#EDEDED;border:1px solid #3A3B44;">‹ Prev</button><span style="font-size:11px;color:#9CA3AF;">${idx+1}/${images.length}</span><button id="pip-next" style="padding:6px 10px;border-radius:6px;background:#E8404F;color:white;border:1px solid #E8404F;">Next ›</button>`;
      container.appendChild(header); container.appendChild(imgWrap); container.appendChild(controls);
      pipWindow.document.body.appendChild(container);
      // wire
      let curIdx = idx;
      const updateImg = (newIdx:number) => {
        if (newIdx<0 || newIdx>=images.length) return;
        curIdx = newIdx;
        img.src = images[curIdx].src;
        header.firstElementChild!.textContent = `${lineup.title} — ${images[curIdx].slot ?? `Image ${curIdx+1}/${images.length}`}`;
        controls.querySelector("span")!.textContent = `${curIdx+1}/${images.length}`;
      };
      header.querySelector("#pip-close")?.addEventListener("click", ()=> pipWindow.close());
      controls.querySelector("#pip-prev")?.addEventListener("click", ()=> updateImg(curIdx-1));
      controls.querySelector("#pip-next")?.addEventListener("click", ()=> updateImg(curIdx+1));
      pipWindow.addEventListener("pagehide", ()=> { pipWinRef.current=null; setIsPipOpen(false); });
      setIsPipOpen(true);
    } catch (e:any) {
      console.warn("PiP failed", e);
      setIsPipOpen(true);
    }
  };

  // update pip window when idx changes
  useEffect(()=>{
    if (pipWinRef.current) {
      try {
        const img = pipWinRef.current.document.querySelector("img") as HTMLImageElement | null;
        if (img && images[idx]) img.src = images[idx].src;
      } catch {}
    }
  }, [idx, images]);

  if (!lineup) return null;

  return (
    <>
      {/* inline floating PiP fallback (always-on-top via CSS fixed, high z) */}
      <div className="fixed bottom-4 right-4 z-[70] w-[380px] max-w-[92vw] rounded-card overflow-hidden shadow-2xl border border-borderSubtle bg-panel flex flex-col" style={{ boxShadow:"0 20px 60px rgba(0,0,0,0.6)"}}>
        <div className="px-3 py-2 bg-[#1B1B1F] border-b border-borderSubtle flex items-center justify-between">
          <span className="text-xs font-extrabold truncate pr-2">{lineup.title} — {images[idx]?.slot ?? `${idx+1}/${images.length}`}</span>
          <div className="flex gap-1 shrink-0">
            <button onClick={()=>setIdx(i=>Math.max(0,i-1))} disabled={idx===0} className="w-8 h-8 rounded bg-tile border border-borderSubtle text-muted disabled:opacity-40">‹</button>
            <button onClick={()=>setIdx(i=>Math.min(images.length-1,i+1))} disabled={idx===images.length-1} className="w-8 h-8 rounded bg-accent text-white border border-accent disabled:opacity-40">›</button>
            <button onClick={onClose} className="w-8 h-8 rounded bg-tile border border-borderSubtle text-muted">✕</button>
          </div>
        </div>
        <div className="relative bg-[#131315] flex items-center justify-center p-2 h-[220px]">
          {images[idx] ? <AnnotatedImage src={images[idx].src} circles={images[idx].circles} /> : <span className="text-muted text-xs">No image</span>}
          {images[idx]?.throwInfo && <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded border border-white/20">{images[idx].throwInfo.type ?? "Throw"}</div>}
        </div>
        <div className="px-2 py-2 bg-tile border-t border-borderSubtle flex items-center justify-between">
          <span className="text-[10px] text-muted">{idx+1}/{images.length} • Alt+Q/E to cycle</span>
          <button onClick={openPip} className="px-3 py-1.5 rounded bg-panel border border-borderSubtle text-xs font-bold text-textPrimary hover:bg-tile">
            {pipSupported ? "Pop-out PiP (always on top)" : "Pop-out"}
          </button>
        </div>
        {isPipOpen && pipWinRef.current && <div className="px-2 py-1 bg-accent/10 text-accent text-[10px] text-center">PiP window open — stays above Valorant</div>}
      </div>
    </>
  );
}
