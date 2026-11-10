import { useCallback, useEffect, useState } from "react";
import type { Lineup } from "../types/lineup";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type OverlaySize = "small" | "medium" | "large" | "custom";

const STORAGE_KEY = "lineuplab.overlay.prefs";

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

function isTauriEnvSync(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.__TAURI__ || w.__TAURI_INTERNALS__ || w.__TAURI_IPC__ || w.__TAURI_METADATA__);
}

export function useTauriOverlay() {
  const [isTauri, setIsTauri] = useState<boolean>(() => isTauriEnvSync());
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [corner, setCornerState] = useState<Corner>(() => getPrefs().corner);
  const [size, setSizeState] = useState<OverlaySize>(() => getPrefs().size);
  const [customW, setCustomW] = useState(() => getPrefs().customW);
  const [customH, setCustomH] = useState(() => getPrefs().customH);
  const [opacity, setOpacity] = useState(() => getPrefs().opacity);

  // Robust Tauri detection: check sync flag + try invoke in async
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (isTauriEnvSync()) {
        if (!cancelled) setIsTauri(true);
        return;
      }
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        // Any invoke will succeed only in Tauri
        await invoke("is_valorant_running");
        if (!cancelled) setIsTauri(true);
      } catch {
        // not Tauri - stay false (browser fallback will show message instead of popup)
      }
      // Also listen for Tauri late injection
      const interval = setInterval(() => {
        if (isTauriEnvSync()) {
          setIsTauri(true);
          clearInterval(interval);
        }
      }, 300);
      setTimeout(() => clearInterval(interval), 5000);
    };
    check();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    savePrefs({ corner, size, customW, customH, opacity });
  }, [corner, size, customW, customH, opacity]);

  const getWindowSize = useCallback(() => {
    if (size === "small") return { w: 320, h: 220 };
    if (size === "large") return { w: 520, h: 380 };
    if (size === "custom") return { w: customW, h: customH };
    return { w: 420, h: 300 };
  }, [size, customW, customH]);

  const openOverlay = useCallback(async (lineup: Lineup | null) => {
    if (!lineup) return;
    // Always persist for overlay window to read (both Tauri and browser)
    try {
      localStorage.setItem("lineuplab.overlay", JSON.stringify({ lineup, idx: 0, ts: Date.now() }));
      // BroadcastChannel for cross-window sync (also used by overlay)
      const bc = new BroadcastChannel("lineuplab-overlay");
      bc.postMessage({ type: "overlay:update", lineup, idx: 0 });
      bc.close();
    } catch {}

    // If NOT Tauri (browser), we do NOT open in-app popup — user wants only outside window.
    // Show a toast/info instead: overlay requires desktop app.
    if (!isTauri) {
      console.warn("Overlay requires Tauri desktop app — not available in browser. Saved to localStorage for companion.");
      // Still mark as open for UI badge, but do NOT trigger in-app modal.
      // Optionally, we could setOverlayOpen(true) to show "Open in desktop app" message elsewhere.
      // For now keep overlayOpen false in browser so no popup appears.
      return;
    }

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_overlay", { lineup, idx: 0 });
      setOverlayOpen(true);
      // small re-sync via event/localStorage for robustness
      try {
        const { emit } = await import("@tauri-apps/api/event");
        await emit("overlay:update", { lineup, idx: 0, opacity });
      } catch {}
    } catch (e) {
      console.error("open_overlay invoke failed", e);
      // Fallback: direct emit via event if invoke fails but we are in Tauri
      try {
        const { emit } = await import("@tauri-apps/api/event");
        await emit("overlay:update", { lineup, idx: 0, opacity });
        setOverlayOpen(true);
      } catch (e2) {
        console.error("emit also failed", e2);
        alert("Overlay failed to open: " + String(e));
      }
    }
  }, [isTauri, opacity]);

  const closeOverlay = useCallback(async () => {
    // Persist closed state
    try {
      localStorage.setItem("lineuplab.overlay:closed", String(Date.now()));
    } catch {}
    if (!isTauri) {
      setOverlayOpen(false);
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("close_overlay");
    } catch (e) {
      console.warn("close_overlay failed", e);
    }
    setOverlayOpen(false);
  }, [isTauri]);

  const setCorner = useCallback(async (c: Corner) => {
    setCornerState(c);
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_overlay_corner", { corner: c });
    } catch (e) {
      console.warn("set_overlay_corner failed", e);
    }
  }, [isTauri]);

  const setSize = useCallback(async (s: OverlaySize, w?: number, h?: number) => {
    setSizeState(s);
    if (w) setCustomW(w);
    if (h) setCustomH(h);
    if (!isTauri) return;
    const targetW = s === "custom" ? (w ?? customW) : s === "small" ? 320 : s === "large" ? 520 : 420;
    const targetH = s === "custom" ? (h ?? customH) : s === "small" ? 220 : s === "large" ? 380 : 300;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_overlay_size", { width: targetW, height: targetH });
    } catch (e) {
      console.warn("set_overlay_size failed", e);
    }
  }, [isTauri, customW, customH]);

  const updateOverlayLineup = useCallback(async (lineup: Lineup, idx = 0) => {
    try {
      localStorage.setItem("lineuplab.overlay", JSON.stringify({ lineup, idx, ts: Date.now() }));
      const bc = new BroadcastChannel("lineuplab-overlay");
      bc.postMessage({ type: "overlay:update", lineup, idx });
      bc.close();
    } catch {}
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      // Re-use open_overlay to push new lineup to already-open window (Rust will emit)
      await invoke("open_overlay", { lineup, idx });
    } catch {
      try {
        const { emit } = await import("@tauri-apps/api/event");
        await emit("overlay:update", { lineup, idx, opacity });
      } catch {}
    }
  }, [isTauri, opacity]);

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
  };
}
