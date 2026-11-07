import { defineConfig } from 'vite';
import { sharedConfig } from '@lineuplab/ui/vite';
export default defineConfig({ ...sharedConfig, base: './' });
