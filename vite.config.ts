import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH wird vom GitHub-Pages-Workflow gesetzt (z. B. "/fixkosten-app/").
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Unterkonten',
        short_name: 'Unterkonten',
        description: 'Ein Konto, mehrere Unterkonten, eine Gesamtsumme. Alle Daten bleiben auf dem Gerät.',
        lang: 'de',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F2F7',
        theme_color: '#F2F2F7',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  // Eine Datei für alles ist bei einer Offline-PWA unkritisch (wird einmal gecacht).
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
