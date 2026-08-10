import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createAiProxyMiddleware } from './server/aiProxy.js';

function localAiProxy() {
  return {
    name: 'local-ai-proxy',
    configureServer(server) {
      server.middlewares.use(createAiProxyMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createAiProxyMiddleware());
    },
  };
}

export default defineConfig({
  plugins: [react(), localAiProxy()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
});
