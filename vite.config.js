import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 8765,
    open: true,
  },
  build: {
    // 98.css uses `@media (not(hover))`, which lightningcss minify rejects.
    cssMinify: false,
  },
});
