import { useCallback, useEffect, useRef, useState } from "react";
import type { Lineup } from "../types/lineup";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type OverlaySize = "small" | "medium" | "large" | "custom";

const STORAGE_KEY = "lineuplab.overlay.prefs";
const PADDING = 16;

function getPrefs(): { corner: Corner; size: OverlaySize; customW: number; customH: number; opacity: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { corner: "bottom-right", size: "medium", customW: 420, customH: 300, opacity: 0.92 };
}
function savePrefs(p: any) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

export function useTauriOverlay() {
  const [isTauri, setIsTauri] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [corner, setCornerState] = useState<Corner>(() => getPrefs().corner);
  const [size, setSizeState] = useState<OverlaySize>(() => getPrefs().size);
  const [customW, setCustomW] = useState(() => getPrefs().customW);
  const [customH, setCustomH] = useState(() => getPrefs().customH);
  const [opacity, setOpacity] = useState(() => getPrefs().opacity);
  const overlayRef = useRef<any>(null);

  useEffect(() => {
    const tauri = (window as any).__TAURI__;
    setIsTauri(!!(tauri?.window || tauri?.core));
    // Check if overlay window is already open
    (async () => {
      try {
        const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const existing = await WebviewWindow.getByLabel("overlay");
        if (existing) {
          const vis = await existing.isVisible().catch(()=>false);
          setOverlayOpen(!!vis);
          overlayRef.current = existing;
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    savePrefs({ corner, size, customW, customH, opacity });
  }, [corner, size, customW, customH, opacity]);

  const getWindowSize = useCallback(() => {
    if (size === "small") return { w: 320, h: 220 };
    if (size === "large") return { w: 520, h: 380 };
    if (size === "custom") return { w: customW, h: customH };
    return { w: 420, h: 300 }; // medium
  }, [size, customW, customH]);

  const positionWindow = useCallback(async (win: any, targetCorner: Corner = corner) => {
    try {
      const { currentMonitor, PhysicalPosition } = await import("@tauri-apps/api/window");
      const monitor = await currentMonitor();
      if (!monitor) return;
      const factor = monitor.scaleFactor ?? 1;
      const monSize = monitor.size;
      // window size in physical pixels
      const winSize = await win.outerSize();
      const winW = winSize.width;
      const winH = winSize.height;

      let x = 0, y = 0;
      const pad = PADDING * factor;
      switch (targetCorner) {
        case "top-left": x = pad; y = pad; break;
        case "top-right": x = monSize.width - winW - pad; y = pad; break;
        case "bottom-left": x = pad; y = monSize.height - winH - pad; break;
        case "bottom-right": x = monSize.width - winW - pad; y = monSize.height - winH - pad; break;
      }
      await win.setPosition(new PhysicalPosition(x, y));
    } catch (e) {
      console.warn("positionWindow failed", e);
    }
  }, [corner]);

  const ensureOverlayWindow = useCallback(async () => {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    let win = await WebviewWindow.getByLabel("overlay").catch(()=>null);
    if (!win) {
      const { w, h } = getWindowSize();
      win = new WebviewWindow("overlay", {
        url: "index.html?overlay=1",
        title: "LineupLab Overlay",
        width: w,
        height: h,
        minWidth: 280,
        minHeight: 180,
        decorations: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        visible: false,
        shadow: false,
        backgroundColor: "#00000000",
      } as any);
      // Wait for window to be created
      await new Promise(r => setTimeout(r, 600));
      // Ensure always on top
      try { await win.setAlwaysOnTop(true); } catch {}
      // Position to corner
      await positionWindow(win, corner);
    }
    overlayRef.current = win;
    return win;
  }, [corner, getWindowSize, positionWindow]);

  const openOverlay = useCallback(async (lineup: Lineup | null) => {
    if (!lineup) return;
    const tauri = (window as any).__TAURI__;
    if (!tauri) {
      // Browser fallback: use in-app overlay via event
      window.dispatchEvent(new CustomEvent("lineuplab:open-overlay", { detail: { lineup } }));
      setOverlayOpen(true);
      return;
    }
    try {
      const win = await ensureOverlayWindow();
      const { w, h } = getWindowSize();
      try { await win.setSize({ width: w, height: h } as any); } catch {}
      await positionWindow(win, corner);
      // Emit to overlay window
      try {
        const { emit } = await import("@tauri-apps/api/event");
        await emit("overlay:update", { lineup, idx: 0, opacity });
      } catch {
        // Fallback via localStorage + BroadcastChannel
        try {
          localStorage.setItem("lineuplab.overlay", JSON.stringify({ lineup, idx: 0, ts: Date.now() }));
          const bc = new BroadcastChannel("lineuplab-overlay");
          bc.postMessage({ type: "overlay:update", lineup, idx: 0 });
          bc.close();
        } catch {}
      }
      // Also save for overlay window to poll
      try {
        localStorage.setItem("lineuplab.overlay", JSON.stringify({ lineup, idx: 0, ts: Date.now() }));
      } catch {}
      await win.show();
      await win.setFocus();
      try { await win.setAlwaysOnTop(true); } catch {}
      setOverlayOpen(true);

      // Re-position after show (size may have changed)
      setTimeout(()=> positionWindow(win, corner).catch(()=>{}), 300);
    } catch (e) {
      console.error("openOverlay failed", e);
      // Fallback to in-app
      window.dispatchEvent(new CustomEvent("lineuplab:open-overlay", { detail: { lineup } }));
      setOverlayOpen(true);
    }
  }, [corner, ensureOverlayWindow, getWindowSize, opacity, positionWindow]);

  const closeOverlay = useCallback(async () => {
    const tauri = (window as any).__TAURI__;
    if (!tauri) {
      setOverlayOpen(false);
      return;
    }
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const win = await WebviewWindow.getByLabel("overlay").catch(()=>null);
      if (win) {
        await win.hide().catch(()=>{});
        // keep window alive for next open, don't close
      }
    } catch {}
    setOverlayOpen(false);
  }, []);

  const setCorner = useCallback(async (c: Corner) => {
    setCornerState(c);
    if (overlayRef.current) {
      await positionWindow(overlayRef.current, c);
    } else {
      // Try to get window and position
      try {
        const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const win = await WebviewWindow.getByLabel("overlay").catch(()=>null);
        if (win) await positionWindow(win, c);
      } catch {}
    }
  }, [positionWindow]);

  const setSize = useCallback(async (s: OverlaySize, w?: number, h?: number) => {
    setSizeState(s);
    if (w) setCustomW(w);
    if (h) setCustomH(h);
    const targetW = s === "custom" ? (w ?? customW) : s === "small" ? 320 : s === "large" ? 520 : 420;
    const targetH = s === "custom" ? (h ?? customH) : s === "small" ? 220 : s === "large" ? 380 : 300;
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const win = await WebviewWindow.getByLabel("overlay").catch(()=>null);
      if (win) {
        await win.setSize({ width: targetW, height: targetH } as any);
        await positionWindow(win, corner);
      }
    } catch {}
  }, [corner, customH, customW, positionWindow]);

  const updateOverlayLineup = useCallback(async (lineup: Lineup, idx = 0) => {
    try {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("overlay:update", { lineup, idx, opacity });
    } catch {}
    try {
      localStorage.setItem("lineuplab.overlay", JSON.stringify({ lineup, idx, ts: Date.now() }));
      const bc = new BroadcastChannel("lineuplab-overlay");
      bc.postMessage({ type: "overlay:update", lineup, idx });
      bc.close();
    } catch {}
  }, [opacity]);

  return {
    isTauri,
    overlayOpen,
    corner,
    size,
    customW,
    customH,
    opacity,
    openOverlay,
    closeOverlay,
    setCorner,
    setSize,
    setOpacity: (o: number) => setOpacity(o),
    updateOverlayLineup,
    positionWindow,
  };
}
