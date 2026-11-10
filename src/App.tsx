import { useEffect, useMemo, useState, useRef } from "react";
import TopBar from "./components/TopBar";
import MapCard from "./components/MapCard";
import AgentCard from "./components/AgentCard";
import SideToggle from "./components/SideToggle";
import AbilityBar from "./components/AbilityBar";
import FiltersCardCollapsible from "./components/FiltersCardCollapsible";
import Minimap from "./components/Minimap";
import LineupListView from "./components/LineupListView";
import DetailPanel from "./components/DetailPanel";
import LoadingScreen from "./components/LoadingScreen";
import CreateWizard from "./components/CreateWizard";
import ImportDialog from "./components/ImportDialog";
import ExportDialog from "./components/ExportDialog";
import LANShare from "./components/LANShare";
import OverlayHost from "./components/OverlayHost";
import { useValorantData } from "./hooks/useValorantData";
import { useAppStore } from "./stores/appStore";
import { getAllLineups, removeDemoData, seedDemoIfEmpty, deleteLineup } from "./lib/indexedDBRepository";
import { filterLineups } from "./lib/filtering";
import type { Lineup } from "./types/lineup";

type Tab = "lineups" | "create";

function LeftSidebar({ maps, agents, selectedMap, selectedAgent, store, lineupsCount, singleSelect }: any) {
  const onAbilityToggle = singleSelect ? (slot: any) => store.setSingleAbility(slot) : (slot: any) => store.toggleAbility(slot);
  const onImpToggle = singleSelect ? (v: any) => store.setSingleImportance(v) : (v: any) => store.toggleImportance(v);
  const onDiffToggle = singleSelect ? (v: any) => store.setSingleDifficulty(v) : (v: any) => store.toggleDifficulty(v);
  return (
    <>
      <div className="shrink-0 flex gap-2">
        <MapCard maps={maps} selectedMap={selectedMap} onSelect={(uuid: string) => store.setMap(uuid)} />
        <AgentCard agents={agents} selectedAgent={selectedAgent} onSelect={(uuid: string) => { if (!uuid) store.setAgent(null); else store.setAgent(uuid); }} />
      </div>
      <div className="shrink-0">
        <SideToggle side={store.side} onSideChange={(s: any) => store.setSide(s)} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
        <AbilityBar agent={selectedAgent} selected={store.selectedAbilities} onToggle={onAbilityToggle} singleSelect={singleSelect} />
        <FiltersCardCollapsible
          importance={store.importance}
          difficulty={store.difficulty}
          onToggleImportance={onImpToggle}
          onToggleDifficulty={onDiffToggle}
          onReset={() => store.resetFilters()}
        />
      </div>
      <div className="shrink-0 text-muted text-[10px] text-center py-1">{lineupsCount} lineups</div>
    </>
  );
}

export default function App() {
  const { agents, maps, loading, error, retry } = useValorantData();
  const [lineups, setLineups] = useState<Lineup[] | null>(null);
  const [lineupsError, setLineupsError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("lineups");
  const [importOpen, setImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [createMode, setCreateMode] = useState<"capture" | "setup">("capture");
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [lanOpen, setLanOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayIdx, setOverlayIdx] = useState(0);

  const store = useAppStore();

  useEffect(() => { store.hydrateFromStorage(); }, []);
  useEffect(() => {
    const handler = () => store.resetFilters();
    window.addEventListener("reset-filters", handler as any);
    return () => window.removeEventListener("reset-filters", handler as any);
  }, []);

  const refreshLineups = async () => {
    try {
      await seedDemoIfEmpty();
      const data = await getAllLineups();
      setLineups(data as any);
    } catch (e: any) { setLineupsError(String(e)); }
  };
  useEffect(() => { refreshLineups(); }, []);
  useEffect(() => { if (!importOpen) refreshLineups(); }, [importOpen]);

  useEffect(() => {
    if (maps && maps.length > 0 && !store.selectedMapUuid) {
      const corrode = maps.find((m) => m.displayName.toLowerCase().includes("corrode"));
      store.setMap((corrode ?? maps[0]).uuid);
    }
  }, [maps]);

  const filtersSnapshot = useRef<{ abilities: Set<any>; importance: Set<any>; difficulty: Set<any> } | null>(null);
  // When entering create, enforce single-select: collapse multi-selects to last selected (or first) and snapshot for restore
  useEffect(() => {
    if (activeTab === "create") {
      if (!filtersSnapshot.current) {
        filtersSnapshot.current = {
          abilities: new Set(store.selectedAbilities),
          importance: new Set(store.importance),
          difficulty: new Set(store.difficulty),
        };
      }
      if (store.selectedAbilities.size > 1) {
        const arr = Array.from(store.selectedAbilities);
        store.setSingleAbility(arr[arr.length - 1] as any);
      }
      if (store.importance.size > 1) {
        const arr = Array.from(store.importance);
        store.setSingleImportance(arr[arr.length - 1] as any);
      }
      if (store.difficulty.size > 1) {
        const arr = Array.from(store.difficulty);
        store.setSingleDifficulty(arr[arr.length - 1] as any);
      }
    } else {
      if (filtersSnapshot.current) {
        store.restoreFilters(filtersSnapshot.current.abilities, filtersSnapshot.current.importance, filtersSnapshot.current.difficulty);
        filtersSnapshot.current = null;
      }
    }
  }, [activeTab]);

  const selectedMap = useMemo(() => maps?.find((m) => m.uuid === store.selectedMapUuid), [maps, store.selectedMapUuid]);
  const selectedAgent = useMemo(() => agents?.find((a) => a.uuid === store.selectedAgentUuid), [agents, store.selectedAgentUuid]);
  const agentsMap = useMemo(() => { const m = new Map(); agents?.forEach((a) => m.set(a.uuid, a)); return m; }, [agents]);

  const filtered = useMemo(() => {
    if (!lineups) return [];
    return filterLineups(lineups, {
      mapUuid: store.selectedMapUuid,
      side: store.side,
      agentUuid: store.selectedAgentUuid,
      abilitySlots: store.selectedAbilities,
      importance: store.importance,
      difficulty: store.difficulty,
    });
  }, [lineups, store.selectedMapUuid, store.side, store.selectedAgentUuid, store.selectedAbilities, store.importance, store.difficulty]);

  const selectedLineup = useMemo(() => filtered.find((l) => l.id === selectedId) ?? lineups?.find((l) => l.id === selectedId) ?? null, [filtered, lineups, selectedId]);

  useEffect(() => {
    if (settingsOpen || importOpen || mobileFiltersOpen || selectedLineup || shareOpen || exportOpen || lanOpen || overlayOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [settingsOpen, importOpen, mobileFiltersOpen, selectedLineup, shareOpen, exportOpen, lanOpen, overlayOpen]);

  // global Alt+O for overlay, Alt+E for export
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "o") { e.preventDefault(); if (selectedLineup || filtered.length>0) setOverlayOpen(v=>!v); }
      if (e.altKey && e.key.toLowerCase() === "e" && !e.ctrlKey) { e.preventDefault(); setExportOpen(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selectedLineup, filtered]);

  // Pip window mode: ?pip=1 in Tauri secondary window — show minimal pip view
  const isPipWindow = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pip") === "1";
  if (isPipWindow) {
    const pipLineup = filtered[0] ?? lineups?.[0] ?? null;
    if (!pipLineup) return <div className="h-screen flex items-center justify-center bg-[#0B0E14] text-muted text-sm p-4 text-center">No lineup — open a lineup in main window first.<br/>This PiP stays always-on-top above Valorant.</div>;
    return (
      <div className="h-screen flex flex-col bg-[#0B0E14] text-textPrimary overflow-hidden">
        <div className="h-8 shrink-0 flex items-center justify-between px-2 bg-[#1B1B1F] border-b border-borderSubtle" data-tauri-drag-region>
          <span className="text-xs font-bold truncate">{pipLineup.title}</span>
          <button onClick={()=>{ const w=(window as any).__TAURI__?.window?.getCurrentWindow?.(); w?.close?.(); window.close(); }} className="w-6 h-6 rounded bg-tile flex items-center justify-center text-muted">✕</button>
        </div>
        <div className="flex-1 bg-[#131315] flex items-center justify-center p-2">
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xs text-muted">PiP active — use main window to change lineup (Alt+O)</span>
          </div>
        </div>
        <div className="shrink-0 p-2 bg-panel border-t border-borderSubtle text-[10px] text-muted text-center">LineupLab PiP • Always on top • Drag title bar to move</div>
      </div>
    );
  }

  if (loading || !maps || !agents) return <LoadingScreen error={error} onRetry={retry} />;
  const showLineupsErrorBanner = !!lineupsError;

  return (
    <div className="h-[100dvh] h-screen flex flex-col overflow-hidden bg-pageBg" style={{ overscrollBehavior: "none" }}>
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSettings={() => setSettingsOpen((v) => !v)}
        onImport={() => setShareOpen(true)}
        onOverlay={() => setOverlayOpen(v=>!v)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        createMode={createMode}
        onCreateModeChange={setCreateMode}
      />
      {showLineupsErrorBanner && (
        <div className="mx-3 mt-2 p-2 rounded bg-accent/20 border border-accent text-accent text-xs flex items-center justify-between shrink-0">
          <span>Failed to load lineups: {lineupsError}</span>
          <button onClick={() => window.location.reload()} className="ml-3 px-3 py-1 rounded bg-accent text-white text-xs min-h-[40px]">Reload</button>
        </div>
      )}
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onImported={refreshLineups} />}
      {shareOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShareOpen(false)}>
          <div className="bg-panel border border-borderSubtle rounded-card w-full max-w-sm overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="p-4 border-b border-borderSubtle flex items-center justify-between">
              <h3 className="text-textPrimary font-bold">Share & Transfer</h3>
              <button onClick={()=>setShareOpen(false)} className="w-8 h-8 rounded bg-tile flex items-center justify-center text-muted">✕</button>
            </div>
            <div className="p-3 space-y-2">
              <button onClick={()=>{ setShareOpen(false); setImportOpen(true); }} className="w-full text-left px-3 py-3 rounded-md bg-tile hover:bg-tileHover border border-borderSubtle flex items-center gap-3">
                <span className="w-8 h-8 rounded bg-accent/20 flex items-center justify-center text-accent">↓</span>
                <div><div className="text-sm font-bold text-textPrimary">Import Pack</div><div className="text-xs text-muted">.zip with manifest + media</div></div>
              </button>
              <button onClick={()=>{ setShareOpen(false); setExportOpen(true); }} className="w-full text-left px-3 py-3 rounded-md bg-tile hover:bg-tileHover border border-borderSubtle flex items-center gap-3">
                <span className="w-8 h-8 rounded bg-accent/20 flex items-center justify-center text-accent">↑</span>
                <div><div className="text-sm font-bold text-textPrimary">Export</div><div className="text-xs text-muted">All / filtered / selected → v2 jpg zip</div></div>
              </button>
              <button onClick={()=>{ setShareOpen(false); setLanOpen(true); }} className="w-full text-left px-3 py-3 rounded-md bg-tile hover:bg-tileHover border border-borderSubtle flex items-center gap-3">
                <span className="w-8 h-8 rounded bg-accent/20 flex items-center justify-center text-accent">◉</span>
                <div><div className="text-sm font-bold text-textPrimary">LAN Share</div><div className="text-xs text-muted">Host / Join on local network (UI preview)</div></div>
              </button>
            </div>
          </div>
        </div>
      )}
      {exportOpen && <ExportDialog filtered={filtered} onClose={()=>setExportOpen(false)} />}
      {lanOpen && <LANShare onClose={()=>setLanOpen(false)} />}
      {overlayOpen && (
        <OverlayHost
          lineup={selectedLineup ?? filtered[overlayIdx % Math.max(1,filtered.length)] as any ?? lineups?.[0] as any ?? null}
          onClose={()=>setOverlayOpen(false)}
          onPrevLineup={()=> setOverlayIdx(i=> Math.max(0,i-1))}
          onNextLineup={()=> setOverlayIdx(i=> Math.min(filtered.length-1,i+1))}
        />
      )}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSettingsOpen(false)}>
          <div className="bg-panel border border-borderSubtle rounded-card p-5 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-auto space-y-3" onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-textPrimary font-bold text-lg">Settings</h3>
            <div className="rounded-md bg-tile border border-borderSubtle p-3">
              <p className="text-xs font-bold tracking-widest text-muted">APP</p>
              <p className="text-sm text-textPrimary mt-1">LineupLab v0.3.5 • Overlay PiP • LAN Share • Capture</p>
              <p className="text-xs text-muted mt-1">Data stored locally in IndexedDB. Export for backup.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={()=>{ setSettingsOpen(false); setExportOpen(true); }} className="px-3 py-1.5 rounded bg-accent text-white text-xs font-bold">Export backup</button>
                <button onClick={()=>{ setSettingsOpen(false); setImportOpen(true); }} className="px-3 py-1.5 rounded bg-tile border border-borderSubtle text-xs font-bold text-textPrimary">Import pack</button>
              </div>
            </div>
            <div className="rounded-md bg-tile border border-borderSubtle p-3">
              <p className="text-xs font-bold tracking-widest text-muted">OVERLAY</p>
              <p className="text-xs text-muted mt-1">Always-on-top PiP stays above Valorant. Alt+O toggle, Alt+M minimal, Alt+Q/E cycle.</p>
              <button onClick={()=>{ setSettingsOpen(false); if (filtered.length>0) setOverlayOpen(true); }} className="mt-2 w-full py-2 rounded bg-panel border border-borderSubtle text-xs font-bold text-textPrimary">Open Overlay</button>
            </div>
            <div className="rounded-md bg-tile border border-borderSubtle p-3">
              <p className="text-xs font-bold tracking-widest text-muted">LAN / COMPANION</p>
              <p className="text-xs text-muted mt-1">Host on desktop, scan QR with Android companion (same Wi-Fi). APK in Releases.</p>
              <button onClick={()=>{ setSettingsOpen(false); setLanOpen(true); }} className="mt-2 w-full py-2 rounded bg-panel border border-borderSubtle text-xs font-bold text-textPrimary">Open LAN Share</button>
            </div>
            <div className="rounded-md bg-pageBg border border-borderSubtle p-3">
              <p className="text-xs font-bold tracking-widest text-muted">DANGER ZONE</p>
              <button onClick={async () => { if (!confirm(`Delete all ${lineups?.length ?? 0} lineups?`)) return; await removeDemoData(); await refreshLineups(); setSettingsOpen(false); }} className="mt-2 w-full min-h-[40px] rounded bg-accent/20 hover:bg-accent/30 text-accent text-sm border border-accent/30 font-bold">Clear all lineups ({lineups?.length ?? 0})</button>
            </div>
            <div className="flex justify-end"><button onClick={() => setSettingsOpen(false)} className="px-4 py-2 rounded bg-tile text-textPrimary min-h-[40px]">Close</button></div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Shared left sidebar — matches lineups tabs left bar */}
        <aside className="hidden md:flex w-[350px] shrink-0 flex flex-col gap-2 p-2 bg-[#1B1B1F] border-r border-borderSubtle min-h-0 overflow-hidden">
          <LeftSidebar maps={maps} agents={agents} selectedMap={selectedMap} selectedAgent={selectedAgent} store={store} lineupsCount={lineups?.length ?? 0} singleSelect={activeTab === "create"} />
        </aside>

        {/* Mobile selectors */}
        <div className="md:hidden bg-pageBg border-b border-borderSubtle shrink-0 p-2 flex gap-2">
          <MapCard maps={maps} selectedMap={selectedMap} onSelect={(uuid) => store.setMap(uuid)} />
          <AgentCard agents={agents} selectedAgent={selectedAgent} onSelect={(uuid) => { if (!uuid) store.setAgent(null); else store.setAgent(uuid); }} />
        </div>
        <div className="md:hidden px-2 pb-2 bg-pageBg border-b border-borderSubtle">
          <SideToggle side={store.side} onSideChange={(s) => store.setSide(s)} />
        </div>

        {/* Right content */}
        {activeTab === "create" ? (
          <div className="flex-1 min-h-0 overflow-hidden bg-[#0F1114]">
            <CreateWizard agents={agents} maps={maps} createMode={createMode} onCreateModeChange={setCreateMode} selectedMapOverride={selectedMap} selectedAgentOverride={selectedAgent} sideOverride={store.side} onCreated={refreshLineups} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 min-w-0 relative bg-[#131315] overflow-hidden" style={{ touchAction: viewMode === "map" ? "none" as const : undefined }}>
            {viewMode === "map" ? (
              <Minimap map={selectedMap} lineups={filtered} agentsMap={agentsMap} hoveredId={hoveredId} setHoveredId={setHoveredId} selectedId={selectedId} onSelect={setSelectedId} zoom={store.zoom} pan={store.pan} onZoom={(z)=>store.setZoom(z)} onPan={(p)=>store.setPan(p)} />
            ) : (
              <LineupListView lineups={filtered} agentsMap={agentsMap} onSelect={setSelectedId} />
            )}
            <button onClick={() => setMobileFiltersOpen(true)} className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-3 rounded-md bg-panel border border-borderSubtle text-textPrimary font-bold shadow-xl min-h-[48px]">Filters • {filtered.length}</button>
            {selectedLineup && (
              <DetailPanel lineup={selectedLineup as any} agent={agentsMap.get(selectedLineup.agentUuid)} onClose={() => setSelectedId(null)} onDelete={async (id) => { await deleteLineup(id); await refreshLineups(); setSelectedId(null); }} onEdit={() => { setActiveTab("create"); setSelectedId(null); }} onOverlay={() => setOverlayOpen(true)} />
            )}
          </div>
        )}
      </div>

      {mobileFiltersOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileFiltersOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-panel rounded-t-xl border-t border-borderSubtle max-h-[80vh] overflow-auto overscroll-contain p-4" onClick={(e)=>e.stopPropagation()}>
            <div className="w-10 h-1.5 bg-tile rounded-full mx-auto mb-4" />
            <AbilityBar agent={selectedAgent} selected={store.selectedAbilities} onToggle={(s) => store.toggleAbility(s)} />
            <div className="mt-3"><FiltersCardCollapsible importance={store.importance} difficulty={store.difficulty} onToggleImportance={(v)=>store.toggleImportance(v)} onToggleDifficulty={(v)=>store.toggleDifficulty(v)} onReset={()=>store.resetFilters()} /></div>
            <button onClick={() => setMobileFiltersOpen(false)} className="mt-4 w-full min-h-[48px] rounded bg-accent text-white font-bold">Show {filtered.length} lineups</button>
          </div>
        </div>
      )}
    </div>
  );
}
