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
  showEmpty?: boolean;
};

function importanceRing(imp: string) {
  if (imp === "essential") return "#22C55E";
  if (imp === "optional") return "#E8404F";
  return "#EDEDED";
}

function calloutToNorm(c: any, map: ValorantMap): { x: number; y: number } | null {
  if (!c?.location || map.xMultiplier == null || map.yMultiplier == null) return null;
  // Valorant API axes are swapped: world Y -> minimap X, world X -> minimap Y
  const x = c.location.y * (map.xMultiplier as number) + (map.xScalarToAdd as number);
  const y = c.location.x * (map.yMultiplier as number) + (map.yScalarToAdd as number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < -0.2 || x > 1.2 || y < -0.2 || y > 1.2) return null;
  return { x, y };
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
  showEmpty = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [showCallouts, setShowCallouts] = useState(false);

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

  const baseImageSize = useMemo(() => {
    const s = Math.min(containerSize.w * 0.82, containerSize.h * 0.82, 680);
    return { w: s, h: s };
  }, [containerSize]);

  const zoomClamp = (z: number) => Math.min(4, Math.max(1, z));
  const clampPan = (p: { x: number; y: number }, z: number = zoom) => {
    // keep map roughly within viewport: max pan scales with zoom, but never lets image disappear
    // at zoom 1, max pan ~ 0.25*baseSize; at zoom 4, max pan ~ baseSize*zoom*0.5
    const imgW = baseImageSize.w * z;
    const imgH = baseImageSize.h * z;
    // Allow panning until image edge is near container edge
    const maxX = Math.max(imgW * 0.5, containerSize.w * 0.45);
    const maxY = Math.max(imgH * 0.5, containerSize.h * 0.45);
    return {
      x: Math.max(-maxX, Math.min(maxX, p.x)),
      y: Math.max(-maxY, Math.min(maxY, p.y)),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, pan: { ...pan } };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging && dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      onPan(clampPan({ x: dragStart.current.pan.x + dx, y: dragStart.current.pan.y + dy }));
    }
  };
  const onMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      const newZoom = zoomClamp(zoom + delta);
      if (newZoom === zoom) return;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const centerX = containerSize.w / 2 + pan.x;
      const centerY = containerSize.h / 2 + pan.y;
      const imgW = baseImageSize.w * zoom;
      const imgH = baseImageSize.h * zoom;
      const imgLeft = centerX - imgW / 2;
      const imgTop = centerY - imgH / 2;
      const normX = imgW ? (cx - imgLeft) / imgW : 0.5;
      const normY = imgH ? (cy - imgTop) / imgH : 0.5;
      const newImgW = baseImageSize.w * newZoom;
      const newImgH = baseImageSize.h * newZoom;
      const newCenterX = cx - (normX - 0.5) * newImgW;
      const newCenterY = cy - (normY - 0.5) * newImgH;
      const newPan = { x: newCenterX - containerSize.w / 2, y: newCenterY - containerSize.h / 2 };
      onPan(clampPan(newPan, newZoom));
      onZoom(newZoom);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler as any);
  }, [zoom, pan, containerSize, baseImageSize, onZoom, onPan]);

  const touchState = useRef<{ dist: number; zoom: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
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
      onPan(clampPan({ x: dragStart.current.pan.x + dx, y: dragStart.current.pan.y + dy }));
    }
  };
  const onTouchEnd = () => {
    setIsDragging(false);
    touchState.current = null;
  };

  const getMarkerPos = (pt: { x: number; y: number }) => {
    const cx = containerSize.w / 2 + pan.x;
    const cy = containerSize.h / 2 + pan.y;
    const imgW = baseImageSize.w * zoom;
    const imgH = baseImageSize.h * zoom;
    const x = cx + (pt.x - 0.5) * imgW;
    const y = cy + (pt.y - 0.5) * imgH;
    return { x, y };
  };

  const hovered = lineups.find((l) => l.id === hoveredId) ?? null;

  const calloutsList = useMemo(() => {
    if (!map || !(map as any).callouts || !Array.isArray((map as any).callouts)) return [];
    const list: any[] = (map as any).callouts;
    return list
      .map((c) => {
        const norm = calloutToNorm(c, map);
        if (!norm) return null;
        return { label: c.regionName ?? c.superRegionName ?? "?", superRegion: c.superRegionName, norm };
      })
      .filter(Boolean) as { label: string; superRegion: string; norm: { x: number; y: number } }[];
  }, [map]);

  if (!map) {
    return (
      <div className="flex-1 bg-pageBg flex items-center justify-center text-muted">
        Select a map
      </div>
    );
  }

  const empty = showEmpty && lineups.length === 0;

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
        onPan(clampPan({ x: 0, y: 0 }, 1));
      }}
      style={{ cursor: isDragging ? "grabbing" : "grab", touchAction: "none" } as any}
    >
      <div className="absolute inset-0">
        <ValImage src={map.splash} alt="" className="w-full h-full opacity-20 blur-[12px] scale-105" />
        <div className="absolute inset-0 bg-[#1B1B1F]/40" />
      </div>

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
          onError={() => console.warn("[Minimap] minimap load failed", map.displayIcon)}
        />
      </div>

      {/* zoom buttons removed — zoom via scroll wheel / pinch only */}

      {calloutsList.length > 0 && (
        <div
          className="absolute top-4 left-4 flex rounded-md overflow-hidden border border-borderSubtle bg-panel shadow-lg z-20"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowCallouts((v) => !v); }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`px-3 h-10 flex items-center justify-center text-xs font-bold min-h-[40px] ${showCallouts ? "bg-accent text-white" : "text-textPrimary hover:bg-tile"}`}
            aria-pressed={showCallouts}
          >
            Callouts
          </button>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none">
        {showCallouts &&
          calloutsList.map((c, i) => {
            const p = getMarkerPos(c.norm);
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: p.x, top: p.y }}
              >
                <span className="px-1.5 py-0.5 rounded bg-black/70 text-white text-[8px] font-semibold border border-white/20 whitespace-nowrap">
                  {c.label}
                </span>
              </div>
            );
          })}
      </div>

      <div className="absolute inset-0">
        {lineups.map((l) => {
          const pos = getMarkerPos(l.end);
          const isHovered = hoveredId === l.id;
          const isDimmed = hoveredId !== null && hoveredId !== l.id;
          const agent = agentsMap.get(l.agentUuid);
          const ability = agent?.abilities?.find((a: any) => a.slot === l.abilitySlot);
          const ring = importanceRing(l.importance);
          return (
            <div key={l.id} style={{ position: "absolute", left: pos.x, top: pos.y, zIndex: isHovered ? 20 : 5 }}>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onMouseEnter={() => {
                  setHoveredId(l.id);
                  setTooltipPos({ x: pos.x, y: pos.y });
                }}
                onMouseLeave={() => {
                  setHoveredId(null);
                  setTooltipPos(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
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

        {hovered && (() => {
          const startPos = getMarkerPos(hovered.start);
          const endPos = getMarkerPos(hovered.end);
          const bouncePos = hovered.bounces.map(getMarkerPos);
          const points = [startPos, ...bouncePos, endPos];
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
                <path
                  d={points.reduce((acc, p, i) => {
                    if (i === 0) return `M ${p.x} ${p.y}`;
                    const prev = points[i - 1];
                    const mx = (prev.x + p.x) / 2;
                    const my = (prev.y + p.y) / 2 - 12;
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
                {bouncePos.map((bp, i) => (
                  <circle key={i} cx={bp.x} cy={bp.y} r="5" fill="#EAB308" stroke="#1B1B1F" strokeWidth="2" />
                ))}
              </svg>
              <div
                className="absolute w-[28px] h-[28px] rounded-full bg-white border-2 border-accent flex items-center justify-center shadow-md -translate-x-1/2 -translate-y-1/2"
                style={{ left: startPos.x, top: startPos.y }}
              >
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Start</span>
              </div>
              <div
                className="absolute w-3 h-3 rounded-full bg-accent -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: endPos.x, top: endPos.y }}
              />
            </>
          );
        })()}
      </div>

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

      {empty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-panel/90 border border-borderSubtle rounded-card p-6 text-center pointer-events-auto">
            <p className="text-textPrimary font-semibold">No lineups match your filters</p>
            <p className="text-muted text-sm mt-1">Try adjusting ability or importance filters</p>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
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
