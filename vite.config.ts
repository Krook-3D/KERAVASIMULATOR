import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // MapLibre alone is ~1 MB; keep it in its own cacheable chunk.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: { manualChunks: { maplibre: ['maplibre-gl'] } },
    },
  },
});
