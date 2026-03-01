import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,

    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'tanstack-vendor': ['@tanstack/react-query'],
          'ui-vendor': ['zustand'],
        },
      },
    },

    // Optimization
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
    reportCompressedSize: false,
  },

  server: {
    port: 3000,
  },
});
