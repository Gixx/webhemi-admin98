import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 8765,
    open: true,
  },
  build: {
    // Owned chrome uses `@media (not (hover))`; keep minify off if lightningcss still rejects related queries.
    cssMinify: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        catalog: resolve(__dirname, 'catalog.html'),
      },
    },
  },
});
