export default function TopBar({ activeTab, onTabChange, onOpenSettings, onImport }: { activeTab: string; onTabChange: (t: any) => void; onOpenSettings: () => void; onImport: () => void }) {
  return (
    <header className="h-[56px] shrink-0 flex items-center px-4 bg-[#1B1B1F] border-b border-[#2A2B32] sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-white font-bold text-sm">LL</div>
        <span className="font-bold text-textPrimary text-[18px] tracking-tight">LineupLab</span>
        <span className="ml-2 px-2 py-0.5 rounded-full bg-tile text-muted text-xs">Demo data</span>
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
    </header>
  );
}
