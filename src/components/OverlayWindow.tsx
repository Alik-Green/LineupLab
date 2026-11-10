import { useEffect, useMemo, useState } from "react";
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

export default function OverlayWindow({ lineup: initialLineup }: { lineup?: Lineup | null }) {
  const [lineup, setLineup] = useState<Lineup | null>(initialLineup ?? null);
  const [idx, setIdx] = useState(0);
  const [opacity, setOpacity] = useState(0.92);
  const [locked, setLocked] = useState(false);

  useEffect(() => { setIdx(0); }, [lineup?.id]);

  // Listen for updates from main window via Tauri events, BroadcastChannel, and storage polling
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let bc: BroadcastChannel | null = null;
    let poll: any = null;
    let lastJson = "";

    const handlePayload = (payload: any) => {
      if (!payload) return;
      const pl = payload.lineup ? payload : (payload.payload ?? payload);
      if (pl?.lineup) {
        setLineup(pl.lineup);
        if (typeof pl.idx === "number") setIdx(pl.idx);
        if (typeof pl.opacity === "number") setOpacity(pl.opacity);
        return;
      }
      // Direct lineup (from BroadcastChannel)
      if (pl?.type === "overlay:update" && pl.lineup) {
        setLineup(pl.lineup);
        if (typeof pl.idx === "number") setIdx(pl.idx);
      }
    };

    (async () => {
      // Prefer Tauri event API via dynamic import (works even if __TAURI__ injection timing is late)
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen("overlay:update", (e: any) => handlePayload(e.payload ?? e));
        const unlisten2 = await listen("overlay:corner", () => {});
        // keep both unlistens
        const prevUnlisten = unlisten;
        unlisten = () => { try { prevUnlisten(); } catch{}; try { unlisten2(); } catch{} };
      } catch {}
      // Also try legacy window.__TAURI__ event API
      try {
        const tauri: any = (window as any).__TAURI__ ?? (window as any).__TAURI_INTERNALS__;
        if (tauri?.event?.listen) {
          const legacy = await tauri.event.listen("overlay:update", (e: any) => handlePayload(e.payload));
          const prev = unlisten;
          unlisten = () => { try { prev?.(); } catch{}; try { legacy?.(); } catch{} };
        }
      } catch {}

      try {
        bc = new BroadcastChannel("lineuplab-overlay");
        bc.onmessage = (ev) => handlePayload(ev.data);
      } catch {}

      const onStorage = (e: StorageEvent) => {
        if (e.key === "lineuplab.overlay" && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data.lineup) handlePayload(data);
          } catch {}
        }
      };
      window.addEventListener("storage", onStorage);

      // Initial read from localStorage (cross-window persistence)
      const readStorage = () => {
        try {
          const raw = localStorage.getItem("lineuplab.overlay");
          if (raw && raw !== lastJson) {
            lastJson = raw;
            const data = JSON.parse(raw);
            if (data?.lineup) handlePayload(data);
          }
        } catch {}
      };
      readStorage();
      // Poll for same-origin localStorage updates (storage event doesn't fire in same window, but overlay is separate webview with shared localStorage? In Tauri separate webview, localStorage may be shared via same origin. Poll ensures we catch main window's write.)
      poll = setInterval(readStorage, 500);

      // Also try Rust get_overlay_data if available
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const data: any = await invoke("get_overlay_data");
        if (data?.lineup) handlePayload(data);
      } catch {}

      return () => {
        window.removeEventListener("storage", onStorage);
        bc?.close();
        if (poll) clearInterval(poll);
      };
    })();

    return () => {
      try { unlisten?.(); } catch {}
      bc?.close();
      if (poll) clearInterval(poll);
    };
  }, []);

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

  const cur = images[idx];

  const close = async () => {
    // Try Tauri window API first (separate window close)
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      await win.hide();
      // don't close process — keep window for next open (Rust will re-show)
      // But also try Rust command as fallback
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("close_overlay").catch(()=>{});
      return;
    } catch {}
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("close_overlay");
      return;
    } catch {}
    window.close();
  };

  const toggleLock = async () => {
    const next = !locked;
    setLocked(next);
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      await win.setIgnoreCursorEvents(next);
    } catch {
      try {
        const tauri: any = (window as any).__TAURI__;
        const win = tauri?.window?.getCurrentWindow?.();
        if (win) await win.setIgnoreCursorEvents(next);
      } catch {}
    }
  };

  if (!lineup) {
    return (
      <div className="h-screen w-screen flex flex-col bg-transparent">
        <div className="flex-1 m-2 rounded-xl bg-black/80 border border-white/10 backdrop-blur-xl flex flex-col overflow-hidden select-none">
          <div className="h-7 flex items-center justify-between px-3 bg-white/5 border-b border-white/10" data-tauri-drag-region>
            <span className="text-[11px] font-bold tracking-widest text-white/60">LINEUPLAB OVERLAY — Separate Window • Always on Top</span>
            <button onClick={close} className="w-6 h-6 rounded-full bg-white/10 hover:bg-red-500 text-white flex items-center justify-center text-xs">✕</button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl">◎</div>
            <p className="text-sm font-bold text-white">No lineup selected</p>
            <p className="text-xs text-white/50 leading-relaxed">In the main LineupLab window, select a lineup<br/>then press <b className="text-white">Overlay</b> or <b className="text-white">Alt+O</b></p>
            <p className="text-[10px] text-white/30 mt-2">This frameless window stays always on top of Valorant.<br/>No title bar — drag the header to move. Use corner buttons in main app.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-transparent select-none" style={{ opacity }}>
      <div className="flex-1 m-1.5 rounded-xl bg-black/85 border border-white/10 backdrop-blur-xl flex flex-col overflow-hidden shadow-2xl">
        {/* Custom title bar - no OS chrome, draggable */}
        <div className="h-8 flex items-center justify-between px-2.5 bg-white/[0.06] border-b border-white/10 shrink-0" data-tauri-drag-region>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
            <span className="text-xs font-extrabold tracking-tight text-white truncate max-w-[180px]">{lineup.title}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/70 border border-white/10">{cur?.slot ?? `${idx+1}/${images.length}`}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0" data-tauri-drag-region="false" style={{ WebkitAppRegion: "no-drag" } as any}>
            <button onClick={toggleLock} title={locked ? "Unlock (allow clicks through)" : "Lock (click-through — overlay ignores clicks)"} className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] ${locked ? "bg-amber-500 border-amber-500 text-white" : "bg-white/10 border-white/10 text-white/70 hover:bg-white/20"}`}>
              {locked ? "🔒" : "🔓"}
            </button>
            <button onClick={close} className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500 border border-white/10 text-white flex items-center justify-center text-xs" title="Close overlay">✕</button>
          </div>
        </div>

        {/* Image area */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-0">
          {cur ? (
            <>
              <AnnotatedImage src={cur.src} circles={cur.circles} />
              {cur.throwInfo && (
                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur px-2 py-1 rounded-full border border-white/10 text-[10px] font-bold text-white">
                  {cur.throwInfo.type ?? "Throw"} {cur.throwInfo.timing ? `• ${cur.throwInfo.timing}` : ""}
                </div>
              )}
              <div className="absolute top-2 left-2 bg-white/10 backdrop-blur px-2 py-1 rounded-full border border-white/10 text-[10px] font-bold text-white">
                {cur.slot?.toUpperCase() ?? `IMG ${idx+1}`}
              </div>
              {/* Navigation */}
              <button onClick={()=>setIdx(i=>Math.max(0,i-1))} disabled={idx===0} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur border border-white/20 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/80">‹</button>
              <button onClick={()=>setIdx(i=>Math.min(images.length-1,i+1))} disabled={idx===images.length-1} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur border border-white/20 text-white flex items-center justify-center disabled:opacity-30 hover:bg-black/80">›</button>
            </>
          ) : (
            <span className="text-xs text-white/50">No image</span>
          )}
        </div>

        {/* Thumbnails + controls */}
        <div className="shrink-0 bg-white/[0.04] border-t border-white/10 p-2 flex flex-col gap-2">
          <div className="flex gap-1.5 overflow-x-auto thin-scrollbar">
            {images.map((img,i)=>(
              <button key={i} onClick={()=>setIdx(i)} className={`relative w-14 h-10 rounded-lg overflow-hidden border-2 shrink-0 bg-black ${i===idx ? "border-accent" : "border-white/10 opacity-60 hover:opacity-100"}`}>
                <img src={img.src} alt="" className="w-full h-full object-cover" />
                {i===idx && <div className="absolute inset-0 ring-2 ring-accent ring-inset pointer-events-none" />}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-white/40">{idx+1} / {images.length} • {images.length>1 ? "Click thumbnails or use ← →" : "Single image"}</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-white/40">Opacity</span>
              <input type="range" min={0.4} max={1} step={0.05} value={opacity} onChange={e=>setOpacity(parseFloat(e.target.value))} className="w-16 accent-accent h-1" />
            </div>
          </div>
        </div>

        {/* Resize handle visual */}
        <div className="absolute bottom-1 right-1 w-3 h-3 opacity-20 pointer-events-none">
          <div className="w-full h-full border-r-2 border-b-2 border-white rounded-br-xl" />
        </div>
      </div>
    </div>
  );
}
