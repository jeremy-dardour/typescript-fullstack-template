import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        'format-date': 'src/format-date.ts',
      },
      formats: ['es', 'cjs'],
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
