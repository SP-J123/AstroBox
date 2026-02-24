import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/client')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3536',
      '/health': 'http://localhost:3536'
    }
  },
  build: {
    outDir: '../../dist/public',
    emptyOutDir: true,
    sourcemap: true
  }
});
