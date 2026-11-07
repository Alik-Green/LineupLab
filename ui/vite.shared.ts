import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export const sharedConfig = {
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@ui': fileURLToPath(new URL('./src', import.meta.url)), '@data': fileURLToPath(new URL('../core/data', import.meta.url)) } },
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'], proxy: { '/api': 'http://127.0.0.1:8765', '/media': 'http://127.0.0.1:8765', '/art': 'http://127.0.0.1:8765' } },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 900 },
};
