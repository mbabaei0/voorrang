import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two pages: the road geometry demo and the puzzle interaction prototype.
export default defineConfig({
  // Relative asset paths so the build works under a GitHub Pages subpath.
  base: './',
  build: {
    rollupOptions: {
      input: { geometry: resolve(import.meta.dirname, 'index.html'), puzzle: resolve(import.meta.dirname, 'puzzle.html') },
    },
  },
});
