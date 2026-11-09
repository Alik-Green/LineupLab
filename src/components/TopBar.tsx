export default function TopBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <header className="h-[56px] flex items-center px-4 bg-[#1B1B1F] border-b border-[#2A2B32] sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-white font-bold text-sm">LL</div>
        <span className="font-bold text-textPrimary text-[18px] tracking-tight">LineupLab</span>
        <span className="ml-2 px-2 py-0.5 rounded-full bg-tile text-muted text-xs">Demo data</span>
      </div>
      <nav className="ml-8 flex gap-1">
        <button
          className="px-4 py-2 min-h-[40px] rounded-md bg-panel text-textPrimary text-sm font-semibold border border-borderSubtle"
          aria-current="page"
        >
          Lineups
        </button>
        <span className="px-3 py-2 text-muted text-sm">More tabs soon</span>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onOpenSettings}
          className="min-h-[40px] px-3 rounded-md bg-panel text-muted hover:text-textPrimary text-sm border border-borderSubtle transition-colors"
          aria-label="Open settings"
        >
          ⚙ Settings
        </button>
      </div>
    </header>
  );
}
