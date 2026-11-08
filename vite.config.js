import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const API = 'http://localhost:' + (process.env.PORT || 3001);

export default defineConfig({
  plugins: [react()],
  // Two pages: the public site (/) and the admin panel (/admin/),
  // so guests never download admin code.
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
  // In development, Vite forwards API and photo requests to the Express server.
  server: {
    proxy: {
      '/api': API,
      '/uploads': API,
    },
  },
});
