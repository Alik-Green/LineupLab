import { useState, useMemo } from "react";
import type { ValorantAgent, ValorantMap } from "../types/lineup";
import Minimap from "./Minimap";
import type { Side } from "../types/lineup";
import { putLineup } from "../lib/indexedDBRepository";
import { useAppStore } from "../stores/appStore";

type TabId = "capture" | "setup";

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

  const [selectedSlot, setSelectedSlot] = useState<"stand"|"aim"|"landing">("stand");
  const [title, setTitle] = useState("");
  const [pinZoom, setPinZoom] = useState(1);
  const [pinPan, setPinPan] = useState({ x: 0, y: 0 });
  const [startPin, setStartPin] = useState<{x:number,y:number}|null>(null);
  const [endPin, setEndPin] = useState<{x:number,y:number}|null>(null);
  const [activePin, setActivePin] = useState<"start"|"end">("start");

  const store = useAppStore();
  const effectiveMap = selectedMapOverride ?? maps[0];
  const effectiveAgent = selectedAgentOverride ?? agents[0];

  const agentsMap = useMemo(() => {
    const m = new Map<string, any>();
    agents.forEach(a => m.set(a.uuid, a));
    return m;
  }, [agents]);

  const toast = (msg: string) => {
    const el = document.createElement("div");
    el.textContent = msg;
    el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 bg-panel border border-borderSubtle text-textPrimary px-4 py-2 rounded-md shadow-xl z-50 text-sm";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  };

  const slotDefs = [
    { id: "stand" as const, label: "1. STAND", hotkey: "ALT+1" },
    { id: "aim" as const, label: "2. AIM", hotkey: "ALT+2" },
    { id: "landing" as const, label: "3. LANDING", hotkey: "ALT+3" },
  ];

  const handleMapClick = (pt: {x:number,y:number}) => {
    if (active !== "setup") return;
    if (activePin === "start") setStartPin(pt);
    else setEndPin(pt);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast("Title is required"); return; }
    if (!effectiveMap || !effectiveAgent) { toast("Map and agent required"); return; }
    if (!startPin || !endPin) { toast("Place both start and end pins on map"); return; }
    const abilitySlot = Array.from(store.selectedAbilities)[0] as any ?? "Ability1";
    const importance = Array.from(store.importance)[0] as any ?? "useful";
    const difficulty = Array.from(store.difficulty)[0] as any ?? "normal";
    const newLineup: any = {
      id: `user-${Date.now().toString(36)}`,
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
    try {
      await putLineup(newLineup);
      toast("Lineup saved");
      setTitle(""); setStartPin(null); setEndPin(null);
      onCreated?.();
    } catch (e:any) { toast("Save failed: "+String(e)); }
  };

  // Create preview lineups for minimap display of pins
  const previewLineups = (() => {
    if (!startPin || !endPin) return [];
    return [{ id: "preview", title, mapUuid: effectiveMap?.uuid, agentUuid: effectiveAgent?.uuid, abilitySlot: Array.from(store.selectedAbilities)[0] ?? "Ability1", side: store.side, start: startPin, end: endPin, bounces: [], importance: Array.from(store.importance)[0] ?? "useful", difficulty: Array.from(store.difficulty)[0] ?? "normal", throwType: "Standing" } as any];
  })();

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0F1114]">
      {/* Slots at top, full width — visible in capture mode */}
      {active === "capture" && (
        <div className="shrink-0 p-2 bg-[#14181F] border-b border-borderSubtle">
          <div className="flex gap-2">
            {slotDefs.map(s=> {
              const isSel = selectedSlot===s.id;
              return (
                <button key={s.id} onClick={()=>setSelectedSlot(s.id)} className={`flex-1 rounded-md border p-2 text-left flex items-center gap-2 ${isSel?"border-accent bg-panel":"border-borderSubtle bg-[#1B1B1F] hover:bg-panel"}`}>
                  <div className="w-9 h-9 rounded bg-[#07080A] border border-borderSubtle flex items-center justify-center shrink-0">
                    <span className="text-muted text-lg">◎</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-textPrimary">{s.label}</div>
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
            <button onClick={()=>toast("File picker — coming soon with image upload")} className="ml-auto w-7 h-7 rounded-md bg-tile border border-borderSubtle flex items-center justify-center text-muted">📁</button>
          </div>
          <div onClick={()=>toast("Capture — Alt+P will capture Valorant window (coming soon)")} onDragOver={e=>e.preventDefault()} onDrop={e=>{ e.preventDefault(); toast("Drop image — coming soon"); }} className="flex-1 rounded-lg border border-dashed border-[#2A3A4A] bg-[#0B0E14] flex flex-col items-center justify-center p-6 min-h-0 cursor-pointer hover:bg-[#0F1420]">
            <div className="w-12 h-12 rounded-full bg-[#0ea5e9]/20 flex items-center justify-center mb-3"><span className="text-[#0ea5e9] text-2xl">◎</span></div>
            <p className="text-sm font-extrabold tracking-widest text-white">PRESS ALT+P IN VALORANT</p>
            <p className="text-xs text-muted mt-1">Or click • Drop • Paste (Ctrl+V)</p>
            <div className="mt-4 flex gap-2">
              <button onClick={(e)=>{ e.stopPropagation(); toast("Capture — coming soon"); }} className="px-5 py-2 rounded-md bg-accent text-white text-xs font-bold min-h-[40px]">Capture (Alt+P)</button>
              <button onClick={(e)=>{ e.stopPropagation(); toast("Paste — coming soon"); }} className="px-4 py-2 rounded-md bg-tile border border-borderSubtle text-textPrimary text-xs font-bold min-h-[40px]">Paste</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-auto thin-scrollbar">
          <div className="shrink-0">
            <label className="text-[10px] font-bold tracking-widest text-muted">TITLE *</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="E.g. Sova dart for A site" className="mt-1 w-full min-h-[44px] px-3 rounded-md bg-panel border border-borderSubtle text-textPrimary text-sm placeholder:text-muted" />
          </div>

          <div className="flex-1 rounded-lg border border-borderSubtle bg-panel overflow-hidden flex flex-col min-h-[320px]">
            <div className="px-3 py-2 border-b border-borderSubtle flex items-center justify-between bg-[#1B1B1F]">
              <h3 className="text-sm font-bold text-textPrimary">Map Pins</h3>
              <div className="flex gap-1.5">
                <button onClick={()=>setActivePin("start")} className={`px-3 py-1.5 rounded-md text-xs font-bold border ${activePin==="start" ? "bg-accent text-white border-accent" : "bg-tile text-muted border-borderSubtle hover:text-textPrimary"}`}>Start {startPin ? "✓" : ""}</button>
                <button onClick={()=>setActivePin("end")} className={`px-3 py-1.5 rounded-md text-xs font-bold border ${activePin==="end" ? "bg-accent text-white border-accent" : "bg-tile text-muted border-borderSubtle hover:text-textPrimary"}`}>End {endPin ? "✓" : ""}</button>
                <button onClick={()=>{ setPinZoom(1); setPinPan({x:0,y:0}); }} className="px-2 py-1.5 rounded-md bg-tile border border-borderSubtle text-xs text-muted hover:text-textPrimary">Reset</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative bg-[#131315] overflow-hidden">
              <Minimap map={effectiveMap} lineups={previewLineups} agentsMap={agentsMap} hoveredId={null} setHoveredId={()=>{}} selectedId={null} onSelect={()=>{}} zoom={pinZoom} pan={pinPan} onZoom={setPinZoom} onPan={setPinPan} showEmpty={false} onMapClick={handleMapClick} />
              {!startPin && activePin==="start" && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full pointer-events-none">Click map to place start pin</div>
              )}
              {startPin && !endPin && activePin==="end" && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full pointer-events-none">Click map to place end pin</div>
              )}
            </div>
          </div>

          <button onClick={handleSave} className="shrink-0 w-full min-h-[48px] rounded-md bg-accent hover:bg-accentHover text-white font-bold">Save lineup</button>
        </div>
      )}
    </div>
  );
}
