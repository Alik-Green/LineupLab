import { useRef, useState, useEffect, useMemo } from "react";
import type { Lineup, ValorantMap } from "../types/lineup";
import ValImage from "./ValImage";

type Props = {
  map: ValorantMap | null | undefined;
  lineups: Lineup[];
  agentsMap: Map<string, any>;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  zoom: number;
  pan: { x: number; y: number };
  onZoom: (z: number) => void;
  onPan: (p: { x: number; y: number }) => void;
};

function importanceRing(imp: string) {
  if (imp === "essential") return "#22C55E";
  if (imp === "optional") return "#E8404F";
  return "#EDEDED";
}

export default function Minimap({
  map,
  lineups,
  agentsMap,
  hoveredId,
  setHoveredId,
  selectedId,
  onSelect,
  zoom,
  pan,
  onZoom,
  onPan,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // compute image size at zoom=1 (contain)
  const baseImageSize = useMemo(() => {
    const s = Math.min(containerSize.w * 0.82, containerSize.h * 0.82, 680);
    return { w: s, h: s };
  }, [containerSize]);

  const zoomClamp = (z: number) => Math.min(3, Math.max(0.6, z));

  // pan handlers
  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, pan: { ...pan } };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging && dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      onPan({ x: dragStart.current.pan.x + dx, y: dragStart.current.pan.y + dy });
    }
  };
  const onMouseUp = () => setIsDragging(false);

  // wheel isolated: passive:false + preventDefault so document never scrolls
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      onZoom(zoomClamp(zoom + delta));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler as any);
  }, [zoom, onZoom]);

  // touch pinch
  const touchState = useRef<{ dist: number; zoom: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      touchState.current = { dist: d, zoom };
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, pan: { ...pan } };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchState.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      const ratio = d / touchState.current.dist;
      onZoom(zoomClamp(touchState.current.zoom * ratio));
    } else if (e.touches.length === 1 && isDragging && dragStart.current) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      onPan({ x: dragStart.current.pan.x + dx, y: dragStart.current.pan.y + dy });
    }
  };
  const onTouchEnd = () => {
    setIsDragging(false);
    touchState.current = null;
  };

  const getMarkerPos = (pt: { x: number; y: number }) => {
    // image center at container center + pan, then offset by (norm - 0.5)*imageSize*zoom
    const cx = containerSize.w / 2 + pan.x;
    const cy = containerSize.h / 2 + pan.y;
    const imgW = baseImageSize.w * zoom;
    const imgH = baseImageSize.h * zoom;
    const x = cx + (pt.x - 0.5) * imgW;
    const y = cy + (pt.y - 0.5) * imgH;
    return { x, y };
  };

  const hovered = lineups.find((l) => l.id === hoveredId) ?? null;

  if (!map) {
    return (
      <div className="flex-1 bg-pageBg flex items-center justify-center text-muted">
        Select a map
      </div>
    );
  }

  const empty = lineups.length === 0;

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-[#131315] select-none touch-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => setIsDragging(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={() => {
        onZoom(1);
        onPan({ x: 0, y: 0 });
      }}
      style={{ cursor: isDragging ? "grabbing" : "grab", touchAction: "none" } as any}
    >
      {/* blurred backdrop */}
      <div className="absolute inset-0">
        <ValImage src={map.splash} alt="" className="w-full h-full opacity-20 blur-[12px] scale-105" />
        <div className="absolute inset-0 bg-[#1B1B1F]/40" />
      </div>

      {/* spawn labels */}
      <div className="absolute left-1/2 top-[12%] -translate-x-1/2 px-3 py-1 rounded bg-[#0F2A27] border border-[#3DD6B6]/30 text-[#3DD6B6] text-xs font-bold tracking-widest">
        Defenders
      </div>
      <div className="absolute left-1/2 bottom-[10%] -translate-x-1/2 px-3 py-1 rounded bg-[#2A1B1F] border border-[#E8404F]/30 text-[#E8404F] text-xs font-bold tracking-widest">
        Attackers
      </div>

      {/* minimap image */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: baseImageSize.w * zoom,
          height: baseImageSize.h * zoom,
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
          // we already handle pan via transform, but marker positions computed via same math so we keep image centered via pan translation
        }}
      >
        {/* Actually pan is applied via this wrapper transform; markers are outside wrapper for fixed pixel size? Simpler markers overlay on container coordinates */}
      </div>
      {/* Render image as positioned with computed size+pan for accuracy for markers overlay */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: containerSize.w / 2 + pan.x - (baseImageSize.w * zoom) / 2,
          top: containerSize.h / 2 + pan.y - (baseImageSize.h * zoom) / 2,
          width: baseImageSize.w * zoom,
          height: baseImageSize.h * zoom,
        }}
      >
        <img
          src={map.displayIcon ?? map.splash}
          alt={`${map.displayName} minimap`}
          className="w-full h-full object-contain opacity-90"
          style={{ filter: "contrast(1.1) brightness(0.95)" }}
          draggable={false}
          onError={(e) => console.warn("[Minimap] minimap load failed", map.displayIcon)}
        />
      </div>

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex rounded-md overflow-hidden border border-borderSubtle bg-panel shadow-lg">
        <button
          onClick={() => onZoom(zoomClamp(zoom - 0.2))}
          className="w-10 h-10 flex items-center justify-center text-textPrimary hover:bg-tile min-w-[40px] min-h-[40px]"
          aria-label="Zoom out"
        >
          −
        </button>
        <div className="w-px bg-borderSubtle" />
        <button
          onClick={() => onZoom(zoomClamp(zoom + 0.2))}
          className="w-10 h-10 flex items-center justify-center text-textPrimary hover:bg-tile min-w-[40px] min-h-[40px]"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      {/* Markers layer */}
      <div className="absolute inset-0">
        {lineups.map((l) => {
          const pos = getMarkerPos(l.end);
          const isHovered = hoveredId === l.id;
          const isDimmed = hoveredId !== null && hoveredId !== l.id;
          const agent = agentsMap.get(l.agentUuid);
          const ability = agent?.abilities?.find((a: any) => a.slot === l.abilitySlot);
          const ring = importanceRing(l.importance);
          // small z-order: hovered on top
          return (
            <div key={l.id} style={{ position: "absolute", left: pos.x, top: pos.y, zIndex: isHovered ? 20 : 5 }}>
              {/* path line SVG when hovered: draw from start to end via bounces */}
              {/* path is drawn as overlay line in same container */}
              <button
                onMouseEnter={(e) => {
                  setHoveredId(l.id);
                  setTooltipPos({ x: pos.x, y: pos.y });
                }}
                onMouseLeave={() => {
                  setHoveredId(null);
                  setTooltipPos(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // second tap logic handled by parent
                  if (selectedId === l.id) onSelect(null);
                  else onSelect(l.id);
                  setHoveredId(l.id);
                }}
                onFocus={() => setHoveredId(l.id)}
                onBlur={() => setHoveredId(null)}
                className="relative -translate-x-1/2 -translate-y-1/2 w-[40px] h-[40px] min-w-[40px] min-h-[40px] rounded-full bg-[#1A1A1E] border-[2.5px] flex items-center justify-center shadow-lg transition-opacity duration-150"
                style={{
                  borderColor: ring,
                  opacity: isDimmed ? 0.3 : 1,
                  // ensure constant pixel size regardless of zoom - we already keep 32px fixed
                }}
                aria-label={`${l.title} ${l.abilitySlot}`}
              >
                {ability?.displayIcon ? (
                  <img
                    src={ability.displayIcon}
                    alt=""
                    className="w-5 h-5 object-contain"
                    style={{ filter: "invert(36%) sepia(80%) saturate(1800%) hue-rotate(325deg) brightness(1.1)" }}
                  />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-accent" />
                )}
              </button>
            </div>
          );
        })}

        {/* Hover path + start marker */}
        {hovered && (() => {
          const startPos = getMarkerPos(hovered.start);
          const endPos = getMarkerPos(hovered.end);
          const bouncePos = hovered.bounces.map(getMarkerPos);
          // Build SVG path points
          const points = [startPos, ...bouncePos, endPos];
          // create SVG that covers full container
          return (
            <>
              <svg
                className="absolute inset-0 pointer-events-none"
                width={containerSize.w}
                height={containerSize.h}
                style={{ overflow: "visible" }}
              >
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#E8404F" />
                  </marker>
                </defs>
                {/* smooth line via path with quadratic-ish */}
                <path
                  d={points.reduce((acc, p, i) => {
                    if (i === 0) return `M ${p.x} ${p.y}`;
                    const prev = points[i - 1];
                    // create slight curve: midpoint control
                    const mx = (prev.x + p.x) / 2;
                    const my = (prev.y + p.y) / 2 - 12; // up arc
                    return `${acc} Q ${mx} ${my} ${p.x} ${p.y}`;
                  }, "")}
                  stroke="#E8404F"
                  strokeWidth="2.5"
                  fill="none"
                  markerEnd="url(#arrow)"
                  strokeDasharray="6 4"
                  opacity="0.95"
                  style={{ animation: "dash 0.5s linear", transition: "d 150ms ease" }}
                />
                {/* bounces dots */}
                {bouncePos.map((bp, i) => (
                  <circle key={i} cx={bp.x} cy={bp.y} r="5" fill="#EAB308" stroke="#1B1B1F" strokeWidth="2" />
                ))}
              </svg>
              {/* start marker */}
              <div
                className="absolute w-[28px] h-[28px] rounded-full bg-white border-2 border-accent flex items-center justify-center shadow-md -translate-x-1/2 -translate-y-1/2"
                style={{ left: startPos.x, top: startPos.y }}
              >
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Start</span>
              </div>
              {/* end arrow highlight */}
              <div
                className="absolute w-3 h-3 rounded-full bg-accent -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: endPos.x, top: endPos.y }}
              />
            </>
          );
        })()}
      </div>

      {/* Tooltip card near hovered marker */}
      {hovered && tooltipPos && (
        <div
          className="absolute z-30 pointer-events-none bg-panel border border-borderSubtle rounded-md shadow-xl p-3 w-[260px]"
          style={{
            left: Math.min(containerSize.w - 270, Math.max(8, tooltipPos.x + 20)),
            top: Math.max(8, tooltipPos.y - 80),
          }}
        >
          <div className="flex items-start gap-2">
            {(() => {
              const ag = agentsMap.get(hovered.agentUuid);
              const ab = ag?.abilities?.find((a: any) => a.slot === hovered.abilitySlot);
              return ab?.displayIcon ? (
                <img
                  src={ab.displayIcon}
                  alt=""
                  className="w-8 h-8 object-contain bg-tile rounded p-1"
                  style={{ filter: "invert(36%) sepia(80%) saturate(1800%) hue-rotate(325deg)" }}
                />
              ) : null;
            })()}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-textPrimary leading-tight truncate">{hovered.title}</p>
              <p className="text-xs text-muted">{hovered.site ? `Site ${hovered.site} • ` : ""}{hovered.throwType ?? "Throw"} • {hovered.side}</p>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold border"
                  style={{
                    borderColor: importanceRing(hovered.importance),
                    color: importanceRing(hovered.importance),
                    background: importanceRing(hovered.importance) + "22",
                  }}
                >
                  {hovered.importance}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                    hovered.difficulty === "easy"
                      ? "border-essential text-essential bg-essential/20"
                      : hovered.difficulty === "hard"
                        ? "border-accent text-accent bg-accent/20"
                        : "border-[#EAB308] text-[#EAB308] bg-[#EAB308]/20"
                  }`}
                >
                  {hovered.difficulty}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {empty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-panel/90 border border-borderSubtle rounded-card p-6 text-center pointer-events-auto">
            <p className="text-textPrimary font-semibold">No lineups match your filters</p>
            <p className="text-muted text-sm mt-1">Try adjusting ability or importance filters</p>
            <button
              onClick={() => {
                // will be handled by parent reset
                const evt = new CustomEvent("reset-filters");
                window.dispatchEvent(evt);
              }}
              className="mt-3 px-4 py-2 rounded bg-accent text-white text-sm font-bold min-h-[40px]"
            >
              Reset filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
