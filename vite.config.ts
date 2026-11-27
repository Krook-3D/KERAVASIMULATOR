import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The game server (server/, port 8787) behind the same origin, so the session cookie just works.
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8787' },
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  build: {
    // three.js is large; keep it in its own cacheable chunk.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: { manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'] } },
    },
  },
});
