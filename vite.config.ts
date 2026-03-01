import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html'),
        'hello-world': resolve(__dirname, 'examples/hello-world/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: '/',
  },
  preview: {
    port: 4173,
    open: '/',
  },
  esbuild: {
    // Use esbuild for faster transforms
    target: 'es2022',
  },
  optimizeDeps: {
    // Force include TypeScript source
    include: [],
  },
});
