import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  build: {
    outDir: 'dist',                // Unified output folder for static hosting
    sourcemap: false,              // Disabled for faster and lightweight builds
    chunkSizeWarningLimit: 1200,   // Optimized for Recharts and Framer Motion
  },
});
