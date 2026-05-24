import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rendererRoot = fileURLToPath(new URL('./src/renderer', import.meta.url));
const sharedRoot = fileURLToPath(new URL('./src/shared', import.meta.url));

export default defineConfig({
  root: rendererRoot,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@renderer': rendererRoot,
      '@shared': sharedRoot,
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: '../../.vite/renderer/main_window',
    emptyOutDir: true,
  },
  clearScreen: false,
});
