// Fügt die Screenshots je Modus zu einem Übersichtsbild zusammen (nur oberer Bildschirmbereich).
//   node scripts/uebersichtsbild.mjs
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const basis = join(process.cwd(), 'screenshots');
const browser = await chromium.launch();
for (const modus of ['hell', 'dunkel']) {
  const dateien = readdirSync(join(basis, modus)).filter((f) => f.endsWith('.png')).sort();
  const kacheln = dateien
    .map((f) => {
      const b64 = readFileSync(join(basis, modus, f)).toString('base64');
      return `<figure><div class="bild" style="background-image:url(data:image/png;base64,${b64})"></div><figcaption>${f.replace('.png', '').replace(/^\d+-/, '')}</figcaption></figure>`;
    })
    .join('');
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await page.setContent(`<style>
    body{margin:0;padding:24px;background:${modus === 'hell' ? '#e5e5ea' : '#2c2c2e'};font:600 15px system-ui;color:${modus === 'hell' ? '#000' : '#fff'}}
    main{display:grid;grid-template-columns:repeat(5,1fr);gap:20px}
    figure{margin:0}.bild{width:100%;aspect-ratio:390/844;background-size:100% auto;background-repeat:no-repeat;border-radius:18px;box-shadow:0 4px 16px rgba(0,0,0,.25)}
    figcaption{margin-top:6px;text-align:center}
  </style><main>${kacheln}</main>`);
  await page.screenshot({ path: join(basis, `uebersicht-${modus}.png`), fullPage: true });
  await page.close();
}
await browser.close();
console.log('Übersichtsbilder erzeugt.');
