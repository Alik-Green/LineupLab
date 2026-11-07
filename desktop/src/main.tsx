import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "@lineuplab/ui/App";
import "@lineuplab/ui/styles";
createRoot(document.getElementById("root")!).render(<React.StrictMode><App platform="desktop" /></React.StrictMode>);
