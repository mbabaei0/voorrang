import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Pages: landing, rules, design system, the road geometry demo, the puzzle prototype and the flat puzzles.
export default defineConfig({
  // Relative asset paths so the build works under a GitHub Pages subpath.
  base: './',
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        rules: resolve(import.meta.dirname, 'rules.html'),
        design: resolve(import.meta.dirname, 'design-system.html'),
        geometry: resolve(import.meta.dirname, 'geometry.html'),
        puzzle: resolve(import.meta.dirname, 'puzzle.html'),
        flat: resolve(import.meta.dirname, 'flat.html'),
      },
    },
  },
});
