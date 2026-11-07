import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "@lineuplab/ui/App";
import "@lineuplab/ui/styles";
async function boot() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("mock")) {
    const { installMockTauri } = await import("@lineuplab/ui/lib/mock-tauri");
    installMockTauri();
  }
  createRoot(document.getElementById("root")!).render(<React.StrictMode><App platform="desktop" /></React.StrictMode>);
}
void boot();
