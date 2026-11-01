import { defineConfig, devices } from '@playwright/test';

/*
 * End-to-End-Tests gegen den Produktions-Build (inkl. Service Worker).
 * iPhone-Breite 390 px, WebKit-ähnliche Darstellung über Chromium.
 */
export default defineConfig({
  // privat/ enthält Tests mit den persönlichen Startdaten (nicht im Repository).
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'privat/**/*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'iphone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }],
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
