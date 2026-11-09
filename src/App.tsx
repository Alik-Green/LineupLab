import { useEffect, useMemo, useState } from "react";
import TopBar from "./components/TopBar";
import MapCard from "./components/MapCard";
import AgentGrid from "./components/AgentGrid";
import AbilityBar from "./components/AbilityBar";
import FiltersCard from "./components/FiltersCard";
import Minimap from "./components/Minimap";
import DetailPanel from "./components/DetailPanel";
import LoadingScreen from "./components/LoadingScreen";
import { useValorantData } from "./hooks/useValorantData";
import { useAppStore } from "./stores/appStore";
import { JsonLineupRepository, loadLineupsFromFile } from "./lib/lineupRepository";
import { filterLineups, hasLineupsForAgent } from "./lib/filtering";
import type { Lineup, AbilitySlot } from "./types/lineup";

export default function App() {
  const { agents, maps, loading, error, retry } = useValorantData();
  const [lineups, setLineups] = useState<Lineup[] | null>(null);
  const [lineupsError, setLineupsError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const store = useAppStore();

  // hydrate
  useEffect(() => {
    store.hydrateFromStorage();
  }, []);

  // listen for reset custom event from Minimap empty state
  useEffect(() => {
    const handler = () => store.resetFilters();
    window.addEventListener("reset-filters", handler as any);
    return () => window.removeEventListener("reset-filters", handler as any);
  }, []);

  // load lineups
  useEffect(() => {
    const repo = new JsonLineupRepository("/lineups.json");
    repo
      .getAll()
      .then((data) => setLineups(data))
      .catch((e) => setLineupsError(String(e)));
  }, []);

  // default map selection after maps load
  useEffect(() => {
    if (maps && maps.length > 0 && !store.selectedMapUuid) {
      // prefer Corrode if exists else first
      const corrode = maps.find((m) => m.displayName.toLowerCase().includes("corrode"));
      store.setMap((corrode ?? maps[0]).uuid);
    }
  }, [maps]);

  // default abilities: if agent selected, ensure abilities set?
  const selectedMap = useMemo(() => maps?.find((m) => m.uuid === store.selectedMapUuid), [maps, store.selectedMapUuid]);
  const selectedAgent = useMemo(() => agents?.find((a) => a.uuid === store.selectedAgentUuid), [agents, store.selectedAgentUuid]);

  // When agent changes, reset selectedAbilities to all abilities of that agent? Spec says all abilities start selected; keep existing but ensure valid slots.
  // We'll keep as is but if new agent selected, we set all its slots selected
  useEffect(() => {
    if (selectedAgent) {
      const slots = selectedAgent.abilities.map((a) => a.slot as AbilitySlot).filter((s) => ["Ability1", "Ability2", "Grenade", "Ultimate"].includes(s));
      if (slots.length > 0) {
        // if user hadn't changed, set all; we will initialize to all slots of agent
        // But to match spec: "All abilities start selected" means initially all 4 selected; when agent changes, those 4 still relevant
        // We'll keep store as is unless empty
      }
    }
  }, [selectedAgent?.uuid]);

  const agentsMap = useMemo(() => {
    const m = new Map();
    agents?.forEach((a) => m.set(a.uuid, a));
    return m;
  }, [agents]);

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

  // handle file load
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await loadLineupsFromFile(file);
      setLineups(data as Lineup[]);
      setSettingsOpen(false);
    } catch (err: any) {
      alert("Failed to load file: " + err?.message);
    }
  };

  if (loading || !maps || !agents) {
    return <LoadingScreen error={error} onRetry={retry} />;
  }
  if (lineupsError) {
    return (
      <div className="min-h-screen bg-pageBg flex flex-col items-center justify-center p-6">
        <p className="text-accent font-bold">Failed to load lineups: {lineupsError}</p>
        <button onClick={() => location.reload()} className="mt-4 px-4 py-2 rounded bg-accent text-white">Reload</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pageBg flex flex-col">
      <TopBar onOpenSettings={() => setSettingsOpen((v) => !v)} />

      {/* Settings overlay */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSettingsOpen(false)}>
          <div className="bg-panel border border-borderSubtle rounded-card p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-textPrimary font-bold text-lg">Settings</h3>
            <p className="text-muted text-sm mt-1">Load a custom lineups.json file. Demo data will be replaced.</p>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-textPrimary">Load lineups file</span>
              <input type="file" accept=".json" onChange={handleFileChange} className="mt-2 w-full text-sm text-muted file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-accent file:text-white" />
            </label>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 rounded bg-tile text-textPrimary min-h-[40px]">Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left panel - desktop */}
        <aside className="hidden md:flex w-[350px] shrink-0 flex-col gap-3 p-3 overflow-auto bg-[#1B1B1F] border-r border-borderSubtle">
          <MapCard
            maps={maps}
            selectedMap={selectedMap}
            onSelect={(uuid) => store.setMap(uuid)}
            side={store.side}
            onSideChange={(s) => store.setSide(s)}
          />
          <AgentGrid
            agents={agents}
            selectedAgentUuid={store.selectedAgentUuid}
            onSelect={(uuid) => store.setAgent(uuid)}
            hasLineups={(agentUuid) => hasLineupsForAgent(lineups ?? [], agentUuid, store.selectedMapUuid, store.side)}
          />
          <AbilityBar agent={selectedAgent} selected={store.selectedAbilities} onToggle={(slot) => store.toggleAbility(slot)} />
          <FiltersCard
            importance={store.importance}
            difficulty={store.difficulty}
            onToggleImportance={(v) => store.toggleImportance(v)}
            onToggleDifficulty={(v) => store.toggleDifficulty(v)}
            onReset={() => store.resetFilters()}
          />

          <div className="text-muted text-xs text-center py-2">Demo data badge • {lineups?.length ?? 0} lineups</div>
        </aside>

        {/* Mobile top strips */}
        <div className="md:hidden bg-pageBg border-b border-borderSubtle">
          {/* Map picker horizontal strip */}
          <div className="p-3">
            <MapCard maps={maps} selectedMap={selectedMap} onSelect={(uuid) => store.setMap(uuid)} side={store.side} onSideChange={(s) => store.setSide(s)} />
          </div>
          <div className="px-3 pb-3">
            <div className="rounded-card bg-panel border border-borderSubtle p-2">
              <p className="text-xs font-semibold text-muted mb-2">Agents</p>
              <div className="flex gap-2 overflow-auto pb-1">
                {[...agents].sort((a,b)=>a.displayName.localeCompare(b.displayName)).map((agent) => {
                  const isSelected = store.selectedAgentUuid === agent.uuid;
                  const has = hasLineupsForAgent(lineups ?? [], agent.uuid, store.selectedMapUuid, store.side);
                  return (
                    <button
                      key={agent.uuid}
                      onClick={() => store.setAgent(isSelected ? null : agent.uuid)}
                      className={`shrink-0 w-[56px] h-[56px] rounded-md overflow-hidden bg-tile border-2 ${isSelected ? "border-accent" : "border-transparent"} ${!has ? "opacity-40" : ""} min-w-[48px] min-h-[48px]`}
                    >
                      <img src={agent.displayIcon} alt={agent.displayName} className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right area */}
        <div className="flex-1 flex flex-col min-h-[420px] relative bg-[#131315] min-w-0">
          <Minimap
            map={selectedMap}
            lineups={filtered}
            agentsMap={agentsMap}
            hoveredId={hoveredId}
            setHoveredId={setHoveredId}
            selectedId={selectedId}
            onSelect={setSelectedId}
            zoom={store.zoom}
            pan={store.pan}
            onZoom={(z) => store.setZoom(z)}
            onPan={(p) => store.setPan(p)}
          />
          {/* Mobile Filters button */}
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full bg-panel border border-borderSubtle text-textPrimary font-bold shadow-xl min-h-[48px]"
          >
            Filters • {filtered.length}
          </button>
          {/* Detail panel */}
          {selectedLineup && (
            <DetailPanel
              lineup={selectedLineup}
              agent={agentsMap.get(selectedLineup.agentUuid)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>

      {/* Mobile bottom sheet filters */}
      {mobileFiltersOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileFiltersOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-panel rounded-t-xl border-t border-borderSubtle max-h-[80vh] overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1.5 bg-tile rounded-full mx-auto mb-4" />
            <AbilityBar agent={selectedAgent} selected={store.selectedAbilities} onToggle={(s) => store.toggleAbility(s)} />
            <div className="mt-3">
              <FiltersCard
                importance={store.importance}
                difficulty={store.difficulty}
                onToggleImportance={(v) => store.toggleImportance(v)}
                onToggleDifficulty={(v) => store.toggleDifficulty(v)}
                onReset={() => store.resetFilters()}
              />
            </div>
            <button onClick={() => setMobileFiltersOpen(false)} className="mt-4 w-full min-h-[48px] rounded bg-accent text-white font-bold">
              Show {filtered.length} lineups
            </button>
          </div>
        </div>
      )}

      {/* footer */}
      <footer className="h-8 bg-pageBg border-t border-borderSubtle flex items-center justify-center text-muted text-xs">
        LineupLab • Demo mode • {filtered.length} showing
      </footer>
    </div>
  );
}
