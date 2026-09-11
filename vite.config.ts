import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // Nombre fijo (sin hash) para que publicar el build sea siempre igual.
        entryFileNames: 'juego.js',
        chunkFileNames: 'juego-[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
