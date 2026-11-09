import { getCurrentWindow } from "@tauri-apps/api/window";

export default function TopBar({ activeTab, onTabChange, onOpenSettings, onImport }: { activeTab: string; onTabChange: (t: any) => void; onOpenSettings: () => void; onImport: () => void }) {
  const handleDrag = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    try {
      await getCurrentWindow().startDragging();
    } catch {}
  };

  const min = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await getCurrentWindow().minimize();
    } catch (err) {
      console.warn("minimize failed", err);
    }
  };
  const max = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const win = getCurrentWindow();
      const isMax = await win.isMaximized();
      if (isMax) await win.unmaximize();
      else await win.maximize();
    } catch (err) {
      console.warn("maximize failed", err);
    }
  };
  const close = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await getCurrentWindow().close();
    } catch (err) {
      console.warn("close failed", err);
    }
  };

  return (
    <header
      className="h-[56px] shrink-0 flex items-center bg-[#1B1B1F] border-b border-[#2A2B32] sticky top-0 z-30 select-none"
      onMouseDown={handleDrag}
    >
      <div className="flex-1 flex items-center px-4 h-full gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-white font-bold text-sm">LL</div>
          <span className="font-bold text-textPrimary text-[18px] tracking-tight">LineupLab</span>
          <span className="ml-2 px-2 py-0.5 rounded-md bg-tile text-muted text-xs">Demo data</span>
        </div>
        <nav className="ml-8 flex gap-1">
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
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onImport} className="min-h-[40px] px-3 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accentHover">Import</button>
          <button onClick={onOpenSettings} className="min-h-[40px] px-3 rounded-md bg-panel text-muted hover:text-textPrimary text-sm border border-borderSubtle" aria-label="Open settings">⚙ Settings</button>
        </div>
      </div>
      <div className="flex h-full shrink-0">
        <button onClick={min} onMouseDown={(e) => e.stopPropagation()} className="w-12 h-full flex items-center justify-center text-muted hover:bg-white/10 hover:text-white" aria-label="Minimize">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><rect x="1" y="5.5" width="10" height="1" fill="currentColor"/></svg>
        </button>
        <button onClick={max} onMouseDown={(e) => e.stopPropagation()} className="w-12 h-full flex items-center justify-center text-muted hover:bg-white/10 hover:text-white" aria-label="Maximize">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1.5 3.5 H10.5" stroke="currentColor" strokeWidth="1"/></svg>
        </button>
        <button onClick={close} onMouseDown={(e) => e.stopPropagation()} className="w-12 h-full flex items-center justify-center text-muted hover:bg-accent hover:text-white" aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </button>
      </div>
    </header>
  );
}
