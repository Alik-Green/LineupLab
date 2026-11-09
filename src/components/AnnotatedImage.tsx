import { useRef, useState, useEffect } from "react";

function isVideoSrc(src: string) {
  const lower = src.split("?")[0].split("#")[0].toLowerCase();
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
}

export default function AnnotatedImage({
  src,
  circles,
}: {
  src: string;
  circles?: { id: string; x: number; y: number; r?: number; color?: string; label?: string }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoomPos, setZoomPos] = useState<{ x: number; y: number } | null>(null);
  const [zoomActive, setZoomActive] = useState(false);

  const isVideo = isVideoSrc(src);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showLens = zoomActive && zoomPos && size.w >= 200 && !isVideo;

  const handleMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const cx = Math.max(0, Math.min(1, x));
    const cy = Math.max(0, Math.min(1, y));
    setZoomPos({ x: cx, y: cy });
  };

  // Blob URLs from IndexedDB may be video blobs with correct MIME - still rely on extension as hint
  // If extension is mp4 but blob is image, browser will fail; fallback to img tag would be better
  // We use extension as primary, but also handle load error fallback

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[16/9] bg-[#0E0E10] rounded-md overflow-hidden border border-borderSubtle select-none"
      onMouseEnter={() => setZoomActive(true)}
      onMouseLeave={() => { setZoomActive(false); setZoomPos(null); }}
      onMouseMove={handleMove}
    >
      {isVideo ? (
        <video src={src} controls playsInline className="w-full h-full object-contain bg-black" preload="metadata" />
      ) : (
        <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
      )}
      {/* SVG circles overlay - not for video */}
      {!isVideo && circles && circles.length > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {circles.map((c) => (
            <g key={c.id}>
              <circle cx={c.x * 100} cy={c.y * 100} r={(c.r ?? 0.03) * 100} fill="none" stroke={c.color ?? "#E04050"} strokeWidth={1.2} strokeDasharray="2 1" />
              {c.label && (
                <text x={c.x * 100} y={c.y * 100 - (c.r ?? 0.03) * 100 - 1} fontSize={3} fill={c.color ?? "#E04050"} textAnchor="middle" fontWeight={700}>
                  {c.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      )}
      {showLens && zoomPos && (
        <div
          className="absolute w-[140px] h-[140px] rounded-full border-2 border-white shadow-xl pointer-events-none overflow-hidden bg-black"
          style={{
            left: `clamp(0px, calc(${zoomPos.x * 100}% - 70px), calc(100% - 140px))`,
            top: `clamp(0px, calc(${zoomPos.y * 100}% - 70px), calc(100% - 140px))`,
          }}
        >
          <div
            className="w-[280px] h-[280px] absolute"
            style={{
              left: `calc(70px - ${zoomPos.x * 100}% * 2)`,
              top: `calc(70px - ${zoomPos.y * 100}% * 2)`,
              backgroundImage: `url(${src})`,
              backgroundSize: `${size.w * 2}px ${size.h * 2}px`,
              backgroundPosition: `${-zoomPos.x * size.w * 2 + 70}px ${-zoomPos.y * size.h * 2 + 70}px`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-px h-6 bg-white/80" />
            <div className="h-px w-6 bg-white/80 absolute" />
          </div>
        </div>
      )}
      {showLens && zoomPos && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <line x1={zoomPos.x * size.w} y1={zoomPos.y * size.h} x2={Math.max(70, Math.min(size.w - 70, zoomPos.x * size.w))} y2={Math.max(70, Math.min(size.h - 70, zoomPos.y * size.h))} stroke="rgba(255,255,255,0.7)" strokeWidth={1} strokeDasharray="3 3" />
        </svg>
      )}
    </div>
  );
}
