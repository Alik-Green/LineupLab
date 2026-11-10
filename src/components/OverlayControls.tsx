import type { Lineup } from "../types/lineup";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type OverlaySize = "small" | "medium" | "large" | "custom";

export default function OverlayControls({
  lineup,
  isOpen,
  corner,
  size,
  opacity,
  onOpen,
  onClose,
  onCornerChange,
  onSizeChange,
  onOpacityChange,
}: {
  lineup: Lineup | null;
  isOpen: boolean;
  corner: Corner;
  size: OverlaySize;
  opacity: number;
  onOpen: () => void;
  onClose: () => void;
  onCornerChange: (c: Corner) => void;
  onSizeChange: (s: OverlaySize) => void;
  onOpacityChange: (o: number) => void;
}) {
  const corners: { id: Corner; label: string; icon: string }[] = [
    { id: "top-left", label: "Top Left", icon: "↖" },
    { id: "top-right", label: "Top Right", icon: "↗" },
    { id: "bottom-left", label: "Bottom Left", icon: "↙" },
    { id: "bottom-right", label: "Bottom Right", icon: "↘" },
  ];

  return (
    <div className="rounded-card bg-panel border border-borderSubtle p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-extrabold tracking-widest text-textPrimary">OVERLAY WINDOW</h4>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isOpen ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-tile border-borderSubtle text-muted"}`}>
          {isOpen ? "● LIVE — Always on top" : "○ Closed"}
        </span>
      </div>

      <p className="text-xs text-muted leading-relaxed">
        Separate frameless window that stays **always on top** of Valorant. No title bar. Position it in any corner from here.
      </p>

      {!lineup && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-500">
          Select a lineup first (click a marker on the map or list), then open overlay.
        </div>
      )}

      <div className="flex gap-2">
        {!isOpen ? (
          <button
            onClick={onOpen}
            disabled={!lineup}
            className="flex-1 py-2.5 rounded-md bg-accent hover:bg-accentHover disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs tracking-widest shadow-sm min-h-[44px]"
          >
            Open Overlay (Alt+O)
          </button>
        ) : (
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-md bg-tile hover:bg-red-500/10 border border-borderSubtle hover:border-red-500/30 text-textPrimary hover:text-red-500 font-bold text-xs min-h-[44px]"
          >
            Close Overlay
          </button>
        )}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "o", altKey: true }))}
          className="px-3 py-2 rounded-md bg-panel border border-borderSubtle text-muted hover:text-textPrimary text-xs"
          title="Toggle with Alt+O"
        >
          Alt+O
        </button>
      </div>

      <div>
        <p className="text-[10px] font-bold tracking-widest text-muted mb-2">CORNER</p>
        <div className="grid grid-cols-2 gap-1.5">
          {corners.map(c => (
            <button
              key={c.id}
              onClick={() => onCornerChange(c.id)}
              className={`py-2.5 rounded-md border text-xs font-bold flex items-center justify-center gap-1.5 min-h-[40px] ${corner === c.id ? "bg-accent border-accent text-white shadow-sm" : "bg-tile border-borderSubtle text-muted hover:text-textPrimary hover:bg-tileHover"}`}
            >
              <span className="text-sm">{c.icon}</span> {c.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted mt-1.5">Repositions the overlay window instantly. Try bottom-right for Valorant.</p>
      </div>

      <div>
        <p className="text-[10px] font-bold tracking-widest text-muted mb-2">SIZE</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["small","medium","large"] as OverlaySize[]).map(s => (
            <button key={s} onClick={() => onSizeChange(s)} className={`py-2 rounded-md border text-xs font-bold capitalize min-h-[36px] ${size === s ? "bg-accent border-accent text-white" : "bg-tile border-borderSubtle text-muted hover:text-textPrimary"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-bold tracking-widest text-muted">OPACITY</p>
          <span className="text-xs font-bold text-textPrimary">{Math.round(opacity*100)}%</span>
        </div>
        <input type="range" min={0.4} max={1} step={0.05} value={opacity} onChange={e=>onOpacityChange(parseFloat(e.target.value))} className="w-full accent-accent h-1.5" />
        <div className="flex justify-between text-[10px] text-muted mt-1">
          <span>Transparent</span><span>Solid</span>
        </div>
      </div>

      <div className="rounded-md bg-accent/10 border border-accent/20 p-2.5">
        <p className="text-xs font-bold text-accent">How to use in Valorant</p>
        <ol className="text-xs text-muted mt-1.5 space-y-1 list-decimal list-inside">
          <li>Select a lineup, choose corner & size</li>
          <li>Click <b className="text-textPrimary">Open Overlay</b> — window appears always on top, no title bar</li>
          <li>Alt+Tab to Valorant — overlay stays over game</li>
          <li>Drag the overlay by its top bar to reposition, or change corner here</li>
          <li>Use thumbnails / ← → to cycle stand/aim/land images</li>
        </ol>
      </div>
    </div>
  );
}
