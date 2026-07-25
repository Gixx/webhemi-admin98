import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 8765,
    open: true,
  },
  build: {
  // Owned chrome uses `@media (not (hover))`; keep minify off if lightningcss still rejects related queries.
  cssMinify: false,
  },
});
