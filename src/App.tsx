import { useEffect, useMemo, useState } from "react";
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
      <div className="shrink-0 text-muted text-[10px] text-center py-1">Demo data • {lineupsCount} lineups</div>
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
    if (settingsOpen || importOpen || mobileFiltersOpen || selectedLineup) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [settingsOpen, importOpen, mobileFiltersOpen, selectedLineup]);

  if (loading || !maps || !agents) return <LoadingScreen error={error} onRetry={retry} />;
  const showLineupsErrorBanner = !!lineupsError;

  return (
    <div className="h-[100dvh] h-screen flex flex-col overflow-hidden bg-pageBg" style={{ overscrollBehavior: "none" }}>
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSettings={() => setSettingsOpen((v) => !v)}
        onImport={() => setImportOpen(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      {showLineupsErrorBanner && (
        <div className="mx-3 mt-2 p-2 rounded bg-accent/20 border border-accent text-accent text-xs flex items-center justify-between shrink-0">
          <span>Failed to load lineups: {lineupsError}</span>
          <button onClick={() => window.location.reload()} className="ml-3 px-3 py-1 rounded bg-accent text-white text-xs min-h-[40px]">Reload</button>
        </div>
      )}
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onImported={refreshLineups} />}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSettingsOpen(false)}>
          <div className="bg-panel border border-borderSubtle rounded-card p-5 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-auto" onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-textPrimary font-bold text-lg">Settings</h3>
            <div className="mt-3 text-sm text-muted">Import history, demo data controls.</div>
            <button onClick={async () => { await removeDemoData(); await refreshLineups(); setSettingsOpen(false); }} className="mt-4 w-full min-h-[40px] rounded bg-tile hover:bg-tileHover text-textPrimary text-sm border border-borderSubtle">Remove demo data</button>
            <div className="mt-4 flex justify-end"><button onClick={() => setSettingsOpen(false)} className="px-4 py-2 rounded bg-tile text-textPrimary min-h-[40px]">Close</button></div>
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
            <CreateWizard agents={agents} maps={maps} hideChrome selectedMapOverride={selectedMap} selectedAgentOverride={selectedAgent} sideOverride={store.side} />
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
              <DetailPanel lineup={selectedLineup as any} agent={agentsMap.get(selectedLineup.agentUuid)} onClose={() => setSelectedId(null)} onDelete={async (id) => { await deleteLineup(id); await refreshLineups(); setSelectedId(null); }} onEdit={() => { setActiveTab("create"); setSelectedId(null); }} />
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
