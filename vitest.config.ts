import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@ui': fileURLToPath(new URL('./ui/src', import.meta.url)), '@data': fileURLToPath(new URL('./core/data', import.meta.url)) } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./ui/src/test-setup.ts'], include: ['ui/src/**/*.test.{ts,tsx}'] },
});
