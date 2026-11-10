import { useState, useMemo } from "react";
import type { ValorantAgent, ValorantMap } from "../types/lineup";
import Minimap from "./Minimap";
import type { Side } from "../types/lineup";

type TabId = "capture" | "setup";

export default function CreateWizard({
  agents,
  maps,
  hideChrome,
  selectedMapOverride,
  selectedAgentOverride,
}: {
  agents: ValorantAgent[];
  maps: ValorantMap[];
  hideChrome?: boolean;
  selectedMapOverride?: ValorantMap | null;
  selectedAgentOverride?: ValorantAgent | null;
  sideOverride?: Side;
}) {
  const [active, setActive] = useState<TabId>("capture");
  const [selectedSlot, setSelectedSlot] = useState<"stand"|"aim"|"landing">("stand");
  const [title, setTitle] = useState("");
  const [pinZoom, setPinZoom] = useState(1);
  const [pinPan, setPinPan] = useState({ x: 0, y: 0 });

  const effectiveMap = selectedMapOverride ?? maps[0];
  // agent not directly used except for abilities slice if needed

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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0F1114]">
      {/* Top tabs */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-[#1B1B1F] border-b border-borderSubtle">
        <div className="flex gap-2">
          {(["capture","setup"] as TabId[]).map(t=> (
            <button key={t} onClick={()=>setActive(t)} className={`h-8 px-4 rounded-md text-xs font-bold tracking-wide border uppercase ${active===t?"bg-accent border-accent text-white":"bg-tile border-borderSubtle text-muted hover:text-textPrimary"}`}>
              {t === "capture" ? "Capture" : "Setup"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={()=>toast("Coming soon — saving will go live next release")} className="h-8 px-4 rounded-md bg-accent text-white text-xs font-bold">SAVE</button>
        </div>
      </div>

      {active === "capture" ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Slots at top, full width */}
          <div className="shrink-0 p-2 bg-[#0F1114] border-b border-borderSubtle">
            <div className="flex gap-2">
              {slotDefs.map(s=> {
                const isSel = selectedSlot===s.id;
                return (
                  <button key={s.id} onClick={()=>setSelectedSlot(s.id)} className={`flex-1 rounded-md border-2 p-2 text-left flex items-center gap-2 ${isSel?"border-accent bg-panel":"border-borderSubtle bg-[#1A1E24] hover:bg-panel"}`}>
                    <div className="w-10 h-10 rounded bg-[#07080A] border border-borderSubtle flex items-center justify-center shrink-0">
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

          {/* Capture full width */}
          <div className="flex-1 flex flex-col min-h-0 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-textPrimary tracking-widest">{selectedSlot.toUpperCase()}</span>
              <span className="px-2 py-0.5 rounded bg-[#0ea5e9] text-white text-[10px] font-bold">◎ ALT+{selectedSlot==="stand"?1:selectedSlot==="aim"?2:3}</span>
              <button onClick={()=>toast("Coming soon")} className="ml-auto w-7 h-7 rounded-md bg-tile border border-borderSubtle flex items-center justify-center text-muted">📁</button>
            </div>
            <div onClick={()=>toast("Coming soon — Alt+P capture")} onDragOver={e=>e.preventDefault()} onDrop={e=>{ e.preventDefault(); toast("Drop image — Coming soon"); }} className="flex-1 rounded-md border border-dashed border-[#2A3A4A] bg-[#0B0E14] flex flex-col items-center justify-center p-6 min-h-0 cursor-pointer hover:bg-[#0F1420]">
              <div className="w-12 h-12 rounded-full bg-[#0ea5e9]/20 flex items-center justify-center mb-3"><span className="text-[#0ea5e9] text-2xl">◎</span></div>
              <p className="text-sm font-extrabold tracking-widest text-white">PRESS ALT+P IN VALORANT</p>
              <p className="text-xs text-muted mt-1">Or click • Drop • Paste (Ctrl+V)</p>
              <div className="mt-4 flex gap-2">
                <button onClick={(e)=>{ e.stopPropagation(); toast("Capture — Coming soon"); }} className="px-5 py-2 rounded-md bg-accent text-white text-xs font-bold min-h-[40px]">Capture (Alt+P)</button>
                <button onClick={(e)=>{ e.stopPropagation(); toast("Paste — Coming soon"); }} className="px-4 py-2 rounded-md bg-tile border border-borderSubtle text-textPrimary text-xs font-bold min-h-[40px]">Paste</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Setup = Pins + Title combined */
        <div className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-auto thin-scrollbar">
          <div className="shrink-0">
            <label className="text-[10px] font-bold tracking-widest text-muted">TITLE</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Lineup title (e.g. Sova dart for A site)" className="mt-1 w-full min-h-[44px] px-3 rounded-md bg-tile border border-borderSubtle text-textPrimary text-sm" />
          </div>
          <div className="flex-1 rounded-md border border-borderSubtle bg-panel overflow-hidden flex flex-col min-h-[300px]">
            <div className="p-3 border-b border-borderSubtle flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-textPrimary">Map Pins</h3>
                <p className="text-xs text-muted">Click to place start / end / bounces</p>
              </div>
              <button onClick={()=>{ setPinZoom(1); setPinPan({x:0,y:0}); }} className="px-3 py-1.5 rounded bg-tile border border-borderSubtle text-xs text-muted">Reset view</button>
            </div>
            <div className="flex-1 min-h-0 relative bg-[#131315] overflow-hidden flex flex-col">
              <Minimap map={effectiveMap} lineups={[]} agentsMap={agentsMap} hoveredId={null} setHoveredId={()=>{}} selectedId={null} onSelect={()=>{}} zoom={pinZoom} pan={pinPan} onZoom={setPinZoom} onPan={setPinPan} showEmpty={false} />
            </div>
          </div>
          <button onClick={()=>toast("Save — Coming soon")} className="shrink-0 w-full min-h-[48px] rounded-md bg-accent text-white font-bold">Save lineup (Coming soon)</button>
        </div>
      )}
    </div>
  );
}
