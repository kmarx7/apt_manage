/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: '예그린 수도정산',
        short_name: '수도정산',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        background_color: '#eef2f4',
        theme_color: '#eef2f4',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
    }),
  ],
  build: {
    // exceljs·jspdf는 파일을 저장할 때만 불러오는 별도 조각이라 크기 경고 기준을 올린다
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
