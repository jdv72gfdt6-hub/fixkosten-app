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
    await page.getByRole('button', { name: /^Zur/ }).click();

    const tab = (n: number) => page.getByRole('navigation').getByRole('button').nth(n).click();
    await expect(page.locator('.kreis')).toBeVisible();
    await bild(page, '04-fixkosten', schema);

    await tab(1);
    await bild(page, '05-fixkostenkonto', schema);

    await tab(2);
    await bild(page, '06-sparen', schema);

    await page.getByRole('button', { name: 'Einstellungen' }).click();
    await bild(page, '07-einstellungen', schema);

    await tab(0);
    await page.getByRole('button', { name: 'Neuer Fixkosten-Posten' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/${schema}/08-neuer-posten.png` });
    await page.getByRole('button', { name: 'Abbrechen' }).click();

    // Beispiel mit Kontostand (anonyme Testdaten)
    await oeffneLeer(page);
    await page.getByRole('button', { name: /Mit Testdaten ausprobieren/ }).click();
    await tab(1);
    await bild(page, '09-beispiel-konto', schema);
  });
}