import { useState, useMemo } from "react";
import { getAllLineups } from "../lib/indexedDBRepository";
import { exportLineups } from "../lib/exporter";

export default function ExportDialog({ filtered, onClose }: { filtered?: any[]; onClose: () => void }) {
  const [mode, setMode] = useState<"all" | "filtered" | "selection">("filtered");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allLineups, setAllLineups] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  // load all for selection UI
  useMemo(() => {
    if (mode === "selection" && !allLineups) {
      getAllLineups().then(setAllLineups);
    }
  }, [mode, allLineups]);

  const doExport = async () => {
    setLoading(true);
    try {
      if (mode === "all") {
        const all = await getAllLineups();
        await exportLineups(all, `lineuplab-all-${all.length}.zip`);
      } else if (mode === "filtered") {
        if (!filtered || filtered.length === 0) { alert("No filtered lineups"); return; }
        await exportLineups(filtered, `lineuplab-filtered-${filtered.length}.zip`);
      } else if (mode === "selection") {
        if (selectedIds.size === 0) { alert("Select at least one lineup"); return; }
        const all = await getAllLineups();
        const sel = all.filter(l => selectedIds.has(l.id));
        await exportLineups(sel, `lineuplab-selected-${sel.length}.zip`);
      }
      onClose();
    } catch (e:any) { alert("Export failed: "+String(e.message ?? e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-panel border border-borderSubtle rounded-card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b border-borderSubtle flex items-center justify-between">
          <h3 className="text-textPrimary font-bold">Export Lineups</h3>
          <button onClick={onClose} className="w-10 h-10 rounded bg-tile flex items-center justify-center text-muted">✕</button>
        </div>
        <div className="p-4 overflow-auto thin-scrollbar flex-1 space-y-4">
          <p className="text-sm text-muted">New format v2 — zip with <code className="bg-tile px-1 rounded">manifest.json</code> + <code className="bg-tile px-1 rounded">lineups/*.json</code> + <code className="bg-tile px-1 rounded">media/*.jpg</code>. Supports extra annotations, charge bars, bounces. Legacy packs still importable (auto-detected via manifest <code>formatVersion</code>).</p>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={()=>setMode("all")} className={`p-3 rounded-md border text-left ${mode==="all"?"bg-accent text-white border-accent":"bg-tile border-borderSubtle text-textPrimary"}`}>
              <div className="font-bold text-sm">Export All</div>
              <div className="text-xs opacity-80">All lineups in DB</div>
            </button>
            <button onClick={()=>setMode("filtered")} className={`p-3 rounded-md border text-left ${mode==="filtered"?"bg-accent text-white border-accent":"bg-tile border-borderSubtle text-textPrimary"}`}>
              <div className="font-bold text-sm">Filtered</div>
              <div className="text-xs opacity-80">{filtered?.length ?? 0} matches</div>
            </button>
            <button onClick={()=>setMode("selection")} className={`p-3 rounded-md border text-left ${mode==="selection"?"bg-accent text-white border-accent":"bg-tile border-borderSubtle text-textPrimary"}`}>
              <div className="font-bold text-sm">Select</div>
              <div className="text-xs opacity-80">Pick specific</div>
            </button>
          </div>

          {mode === "selection" && (
            <div className="border border-borderSubtle rounded-md max-h-[40vh] overflow-auto thin-scrollbar">
              {!allLineups ? <div className="p-4 text-muted text-sm">Loading…</div> : allLineups.length===0 ? <div className="p-4 text-muted text-sm">No lineups</div> : (
                <div className="divide-y divide-borderSubtle">
                  {allLineups.map(l => (
                    <label key={l.id} className="flex items-center gap-2 p-2 hover:bg-tile cursor-pointer">
                      <input type="checkbox" checked={selectedIds.has(l.id)} onChange={e=>{
                        const n=new Set(selectedIds);
                        if(e.target.checked) n.add(l.id); else n.delete(l.id);
                        setSelectedIds(n);
                      }} />
                      <span className="text-sm text-textPrimary truncate flex-1">{l.title}</span>
                      <span className="text-xs text-muted">{l.mapUuid.slice(0,6)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-tile border border-borderSubtle rounded p-3 text-xs text-muted">
            <div className="font-bold text-textPrimary mb-1">Export options</div>
            <div>• Format v2 uses <b>jpg</b> images (converted from png if needed) for smaller size</div>
            <div>• Import auto-determines format via <code>manifest.json → formatVersion</code> (1 = legacy, 2 = jpg + annotations)</div>
            <div>• Individual lineup export available via popup <b>⋮ → Export</b> button</div>
          </div>
        </div>
        <div className="p-3 border-t border-borderSubtle flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded bg-tile border border-borderSubtle text-textPrimary min-h-[40px]">Cancel</button>
          <button onClick={doExport} disabled={loading} className="px-5 py-2 rounded bg-accent text-white font-bold min-h-[40px] disabled:opacity-40">{loading ? "Exporting…" : mode==="all" ? "Export All" : mode==="filtered" ? `Export ${filtered?.length ?? 0}` : `Export ${selectedIds.size}`}</button>
        </div>
      </div>
    </div>
  );
}
