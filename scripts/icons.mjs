// Erzeugt die PNG-App-Icons aus public/icon.svg (einmalig nach Änderungen am Icon ausführen).
//   node scripts/icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const groessen = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

const browser = await chromium.launch();
for (const [name, px] of groessen) {
  const page = await browser.newPage({ viewport: { width: px, height: px } });
  // Apple-Icons ohne eigene Rundung (iOS rundet selbst) und ohne Transparenz.
  const inhalt = name.startsWith('apple') ? svg.replace('rx="112"', 'rx="0"') : svg;
  await page.setContent(`<style>html,body{margin:0;background:#0A84FF}</style>${inhalt.replace('<svg ', `<svg width="${px}" height="${px}" `)}`);
  await page.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1') });
  await page.close();
}
await browser.close();
console.log('Icons erzeugt.');
