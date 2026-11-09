import { useState, useMemo } from "react";
import type { ValorantAgent, ValorantMap } from "../types/lineup";
import MapCard from "./MapCard";
import AgentCard from "./AgentCard";
import SideToggle from "./SideToggle";
import Minimap from "./Minimap";
import type { Side } from "../types/lineup";

type TabId = "capture" | "pins" | "details";

export default function CreateWizard({ agents, maps }: { agents: ValorantAgent[]; maps: ValorantMap[] }) {
  const [active, setActive] = useState<TabId>("capture");
  const [selectedSlot, setSelectedSlot] = useState<"stand"|"aim"|"landing">("stand");
  const [selectedMapUuid, setSelectedMapUuid] = useState<string>(maps[0]?.uuid ?? "");
  const [selectedAgentUuid, setSelectedAgentUuid] = useState<string>(agents[0]?.uuid ?? "");
  const [side, setSide] = useState<Side>("attack");
  const [pinZoom, setPinZoom] = useState(1);
  const [pinPan, setPinPan] = useState({ x: 0, y: 0 });

  const selectedMap = useMemo(() => maps.find(m => m.uuid === selectedMapUuid), [maps, selectedMapUuid]);
  const agent = useMemo(() => agents.find(a=>a.uuid===selectedAgentUuid), [agents, selectedAgentUuid]);

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
      {/* Top bar with shared selectors */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-[#1A1E24] border-b border-[#2A2B32] flex-wrap">
        <div className="w-[160px] flex gap-2">
          <MapCard maps={maps} selectedMap={selectedMap} onSelect={setSelectedMapUuid} />
          <AgentCard agents={agents} selectedAgent={agent as any} onSelect={(uuid) => setSelectedAgentUuid(uuid || (agents[0]?.uuid ?? ""))} />
        </div>
        <div className="w-[160px]">
          <SideToggle side={side} onSideChange={setSide} />
        </div>
        <div className="flex gap-1">
          {(agent?.abilities.slice(0,4) ?? []).map((ab,i)=> (
            <button key={i} onClick={()=>toast("Coming soon")} className={`w-8 h-8 rounded-md bg-tile border flex items-center justify-center ${i===1?"border-accent bg-accent/20":"border-borderSubtle"}`}>
              {ab.displayIcon ? <img src={ab.displayIcon} alt="" className="w-5 h-5 object-contain" /> : <span className="text-[10px] text-muted">{ab.slot[0]}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-2">
          {(["capture","pins","details"] as TabId[]).map(t=> (
            <button key={t} onClick={()=>setActive(t)} className={`h-8 px-3 rounded-md text-xs font-bold tracking-wide border uppercase ${active===t?"bg-accent border-accent text-white":"bg-tile border-borderSubtle text-muted hover:text-textPrimary"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={()=>toast("Coming soon")} className="h-8 px-3 rounded-md bg-tile border border-borderSubtle text-textPrimary text-xs font-bold">✦ SAVE + NEXT</button>
          <button onClick={()=>toast("Coming soon — save will store to IndexedDB in next release")} className="h-8 px-4 rounded-md bg-accent text-white text-xs font-bold">SAVE</button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="w-[160px] shrink-0 bg-[#0F1114] border-r border-borderSubtle p-2 flex flex-col gap-2 overflow-auto thin-scrollbar">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-muted">SLOTS [ALT+P]</span>
          </div>
          {slotDefs.map(s=> {
            const isSel = selectedSlot===s.id;
            return (
              <button key={s.id} onClick={()=>setSelectedSlot(s.id)} className={`rounded-md border-2 p-1.5 text-left flex flex-col gap-1 ${isSel?"border-accent bg-panel":"border-borderSubtle bg-[#1A1E24] hover:bg-panel"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-textPrimary">{s.label}</span>
                  <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#0ea5e9] text-white">{s.hotkey}</span>
                </div>
                <div className="h-[88px] rounded bg-[#07080A] border border-borderSubtle flex items-center justify-center">
                  <span className="text-muted text-lg">◎</span>
                </div>
              </button>
            );
          })}
          <div className="mt-auto text-[10px] text-muted text-center pt-2">Slots show in capture view</div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-[#0F1114] p-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-textPrimary tracking-widest">{selectedSlot.toUpperCase()}</span>
            <span className="px-2 py-0.5 rounded bg-[#0ea5e9] text-white text-[10px] font-bold flex items-center gap-1">◎ ALT+{selectedSlot==="stand"?1:selectedSlot==="aim"?2:3}</span>
            <button onClick={()=>toast("Coming soon")} className="w-7 h-7 rounded-md bg-tile border border-borderSubtle flex items-center justify-center text-muted">📁</button>
          </div>

          {active==="capture" && (
            <div onClick={()=>toast("Coming soon — capture will use Alt+P hotkey or click/drop/paste")} onDragOver={e=>e.preventDefault()} onDrop={(e)=>{ e.preventDefault(); toast("Drop image — Coming soon"); }} className="flex-1 rounded-md border border-dashed border-[#2A3A4A] bg-[#0B0E14] flex flex-col items-center justify-center p-6 min-h-0 cursor-pointer hover:bg-[#0F1420]">
              <div className="w-10 h-10 rounded-full bg-[#0ea5e9]/20 flex items-center justify-center mb-3">
                <span className="text-[#0ea5e9] text-xl">◎</span>
              </div>
              <p className="text-sm font-extrabold tracking-widest text-white">PRESS ALT+P IN VALORANT</p>
              <p className="text-xs text-muted mt-1">Or click here to capture • Drop image • Paste (Ctrl+V)</p>
              <div className="mt-4 flex gap-2">
                <button onClick={(e)=>{ e.stopPropagation(); toast("Capture — Coming soon"); }} className="px-4 py-2 rounded-md bg-accent text-white text-xs font-bold min-h-[40px]">Capture (Alt+P)</button>
                <button onClick={(e)=>{ e.stopPropagation(); toast("Paste image — Coming soon"); }} className="px-4 py-2 rounded-md bg-tile border border-borderSubtle text-textPrimary text-xs font-bold min-h-[40px]">Paste</button>
              </div>
            </div>
          )}
          {active==="pins" && (
            <div className="flex-1 rounded-md border border-borderSubtle bg-panel overflow-hidden flex flex-col min-h-0">
              <div className="p-3 border-b border-borderSubtle">
                <h3 className="text-sm font-bold text-textPrimary">Map Pins</h3>
                <p className="text-xs text-muted">Place start, end and bounces on the minimap.</p>
              </div>
              <div className="flex-1 min-h-[300px] relative bg-[#131315] overflow-hidden flex flex-col">
                <Minimap
                  map={selectedMap}
                  lineups={[]}
                  agentsMap={agentsMap}
                  hoveredId={null}
                  setHoveredId={() => {}}
                  selectedId={null}
                  onSelect={() => {}}
                  zoom={pinZoom}
                  pan={pinPan}
                  onZoom={setPinZoom}
                  onPan={setPinPan}
                />
              </div>
            </div>
          )}
          {active==="details" && (
            <div className="flex-1 rounded-md border border-borderSubtle bg-panel p-4 flex flex-col gap-3 overflow-auto thin-scrollbar">
              <h3 className="text-sm font-bold text-textPrimary">Details</h3>
              <input placeholder="Lineup title" className="w-full min-h-[48px] px-3 rounded-md bg-tile border border-borderSubtle text-textPrimary text-sm" onFocus={()=>toast("Coming soon")} />
              <textarea placeholder="Notes / steps" rows={4} className="w-full px-3 py-2 rounded-md bg-tile border border-borderSubtle text-textPrimary text-sm" onFocus={()=>toast("Coming soon")} />
              <div className="grid grid-cols-2 gap-2">
                <select className="min-h-[48px] px-3 rounded-md bg-tile border border-borderSubtle text-textPrimary text-sm" onChange={()=>toast("Coming soon")}><option>Difficulty</option><option>easy</option><option>normal</option><option>hard</option></select>
                <select className="min-h-[48px] px-3 rounded-md bg-tile border border-borderSubtle text-textPrimary text-sm" onChange={()=>toast("Coming soon")}><option>Importance</option><option>essential</option><option>useful</option><option>optional</option></select>
              </div>
              <button onClick={()=>toast("Coming soon — save will store to IndexedDB")} className="w-full min-h-[48px] rounded-md bg-accent text-white font-bold">Save lineup (Coming soon)</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
