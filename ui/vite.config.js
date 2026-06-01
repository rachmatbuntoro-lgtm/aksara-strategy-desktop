import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' is REQUIRED so the built assets load over file:// inside Electron.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
});
