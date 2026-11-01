import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH wird vom GitHub-Pages-Workflow gesetzt (z. B. "/fixkosten-app/").
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Fixkosten',
        short_name: 'Fixkosten',
        description: 'Fixkosten und Konten im Blick – alle Daten bleiben auf dem Gerät.',
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
    // privat/ enthält die Kontrollwerte der persönlichen Startdaten (nicht im Repository).
    include: ['src/**/*.test.ts', 'privat/**/*.test.ts'],
    environment: 'node',
  },
});
