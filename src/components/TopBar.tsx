import { useCallback } from "react";

export default function TopBar({ activeTab, onTabChange, onOpenSettings, onImport, viewMode, onViewModeChange, createMode, onCreateModeChange }: {
  activeTab: string;
  onTabChange: (t: any) => void;
  onOpenSettings: () => void;
  onImport: () => void;
  viewMode?: "map" | "list";
  onViewModeChange?: (m: "map" | "list") => void;
  createMode?: "capture" | "setup";
  onCreateModeChange?: (m: "capture" | "setup") => void;
}) {
  const isTauriEnv = typeof window !== "undefined" && ((window as any).__TAURI__ !== undefined || (window as any).__TAURI_INTERNALS__ !== undefined);

  const getWin = async () => {
    try {
      // @ts-ignore - dynamic for CSP
      const mod = await import("@tauri-apps/api/window");
      return mod.getCurrentWindow();
    } catch {
      const tauri = (window as any).__TAURI__ as any;
      if (tauri?.window?.getCurrentWindow) return tauri.window.getCurrentWindow();
      if (tauri?.core?.invoke) {
        return {
          minimize: () => tauri.core.invoke("plugin:window|minimize", { label: "main" }),
          maximize: () => tauri.core.invoke("plugin:window|maximize", { label: "main" }),
          unmaximize: () => tauri.core.invoke("plugin:window|unmaximize", { label: "main" }),
          isMaximized: () => tauri.core.invoke("plugin:window|isMaximized", { label: "main" }),
          close: () => tauri.core.invoke("plugin:window|close", { label: "main" }),
        } as any;
      }
      throw new Error("no window api");
    }
  };

  const doMin = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation(); e?.preventDefault();
    if (!isTauriEnv) return;
    try { const w = await getWin(); await w.minimize(); } catch (err) { console.error("minimize failed", err); alert("Minimize failed: " + String(err)); }
  }, [isTauriEnv]);
  const doMax = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation(); e?.preventDefault();
    if (!isTauriEnv) return;
    try {
      const w = await getWin();
      const isMax = await w.isMaximized();
      if (isMax) await w.unmaximize(); else await w.maximize();
    } catch (err) { console.error("maximize failed", err); alert("Maximize failed: " + String(err)); }
  }, [isTauriEnv]);
  const doClose = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation(); e?.preventDefault();
    if (!isTauriEnv) { console.log("Close in browser preview"); return; }
    try { const w = await getWin(); await w.close(); } catch (err) { console.error("close failed", err); alert("Close failed: " + String(err)); }
  }, [isTauriEnv]);

  return (
    <header className="h-[56px] shrink-0 flex items-center bg-[#1B1B1F] border-b border-[#2A2B32] sticky top-0 z-30 select-none relative">
      <div data-tauri-drag-region className="absolute inset-0" style={{ WebkitAppRegion: "drag" } as any} aria-hidden />

      <div className="relative flex-1 flex items-center px-4 h-full gap-2 z-10">
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as any}>
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-white font-bold text-sm">LL</div>
          <span className="font-bold text-textPrimary text-[18px] tracking-tight">LineupLab</span>
          <span className="ml-2 px-2 py-0.5 rounded-md bg-tile text-muted text-xs">{/* demo badge removed */}</span>
        </div>
        <nav className="ml-6 flex gap-1" style={{ WebkitAppRegion: "no-drag" } as any}>
          <button
            onClick={() => onTabChange("lineups")}
            className={`px-4 py-2 min-h-[40px] rounded-md text-sm font-semibold border ${activeTab === "lineups" ? "bg-panel text-textPrimary border-borderSubtle" : "bg-transparent text-muted border-transparent hover:text-textPrimary"}`}
            aria-current={activeTab === "lineups" ? "page" : undefined}
          >
            Lineups
          </button>
          <button
            onClick={() => onTabChange("create")}
            className={`px-4 py-2 min-h-[40px] rounded-md text-sm font-semibold border ${activeTab === "create" ? "bg-panel text-textPrimary border-borderSubtle" : "bg-transparent text-muted border-transparent hover:text-textPrimary"}`}
            aria-current={activeTab === "create" ? "page" : undefined}
          >
            Create
          </button>
          {activeTab === "lineups" && onViewModeChange && viewMode && (
            <>
              <div className="w-px bg-borderSubtle mx-2 self-center h-6" />
              <button onClick={() => onViewModeChange("map")} className={`px-3 py-2 min-h-[40px] rounded-md text-sm font-semibold border ${viewMode === "map" ? "bg-panel text-textPrimary border-borderSubtle" : "bg-transparent text-muted border-transparent hover:text-textPrimary"}`}>Map</button>
              <button onClick={() => onViewModeChange("list")} className={`px-3 py-2 min-h-[40px] rounded-md text-sm font-semibold border ${viewMode === "list" ? "bg-panel text-textPrimary border-borderSubtle" : "bg-transparent text-muted border-transparent hover:text-textPrimary"}`}>List</button>
            </>
          )}
          {activeTab === "create" && onCreateModeChange && createMode && (
            <>
              <div className="w-px bg-borderSubtle mx-2 self-center h-6" />
              <button onClick={() => onCreateModeChange("capture")} className={`px-3 py-2 min-h-[40px] rounded-md text-sm font-semibold border ${createMode === "capture" ? "bg-panel text-textPrimary border-borderSubtle" : "bg-transparent text-muted border-transparent hover:text-textPrimary"}`}>Capture</button>
              <button onClick={() => onCreateModeChange("setup")} className={`px-3 py-2 min-h-[40px] rounded-md text-sm font-semibold border ${createMode === "setup" ? "bg-panel text-textPrimary border-borderSubtle" : "bg-transparent text-muted border-transparent hover:text-textPrimary"}`}>Setup</button>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as any}>
          <button onClick={onImport} aria-label="Share" className="w-10 h-10 rounded-md bg-panel border border-borderSubtle text-muted hover:text-textPrimary flex items-center justify-center">
            {/* share icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="M8.6 10.7l6.8-4M8.6 13.3l6.8 4" />
            </svg>
          </button>
          <button onClick={onOpenSettings} aria-label="Settings" className="w-10 h-10 rounded-md bg-panel border border-borderSubtle text-muted hover:text-textPrimary flex items-center justify-center">
            {/* gear icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative flex h-full shrink-0 z-10" style={{ WebkitAppRegion: "no-drag" } as any}>
        <button onClick={doMin} onMouseDown={e=>e.stopPropagation()} className="w-12 h-full flex items-center justify-center text-muted hover:bg-white/10 hover:text-white" aria-label="Minimize">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><rect x="1" y="5.5" width="10" height="1" fill="currentColor"/></svg>
        </button>
        <button onClick={doMax} onMouseDown={e=>e.stopPropagation()} className="w-12 h-full flex items-center justify-center text-muted hover:bg-white/10 hover:text-white" aria-label="Maximize">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1.5 3.5 H10.5" stroke="currentColor" strokeWidth="1"/></svg>
        </button>
        <button onClick={doClose} onMouseDown={e=>e.stopPropagation()} className="w-12 h-full flex items-center justify-center text-muted hover:bg-accent hover:text-white" aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </button>
      </div>
    </header>
  );
}
