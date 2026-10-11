import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `host: true` binds the dev server to every interface so phones and other
// computers on your network can open it at http://<your-lan-ip>:5173.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/api': { target: 'http://localhost:3000' },
    },
  },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
