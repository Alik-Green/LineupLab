import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    cors: true,
    hmr: {
      host: "localhost",
    },
    // @ts-ignore allow all hosts for preview proxy
    allowedHosts: true as any,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
  },
});
