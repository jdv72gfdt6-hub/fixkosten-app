import { expect, type Page } from '@playwright/test';
import { erstelleBackup } from '../src/domain/backup';
import { STANDARD_EINSTELLUNGEN } from '../src/domain/standard';
import { testdaten } from '../src/domain/testdaten';
import type { Daten } from '../src/domain/typen';

export const HEUTE = '2026-11-01';

/** Frische App mit festem "Heute" öffnen (leere Datenbank). */
export async function oeffneLeer(page: Page) {
  await page.goto(`/?heute=${HEUTE}`);
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    await Promise.all(dbs.map((d) => new Promise((r) => { const q = indexedDB.deleteDatabase(d.name!); q.onsuccess = q.onerror = q.onblocked = r; })));
    localStorage.clear();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Fixkosten', level: 1 })).toBeVisible();
}

/** Backup-Datei über das Onboarding importieren. */
export async function importiere(page: Page, daten: Daten, alsOnboarding = true) {
  const json = JSON.stringify(erstelleBackup(daten, { ...STANDARD_EINSTELLUNGEN }, []));
  if (alsOnboarding) await page.getByRole('button', { name: /Startdaten oder Backup importieren/ }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Backup einspielen' }).click();
}

export async function mitTestdaten(page: Page) {
  await oeffneLeer(page);
  await page.getByRole('button', { name: /Mit Testdaten ausprobieren/ }).click();
  await expect(page.locator('.kreis')).toBeVisible();
}

export function testdatenHeute() {
  return testdaten(HEUTE);
}

/** Kein horizontales Scrollen. */
export async function pruefeKeinHorizontalesScrollen(page: Page) {
  const breite = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(breite[0]).toBeLessThanOrEqual(breite[1]!);
}

/** Kein horizontales Scrollen, nichts ragt aus dem Bildschirm, keine überlappenden Texte in Zeilen. */
export async function pruefeLayout(page: Page) {
  const breite = page.viewportSize()!.width;
  const fehler = await page.evaluate((breite) => {
    const f: string[] = [];
    if (innerWidth !== breite) f.push(`Seite breiter als der Bildschirm, Browser zoomt heraus (${innerWidth}px statt ${breite}px)`);
    if (document.documentElement.scrollWidth > innerWidth + 1) f.push(`horizontal scrollbar (${document.documentElement.scrollWidth}px)`);
    const schneidet = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    for (const z of document.querySelectorAll('.zeile, .legende li, .jahres-kopf, .kennzahlen, .feld, .navleiste')) {
      const kinder = [...z.children].filter((c) => {
        const s = getComputedStyle(c);
        return c.getBoundingClientRect().width > 0 && s.position !== 'absolute' && s.opacity !== '0';
      });
      for (let i = 0; i < kinder.length; i++)
        for (let j = i + 1; j < kinder.length; j++)
          if (schneidet(kinder[i]!.getBoundingClientRect(), kinder[j]!.getBoundingClientRect())) f.push(`Überlappung: "${kinder[i]!.textContent?.slice(0, 30)}" / "${kinder[j]!.textContent?.slice(0, 30)}"`);
    }
    for (const el of document.querySelectorAll('main *, .sheet *')) {
      if (el.closest('.chips')) continue; // waagerecht wischbare Vorlagen-Leiste
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > innerWidth + 1 || r.left < -1)) f.push(`ragt heraus: ${el.className} "${el.textContent?.slice(0, 30)}"`);
    }
    return f.slice(0, 10);
  }, breite);
  expect(fehler).toEqual([]);
}