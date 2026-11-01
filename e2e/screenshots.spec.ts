/*
 * Screenshots aller Hauptansichten in hell und dunkel (390 px Breite).
 *   npm run screenshots   → Ordner screenshots/ (nicht im Repository, kann persönliche Daten enthalten)
 * Nutzt die persönlichen Startdaten aus privat/, sonst die anonymen Testdaten.
 */
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Daten } from '../src/domain/typen';
import { HEUTE, importiere, oeffneLeer } from './hilfen';

const privat = existsSync(new URL('../privat/startdaten.ts', import.meta.url));

async function bild(page: Page, name: string, schema: string) {
  await page.waitForTimeout(350);
  // Für ganzseitige Bilder Tab-Leiste und +-Knopf ans Seitenende setzen (sonst mitten im Bild).
  const stil = await page.addStyleTag({ content: '.tabbar,.fab{position:absolute!important}' });
  await page.screenshot({ path: `screenshots/${schema}/${name}.png`, fullPage: true });
  await stil.evaluate((el) => (el as HTMLElement).remove());
}

for (const schema of ['hell', 'dunkel'] as const) {
  test(`Screenshots ${schema}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: schema === 'hell' ? 'light' : 'dark', reducedMotion: 'reduce' });
    await oeffneLeer(page);
    await bild(page, '01-onboarding', schema);

    const pfad = '../privat/startdaten';
    const daten: Daten = privat ? ((await import(pfad)) as { startdaten: Daten }).startdaten : (await import('../src/domain/testdaten')).testdaten(HEUTE);
    await importiere(page, daten);
    await expect(page.getByRole('heading', { name: 'Kontostände' })).toBeVisible();
    await bild(page, '02-onboarding-kontostaende', schema);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await bild(page, '03-onboarding-ruecklagen-check', schema);
    await page.getByRole('button', { name: 'Zur Übersicht' }).click();

    const tab = (n: string) => page.getByRole('navigation').getByRole('button', { name: n }).click();
    await expect(page.getByRole('heading', { name: 'Übersicht', level: 1 })).toBeVisible();
    await bild(page, '04-uebersicht', schema);

    await tab('Konten');
    await bild(page, '05-konten', schema);
    await page.locator('.zeile', { hasText: daten.konten.find((k) => k.rolle === 'fixkosten')!.name }).first().click();
    await bild(page, '06-konto-detail', schema);
    await page.getByRole('button', { name: /Konten$/ }).first().click();
    await page.getByRole('button', { name: 'Geldfluss' }).click();
    await bild(page, '07-geldfluss', schema);

    await tab('Kalender');
    await bild(page, '08-kalender', schema);
    await page.getByRole('button', { name: 'Monatsabschluss' }).click();
    await bild(page, '09-monatsabschluss', schema);

    await tab('Verträge');
    await bild(page, '10-vertraege', schema);
    await page.getByRole('button', { name: 'Bald kündbar' }).click();
    await bild(page, '11-bald-kuendbar', schema);

    await tab('Einstellungen');
    await bild(page, '12-einstellungen', schema);

    await page.getByRole('button', { name: 'Neuer Eintrag' }).click();
    await page.getByRole('button', { name: /Fixkosten-Posten/ }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/${schema}/13-neuer-posten.png` });
    await page.getByRole('button', { name: 'Abbrechen' }).click();

    // Beispiel mit Kontoständen: Prognose und Warnungen (anonyme Testdaten)
    await oeffneLeer(page);
    await page.getByRole('button', { name: /Mit Testdaten ausprobieren/ }).click();
    await tab('Konten');
    await page.locator('.zeile', { hasText: 'Fixkostenkonto' }).first().click();
    await bild(page, '14-beispiel-prognose', schema);
  });
}
