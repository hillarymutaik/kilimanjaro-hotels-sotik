import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const API = 'http://localhost:' + (process.env.PORT || 3001);

// VITE_STATIC=1 builds only the public site for GitHub Pages (no server, no admin).
const STATIC = process.env.VITE_STATIC === '1';

export default defineConfig({
  plugins: [react()],
  // On GitHub Pages the site lives under /<repo>/, set via BASE_PATH.
  base: process.env.BASE_PATH || '/',
  // Two pages: the public site (/) and the admin panel (/admin/),
  // so guests never download admin code.
  build: {
    rollupOptions: {
      input: STATIC
        ? { main: resolve(__dirname, 'index.html') }
        : {
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
