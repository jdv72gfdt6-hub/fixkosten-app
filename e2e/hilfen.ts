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
  await expect(page.getByRole('heading', { name: 'Übersicht', level: 1 })).toBeVisible();
}

export function testdatenHeute() {
  return testdaten(HEUTE);
}

/** Kein horizontales Scrollen. */
export async function pruefeKeinHorizontalesScrollen(page: Page) {
  const breite = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(breite[0]).toBeLessThanOrEqual(breite[1]!);
}
