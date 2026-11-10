import { useState, useMemo, useEffect, useRef } from "react";
import type { ValorantAgent, ValorantMap } from "../types/lineup";
import Minimap from "./Minimap";
import type { Side } from "../types/lineup";
import { putLineup, putMedia } from "../lib/indexedDBRepository";
import { sha256Blob } from "../lib/db";
import { useAppStore } from "../stores/appStore";

type TabId = "capture" | "setup";
type SlotId = "stand" | "aim" | "landing";

export default function CreateWizard({
  agents,
  maps,
  createMode,
  onCreateModeChange,
  selectedMapOverride,
  selectedAgentOverride,
  onCreated,
}: {
  agents: ValorantAgent[];
  maps: ValorantMap[];
  createMode?: TabId;
  onCreateModeChange?: (m: TabId) => void;
  hideChrome?: boolean;
  selectedMapOverride?: ValorantMap | null;
  selectedAgentOverride?: ValorantAgent | null;
  sideOverride?: Side;
  onCreated?: () => void;
}) {
  const [internalMode, setInternalMode] = useState<TabId>("capture");
  const active = createMode ?? internalMode;
  const setActive = (m: TabId) => { if (onCreateModeChange) onCreateModeChange(m); else setInternalMode(m); };

  const [selectedSlot, setSelectedSlot] = useState<SlotId>("stand");
  const [title, setTitle] = useState("");
  const [pinZoom, setPinZoom] = useState(1);
  const [pinPan, setPinPan] = useState({ x: 0, y: 0 });
  const [startPin, setStartPin] = useState<{x:number,y:number}|null>(null);
  const [endPin, setEndPin] = useState<{x:number,y:number}|null>(null);
  const [activePin, setActivePin] = useState<"start"|"end">("start");

  const store = useAppStore();
  const effectiveMap = selectedMapOverride ?? maps[0] ?? null;
  const effectiveAgent = selectedAgentOverride ?? agents[0] ?? null;

  const agentsMap = useMemo(() => {
    const m = new Map<string, any>();
    agents.forEach(a => m.set(a.uuid, a));
    return m;
  }, [agents]);

  const [slotData, setSlotData] = useState<Record<SlotId, { blob: Blob; url: string } | null>>({
    stand: null,
    aim: null,
    landing: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toast = (msg: string) => {
    const el = document.createElement("div");
    el.textContent = msg;
    el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 bg-panel border border-borderSubtle text-textPrimary px-4 py-2 rounded-md shadow-xl z-50 text-sm";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  };

  const slotDefs: { id: SlotId; label: string; hotkey: string }[] = [
    { id: "stand", label: "1. STAND", hotkey: "ALT+1" },
    { id: "aim", label: "2. AIM", hotkey: "ALT+2" },
    { id: "landing", label: "3. LANDING", hotkey: "ALT+3" },
  ];

  const setSlotBlob = (slot: SlotId, blob: Blob) => {
    setSlotData(prev => {
      const old = prev[slot];
      if (old) URL.revokeObjectURL(old.url);
      const url = URL.createObjectURL(blob);
      return { ...prev, [slot]: { blob, url } };
    });
    toast(`${slot} image saved`);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) { toast("Only images allowed"); return; }
    setSlotBlob(selectedSlot, file);
  };

  const detectValorant = async (): Promise<boolean> => {
    try {
      const tauri = (window as any).__TAURI__;
      if (tauri?.core?.invoke) {
        const running = await tauri.core.invoke("is_valorant_running");
        return !!running;
      }
      if (tauri?.invoke) {
        const running = await tauri.invoke("is_valorant_running");
        return !!running;
      }
    } catch {}
    return false;
  };

  const captureScreen = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast("Screen capture not supported");
        return;
      }
      const valorantRunning = await detectValorant();
      const displaySurface = valorantRunning ? "window" : "monitor";
      if (valorantRunning) toast("Valorant detected — select Valorant window");
      else toast("Valorant not running — capturing entire screen");

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface } as any,
        audio: false,
      } as any);
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise(r => setTimeout(r, 250));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob: Blob | null = await new Promise(res => canvas.toBlob(b => res(b), "image/png"));
        if (blob) setSlotBlob(selectedSlot, blob);
        else toast("Capture failed");
      }
      stream.getTracks().forEach(t => t.stop());
      video.remove();
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.name === "AbortError") toast("Capture cancelled");
      else toast("Capture failed: " + String(e?.message ?? e));
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (active !== "capture") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) {
            e.preventDefault();
            setSlotBlob(selectedSlot, file);
            break;
          }
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (active !== "capture") return;
      if (e.altKey && e.code === "Digit1") { e.preventDefault(); setSelectedSlot("stand"); }
      if (e.altKey && e.code === "Digit2") { e.preventDefault(); setSelectedSlot("aim"); }
      if (e.altKey && e.code === "Digit3") { e.preventDefault(); setSelectedSlot("landing"); }
      if (e.altKey && (e.code === "KeyP" || e.key.toLowerCase() === "p")) {
        e.preventDefault();
        captureScreen();
      }
    };
    window.addEventListener("paste", onPaste as any);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("paste", onPaste as any);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, selectedSlot]);

  useEffect(() => () => {
    Object.values(slotData).forEach(v => { if (v) URL.revokeObjectURL(v.url); });
  }, []);

  const handleMapClick = (pt: {x:number,y:number}) => {
    if (active !== "setup") return;
    if (activePin === "start") setStartPin(pt);
    else setEndPin(pt);
  };

  const nearestCallout = (pt: {x:number,y:number} | null, map: ValorantMap | null) => {
    if (!pt || !map || !(map as any).callouts) return null;
    const list: any[] = (map as any).callouts;
    let best: any = null;
    let bestDist = Infinity;
    for (const c of list) {
      if (!c.location || map.xMultiplier == null) continue;
      const nx = c.location.y * (map.xMultiplier as number) + (map.xScalarToAdd as number);
      const ny = c.location.x * (map.yMultiplier as number) + (map.yScalarToAdd as number);
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue;
      const d = Math.hypot(nx - pt.x, ny - pt.y);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    if (!best) return null;
    const reg = (best.regionName ?? "").trim();
    const sup = (best.superRegionName ?? "").trim();
    if (sup && reg && sup.toLowerCase() !== reg.toLowerCase() && !reg.toLowerCase().includes(sup.toLowerCase())) {
      return `${sup} ${reg}`;
    }
    return reg || sup || null;
  };

  const generateTitle = () => {
    if (!effectiveAgent || !effectiveMap) { toast("Select map and agent first"); return; }
    const abilitySlot = Array.from(store.selectedAbilities)[0] as any ?? "Ability1";
    const agentAb = effectiveAgent.abilities?.find(a => a.slot === abilitySlot);
    const abilityName = agentAb?.displayName ?? abilitySlot;
    const mapName = effectiveMap.displayName;
    const startName = nearestCallout(startPin, effectiveMap);
    const endName = nearestCallout(endPin, effectiveMap);
    let suffix = "";
    if (startName || endName) {
      if (startName && endName && startName !== endName) suffix = ` ${startName} → ${endName}`;
      else if (endName) suffix = ` to ${endName}`;
      else if (startName) suffix = ` from ${startName}`;
    }
    const gen = `${effectiveAgent.displayName} ${abilityName} on ${mapName}${suffix}`;
    setTitle(gen);
    toast("Title generated");
  };

  const handleSave = async () => {
    if (!title.trim()) { toast("Title is required"); return; }
    if (!effectiveMap || !effectiveAgent) { toast("Map and agent required"); return; }
    if (!startPin || !endPin) { toast("Place both start and end pins on map"); return; }
    const abilitySlot = Array.from(store.selectedAbilities)[0] as any ?? "Ability1";
    const importance = Array.from(store.importance)[0] as any ?? "useful";
    const difficulty = Array.from(store.difficulty)[0] as any ?? "normal";
    const lineupId = `user-${Date.now().toString(36)}`;
    const newLineup: any = {
      id: lineupId,
      title: title.trim(),
      mapUuid: effectiveMap.uuid,
      agentUuid: effectiveAgent.uuid,
      abilitySlot,
      side: store.side,
      site: undefined,
      start: startPin,
      end: endPin,
      bounces: [],
      throwType: "Standing",
      difficulty,
      importance,
      tags: ["user"],
      notes: "",
      media: {},
      slots: {},
      throws: [],
      steps: [],
      circles: [],
      source: "user" as const,
      status: "ok" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const slotToMediaKey: Record<SlotId, string> = { stand: "standImage", aim: "aimImage", landing: "landingImage" };
    for (const sid of Object.keys(slotData) as SlotId[]) {
      const entry = slotData[sid];
      if (entry) {
        const assetName = `${sid}.jpg`;
        newLineup.media[slotToMediaKey[sid]] = assetName;
        newLineup.slots[sid] = assetName;
        try {
          const sha = await sha256Blob(entry.blob);
          await putMedia({
            id: `${lineupId}-${sid}`,
            lineupId,
            assetName,
            blob: entry.blob,
            sha256: sha,
            mimeType: entry.blob.type || "image/png",
            createdAt: new Date().toISOString(),
          });
        } catch (e) { console.warn("putMedia failed", e); }
      }
    }
    try {
      await putLineup(newLineup);
      toast("Lineup saved");
      setTitle(""); setStartPin(null); setEndPin(null);
      onCreated?.();
      setActive("capture");
    } catch (e:any) { toast("Save failed: "+String(e)); }
  };

  const previewLineups = (() => {
    if (!startPin || !endPin) return [];
    return [{ id: "preview", title, mapUuid: effectiveMap?.uuid, agentUuid: effectiveAgent?.uuid, abilitySlot: Array.from(store.selectedAbilities)[0] ?? "Ability1", side: store.side, start: startPin, end: endPin, bounces: [], importance: Array.from(store.importance)[0] ?? "useful", difficulty: Array.from(store.difficulty)[0] ?? "normal", throwType: "Standing" } as any];
  })();

  const currentSlotData = slotData[selectedSlot];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-pageBg">
      {/* Slots — now using app tokens to match Lineups sidebar */}
      {active === "capture" && (
        <div className="shrink-0 p-2 bg-panel border-b border-borderSubtle">
          <div className="flex gap-2">
            {slotDefs.map(s=> {
              const isSel = selectedSlot===s.id;
              const hasImg = !!slotData[s.id];
              return (
                <button key={s.id} onClick={()=>setSelectedSlot(s.id)} className={`flex-1 rounded-md border p-2.5 text-left flex items-center gap-2.5 transition-colors ${isSel?"border-accent bg-tile shadow-sm":"border-borderSubtle bg-pageBg hover:bg-tile hover:border-textMuted/30"}`}>
                  <div className={`w-9 h-9 rounded-md border flex items-center justify-center shrink-0 ${isSel?"bg-accent border-accent text-white":"bg-tile border-borderSubtle text-muted"} ${hasImg && isSel ? "bg-essential border-essential" : hasImg ? "bg-essential/20 border-essential text-essential" : ""}`}>
                    {hasImg ? <span className="text-xs font-bold">✓</span> : <span className="text-lg">◎</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-extrabold tracking-widest text-textPrimary flex items-center gap-1.5">{s.label} {hasImg && <span className="w-2 h-2 rounded-full bg-essential inline-block shadow-sm" />}</div>
                    <div className="text-[10px] font-semibold text-muted tracking-wide">{s.hotkey}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {active === "capture" ? (
        <div className="flex-1 flex flex-col min-h-0 p-3 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold tracking-[0.14em] text-muted">CAPTURE</span>
            <span className="px-2.5 py-1 rounded-full bg-accent text-white text-[10px] font-extrabold tracking-widest shadow-sm">◎ ALT+{selectedSlot==="stand"?1:selectedSlot==="aim"?2:3} • {selectedSlot.toUpperCase()}</span>
            <div className="ml-auto flex items-center gap-2">
              {currentSlotData && (
                <button onClick={()=>{ if (currentSlotData) URL.revokeObjectURL(currentSlotData.url); setSlotData(prev=>({...prev,[selectedSlot]:null})); }} className="px-3 py-1.5 rounded-md bg-panel border border-borderSubtle text-muted text-xs font-semibold hover:text-textPrimary hover:border-textMuted/30">Clear</button>
              )}
              <button onClick={()=>fileInputRef.current?.click()} className="w-9 h-9 rounded-md bg-panel border border-borderSubtle text-muted hover:text-textPrimary hover:bg-tile flex items-center justify-center" title="Browse files">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15l3 3 3-3"/></svg>
              </button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e=>{ handleFiles(e.target.files); if (e.target) e.target.value=""; }} />

          <div
            onClick={()=>{ if (!currentSlotData) captureScreen(); }}
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{ e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className={`flex-1 rounded-card border-2 border-dashed flex flex-col items-center justify-center p-6 min-h-0 relative overflow-hidden transition-colors ${currentSlotData ? "border-essential/40 bg-panel p-0 shadow-inner" : "border-borderSubtle bg-panel hover:bg-tile hover:border-accent/40 cursor-pointer"}`}
          >
            {currentSlotData ? (
              <>
                <img src={currentSlotData.url} alt={`${selectedSlot} preview`} className="w-full h-full object-contain bg-black" draggable={false} />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                  <button onClick={(e)=>{ e.stopPropagation(); captureScreen(); }} className="px-4 py-2 rounded-md bg-panel border border-borderSubtle text-textPrimary text-xs font-bold shadow-lg hover:bg-tile">Retake</button>
                  <button onClick={(e)=>{ e.stopPropagation(); fileInputRef.current?.click(); }} className="px-4 py-2 rounded-md bg-panel border border-borderSubtle text-textPrimary text-xs font-bold shadow-lg hover:bg-tile">Browse</button>
                </div>
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-essential text-white text-[10px] font-extrabold tracking-widest shadow">SAVED • {selectedSlot.toUpperCase()}</div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center mb-4"><span className="text-accent text-2xl">◎</span></div>
                <p className="text-sm font-extrabold tracking-[0.12em] text-textPrimary">PRESS ALT+P IN VALORANT</p>
                <p className="text-xs text-muted mt-1.5 font-medium">Or click • Drop • Paste (Ctrl+V)</p>
                <div className="mt-5 flex gap-2">
                  <button onClick={(e)=>{ e.stopPropagation(); captureScreen(); }} className="px-6 py-2.5 rounded-md bg-accent hover:bg-accentHover text-white text-xs font-extrabold tracking-widest shadow-sm min-h-[44px]">Capture (Alt+P)</button>
                  <button onClick={(e)=>{ e.stopPropagation(); fileInputRef.current?.click(); }} className="px-5 py-2.5 rounded-md bg-tile hover:bg-tileHover border border-borderSubtle text-textPrimary text-xs font-bold min-h-[44px]">Browse</button>
                </div>
                <p className="text-[10px] text-muted mt-3 tracking-wide">Images are saved as JPG for v2 export • ALT+1/2/3 to switch slots</p>
              </>
            )}
          </div>
          <div className="shrink-0 flex items-center justify-between bg-panel border border-borderSubtle rounded-md px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted"><span className="w-2 h-2 rounded-full bg-essential animate-pulse" /> Valorant-aware capture — window if detected, else full screen</div>
            <button onClick={()=> setActive("setup")} className="px-3 py-1.5 rounded-md bg-tile border border-borderSubtle text-xs font-bold text-textPrimary hover:bg-tileHover">Next: Setup →</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-auto thin-scrollbar bg-pageBg">
          <div className="shrink-0 bg-panel border border-borderSubtle rounded-card p-3">
            <label className="text-[10px] font-extrabold tracking-[0.14em] text-muted">TITLE *</label>
            <div className="mt-2 flex gap-2">
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="E.g. Sova dart for A site" className="flex-1 min-h-[44px] px-3 rounded-md bg-pageBg border border-borderSubtle text-textPrimary text-sm placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
              <button onClick={generateTitle} className="shrink-0 px-4 min-h-[44px] rounded-md bg-tile hover:bg-tileHover border border-borderSubtle text-textPrimary text-xs font-extrabold tracking-widest flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l2.4 7.2H22l-6.3 4.6 2.4 7.2L12 16.6 5.9 21l2.4-7.2L2 9.2h7.6z"/><path d="M12 8v4l2 2"/></svg>
                Auto
              </button>
            </div>
            <p className="text-[10px] text-muted mt-2">Auto generates from agent + ability + nearest callouts (A Yard style)</p>
          </div>

          <div className="flex-1 rounded-card border border-borderSubtle bg-panel overflow-hidden flex flex-col min-h-[400px] shadow-sm">
            <div className="px-3 py-2.5 border-b border-borderSubtle flex items-center justify-between bg-tile">
              <h3 className="text-xs font-extrabold tracking-widest text-textPrimary">MAP PINS</h3>
              <div className="flex gap-1.5">
                <button onClick={()=>setActivePin("start")} className={`px-3 py-1.5 rounded-md text-xs font-extrabold border tracking-wide ${activePin==="start" ? "bg-accent text-white border-accent shadow-sm" : "bg-panel text-muted border-borderSubtle hover:text-textPrimary hover:bg-tile"}`}>Start {startPin ? "✓" : ""}</button>
                <button onClick={()=>setActivePin("end")} className={`px-3 py-1.5 rounded-md text-xs font-extrabold border tracking-wide ${activePin==="end" ? "bg-accent text-white border-accent shadow-sm" : "bg-panel text-muted border-borderSubtle hover:text-textPrimary hover:bg-tile"}`}>End {endPin ? "✓" : ""}</button>
                <button onClick={()=>{ setPinZoom(1); setPinPan({x:0,y:0}); }} className="px-2.5 py-1.5 rounded-md bg-panel border border-borderSubtle text-xs font-bold text-muted hover:text-textPrimary">Reset</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-[#131315] overflow-hidden flex flex-col relative">
              {effectiveMap ? (
                <>
                  <div className="flex-1 min-h-0 flex flex-col">
                    <Minimap map={effectiveMap} lineups={previewLineups} agentsMap={agentsMap} hoveredId={null} setHoveredId={()=>{}} selectedId={null} onSelect={()=>{}} zoom={pinZoom} pan={pinPan} onZoom={setPinZoom} onPan={setPinPan} showEmpty={false} onMapClick={handleMapClick} createPins={{ start: startPin, end: endPin, active: activePin }} />
                  </div>
                  {!startPin && activePin==="start" && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-panel border border-borderSubtle text-textPrimary text-xs font-bold px-3 py-1.5 rounded-full shadow-lg pointer-events-none z-10">Click map to place start pin</div>
                  )}
                  {startPin && !endPin && activePin==="end" && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-panel border border-borderSubtle text-textPrimary text-xs font-bold px-3 py-1.5 rounded-full shadow-lg pointer-events-none z-10">Click map to place end pin</div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted text-sm">Select a map</div>
              )}
            </div>
          </div>

          <button onClick={handleSave} className="shrink-0 w-full min-h-[48px] rounded-md bg-accent hover:bg-accentHover text-white font-extrabold tracking-widest shadow-sm">Save lineup</button>
        </div>
      )}
    </div>
  );
}
