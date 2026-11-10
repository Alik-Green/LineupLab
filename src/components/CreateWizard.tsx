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

  // capture slots: store blobs + preview urls
  const [slotData, setSlotData] = useState<Record<SlotId, { blob: Blob; url: string } | null>>({
    stand: null,
    aim: null,
    landing: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteBufferRef = useRef<HTMLDivElement>(null);

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

  // helpers for capture
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

  const captureScreen = async () => {
    // Tauri or browser screen capture via getDisplayMedia
    try {
      // @ts-ignore
      if (navigator.mediaDevices?.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true } as any);
        const track = stream.getVideoTracks()[0];
        // create video element to snapshot
        const video = document.createElement("video");
        video.srcObject = stream;
        await video.play();
        // wait a bit for frame
        await new Promise(r => setTimeout(r, 200));
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
      } else {
        toast("Screen capture not supported in this browser");
      }
    } catch (e: any) {
      if (e?.name === "NotAllowedError") toast("Capture cancelled");
      else toast("Capture failed: " + String(e?.message ?? e));
    }
  };

  // global paste + hotkeys when capture tab active
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

  // cleanup blob urls on unmount
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
    return best?.regionName ?? best?.superRegionName ?? null;
  };

  const generateTitle = () => {
    if (!effectiveAgent || !effectiveMap) { toast("Select map and agent first"); return; }
    const abilitySlot = Array.from(store.selectedAbilities)[0] as any ?? "Ability1";
    const agentAb = effectiveAgent.abilities?.find(a => a.slot === abilitySlot);
    const abilityName = agentAb?.displayName ?? abilitySlot;
    const mapName = effectiveMap.displayName;
    // try callouts for pins
    const startName = nearestCallout(startPin, effectiveMap);
    const endName = nearestCallout(endPin, effectiveMap);
    let suffix = "";
    if (startName || endName) {
      if (startName && endName && startName !== endName) suffix = ` ${startName} → ${endName}`;
      else if (endName) suffix = ` to ${endName}`;
      else if (startName) suffix = ` from ${startName}`;
    } else if (startPin && endPin) {
      suffix = "";
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
    // attach slot references
    const slotToMediaKey: Record<SlotId, string> = { stand: "standImage", aim: "aimImage", landing: "landingImage" };
    for (const sid of Object.keys(slotData) as SlotId[]) {
      const entry = slotData[sid];
      if (entry) {
        const assetName = `${sid}.png`;
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
      // keep images? clear for next
      // don't clear slotData automatically, let user keep
      onCreated?.();
      setActive("capture");
    } catch (e:any) { toast("Save failed: "+String(e)); }
  };

  // preview lineups for minimap
  const previewLineups = (() => {
    if (!startPin || !endPin) return [];
    return [{ id: "preview", title, mapUuid: effectiveMap?.uuid, agentUuid: effectiveAgent?.uuid, abilitySlot: Array.from(store.selectedAbilities)[0] ?? "Ability1", side: store.side, start: startPin, end: endPin, bounces: [], importance: Array.from(store.importance)[0] ?? "useful", difficulty: Array.from(store.difficulty)[0] ?? "normal", throwType: "Standing" } as any];
  })();

  const currentSlotData = slotData[selectedSlot];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0F1114]">
      {/* Slots at top, full width — visible in capture mode */}
      {active === "capture" && (
        <div className="shrink-0 p-2 bg-[#14181F] border-b border-borderSubtle">
          <div className="flex gap-2">
            {slotDefs.map(s=> {
              const isSel = selectedSlot===s.id;
              const hasImg = !!slotData[s.id];
              return (
                <button key={s.id} onClick={()=>setSelectedSlot(s.id)} className={`flex-1 rounded-md border p-2 text-left flex items-center gap-2 ${isSel?"border-accent bg-panel":"border-borderSubtle bg-[#1B1B1F] hover:bg-panel"}`}>
                  <div className={`w-9 h-9 rounded bg-[#07080A] border flex items-center justify-center shrink-0 ${isSel?"border-accent":"border-borderSubtle"} ${hasImg?"border-green-500":""}`}>
                    {hasImg ? <span className="text-green-500 text-xs">✓</span> : <span className="text-muted text-lg">◎</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-textPrimary flex items-center gap-1">{s.label} {hasImg && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}</div>
                    <div className="text-[10px] text-muted">{s.hotkey}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {active === "capture" ? (
        <div className="flex-1 flex flex-col min-h-0 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-textPrimary tracking-widest">{selectedSlot.toUpperCase()}</span>
            <span className="px-2 py-0.5 rounded bg-[#0ea5e9] text-white text-[10px] font-bold">◎ ALT+{selectedSlot==="stand"?1:selectedSlot==="aim"?2:3}</span>
            <div className="ml-auto flex items-center gap-2">
              {currentSlotData && (
                <button onClick={()=>{ if (currentSlotData) URL.revokeObjectURL(currentSlotData.url); setSlotData(prev=>({...prev,[selectedSlot]:null})); }} className="px-2 py-1 rounded bg-tile border border-borderSubtle text-muted text-xs hover:text-textPrimary">Clear</button>
              )}
              <button onClick={()=>fileInputRef.current?.click()} className="w-7 h-7 rounded-md bg-tile border border-borderSubtle flex items-center justify-center text-muted hover:text-textPrimary" title="Browse files">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15l3 3 3-3"/></svg>
              </button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e=>{ handleFiles(e.target.files); if (e.target) e.target.value=""; }} />

          <div
            onClick={()=>{ if (!currentSlotData) captureScreen(); }}
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{ e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className={`flex-1 rounded-lg border border-dashed bg-[#0B0E14] flex flex-col items-center justify-center p-4 min-h-0 relative overflow-hidden ${currentSlotData ? "border-green-500/40 p-0" : "border-[#2A3A4A] cursor-pointer hover:bg-[#0F1420]"}`}
          >
            {currentSlotData ? (
              <>
                <img src={currentSlotData.url} alt={`${selectedSlot} preview`} className="w-full h-full object-contain" draggable={false} />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                  <button onClick={(e)=>{ e.stopPropagation(); captureScreen(); }} className="px-3 py-1.5 rounded-md bg-black/60 backdrop-blur text-white text-xs font-bold border border-white/20">Retake</button>
                  <button onClick={(e)=>{ e.stopPropagation(); fileInputRef.current?.click(); }} className="px-3 py-1.5 rounded-md bg-black/60 backdrop-blur text-white text-xs font-bold border border-white/20">Browse</button>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-[#0ea5e9]/20 flex items-center justify-center mb-3"><span className="text-[#0ea5e9] text-2xl">◎</span></div>
                <p className="text-sm font-extrabold tracking-widest text-white">PRESS ALT+P IN VALORANT</p>
                <p className="text-xs text-muted mt-1">Or click • Drop • Paste (Ctrl+V)</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={(e)=>{ e.stopPropagation(); captureScreen(); }} className="px-5 py-2 rounded-md bg-accent text-white text-xs font-bold min-h-[40px]">Capture (Alt+P)</button>
                  <button onClick={(e)=>{ e.stopPropagation(); fileInputRef.current?.click(); }} className="px-4 py-2 rounded-md bg-tile border border-borderSubtle text-textPrimary text-xs font-bold min-h-[40px]">Browse</button>
                </div>
                <p className="text-[10px] text-muted mt-2">Drop image or paste with Ctrl+V</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-auto thin-scrollbar">
          <div className="shrink-0">
            <label className="text-[10px] font-bold tracking-widest text-muted">TITLE *</label>
            <div className="mt-1 flex gap-2">
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="E.g. Sova dart for A site" className="flex-1 min-h-[44px] px-3 rounded-md bg-panel border border-borderSubtle text-textPrimary text-sm placeholder:text-muted" />
              <button onClick={generateTitle} className="shrink-0 px-3 min-h-[44px] rounded-md bg-tile border border-borderSubtle text-textPrimary text-xs font-bold hover:bg-panel flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l2.4 7.2H22l-6.3 4.6 2.4 7.2L12 16.6 5.9 21l2.4-7.2L2 9.2h7.6z"/><path d="M12 8v4l2 2"/></svg>
                Auto
              </button>
            </div>
          </div>

          <div className="flex-1 rounded-lg border border-borderSubtle bg-panel overflow-hidden flex flex-col min-h-[360px]">
            <div className="px-3 py-2 border-b border-borderSubtle flex items-center justify-between bg-[#1B1B1F]">
              <h3 className="text-sm font-bold text-textPrimary">Map Pins</h3>
              <div className="flex gap-1.5">
                <button onClick={()=>setActivePin("start")} className={`px-3 py-1.5 rounded-md text-xs font-bold border ${activePin==="start" ? "bg-accent text-white border-accent" : "bg-tile text-muted border-borderSubtle hover:text-textPrimary"}`}>Start {startPin ? "✓" : ""}</button>
                <button onClick={()=>setActivePin("end")} className={`px-3 py-1.5 rounded-md text-xs font-bold border ${activePin==="end" ? "bg-accent text-white border-accent" : "bg-tile text-muted border-borderSubtle hover:text-textPrimary"}`}>End {endPin ? "✓" : ""}</button>
                <button onClick={()=>{ setPinZoom(1); setPinPan({x:0,y:0}); }} className="px-2 py-1.5 rounded-md bg-tile border border-borderSubtle text-xs text-muted hover:text-textPrimary">Reset</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-[#131315] overflow-hidden flex flex-col relative">
              {effectiveMap ? (
                <>
                  <div className="flex-1 min-h-0 flex flex-col">
                    <Minimap map={effectiveMap} lineups={previewLineups} agentsMap={agentsMap} hoveredId={null} setHoveredId={()=>{}} selectedId={null} onSelect={()=>{}} zoom={pinZoom} pan={pinPan} onZoom={setPinZoom} onPan={setPinPan} showEmpty={false} onMapClick={handleMapClick} />
                  </div>
                  {!startPin && activePin==="start" && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full pointer-events-none z-10">Click map to place start pin</div>
                  )}
                  {startPin && !endPin && activePin==="end" && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full pointer-events-none z-10">Click map to place end pin</div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted text-sm">Select a map</div>
              )}
            </div>
          </div>

          <button onClick={handleSave} className="shrink-0 w-full min-h-[48px] rounded-md bg-accent hover:bg-accentHover text-white font-bold">Save lineup</button>
        </div>
      )}
    </div>
  );
}
