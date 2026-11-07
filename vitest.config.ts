import { defineConfig } from 'vitest/config';
import { sharedConfig } from './ui/vite.shared';
export default defineConfig({ ...sharedConfig, test: { environment: 'jsdom', include: ['ui/**/*.test.{ts,tsx}'], globals: true, setupFiles: [] } });
