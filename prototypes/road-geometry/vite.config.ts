import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two pages: the road geometry demo and the puzzle interaction prototype.
export default defineConfig({
  build: {
    rollupOptions: {
      input: { geometry: resolve(import.meta.dirname, 'index.html'), puzzle: resolve(import.meta.dirname, 'puzzle.html') },
    },
  },
});
