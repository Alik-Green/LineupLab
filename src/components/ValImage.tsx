import { useState, useRef } from "react";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  /** optional size for skeleton */
  style?: React.CSSProperties;
  onErrorLog?: (src: string) => void;
};

export default function ValImage({ src, alt, className, fallback, style, onErrorLog }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const retried = useRef(false);

  if (!src || failed) {
    if (fallback) return <>{fallback}</>;
    // graceful fallback: initials/icon
    return (
      <div
        className={`flex items-center justify-center bg-tile text-muted text-xs ${className ?? ""}`}
        style={style}
        aria-label={alt}
        role="img"
      >
        <span className="opacity-60">{alt.slice(0, 2).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} style={style}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-tile" aria-hidden />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          const target = e.currentTarget;
          console.warn(`[ValImage] failed to load: ${src}`, e);
          onErrorLog?.(src ?? "");
          if (!retried.current) {
            retried.current = true;
            // retry once with cache bust
            setTimeout(() => {
              const sep = (src ?? "").includes("?") ? "&" : "?";
              target.src = `${src}${sep}retry=1`;
            }, 300);
          } else {
            setFailed(true);
          }
        }}
        className={`w-full h-full object-cover ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-150`}
        draggable={false}
      />
    </div>
  );
}
