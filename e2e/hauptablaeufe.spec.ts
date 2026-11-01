import { expect, test, type Page } from '@playwright/test';
import { HEUTE, importiere, mitTestdaten, oeffneLeer, pruefeLayout } from './hilfen';

const summe = (page: Page) => page.locator('.kreis-mitte strong');
const tab = (page: Page, name: string | RegExp) => page.getByRole('navigation').getByRole('button', { name }).click();

test('Nur drei Tabs: Fixkosten, Fixkostenkonto, Sparkonto', async ({ page }) => {
  await mitTestdaten(page);
  await expect(page.getByRole('navigation').getByRole('button')).toHaveText(['Fixkosten', 'Fixkostenkonto', 'Tagesgeld']);
  await expect(summe(page)).toHaveText('1.511,80 €');
  await expect(page.locator('.legende li').first()).toContainText('Wohnen');
});

test('Neuer Posten in 3 Schritten erhöht die Fixkosten', async ({ page }) => {
  await mitTestdaten(page);
  const start = Date.now();
  await page.getByRole('button', { name: 'Neuer Fixkosten-Posten' }).click();
  await page.getByLabel('Name').fill('Zeitung');
  await page.getByLabel('Betrag pro Zahlung').fill('19,90');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Sichern' }).last().click();
  expect(Date.now() - start).toBeLessThan(10_000);
  await expect(summe(page)).toHaveText('1.531,70 €');
  await expect(page.getByRole('status')).toContainText('Zeitung angelegt');
});

test('Umbuchungen zählen nie als Kosten', async ({ page }) => {
  await mitTestdaten(page);
  const vorher = await summe(page).textContent();
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Neu', exact: true }).click();
  await page.getByRole('button', { name: /Umbuchung zwischen Konten/ }).click();
  await page.getByLabel('Betrag').fill('500');
  await page.getByRole('button', { name: 'Sichern', exact: true }).click();
  await page.getByRole('button', { name: /Fixkosten$/ }).first().click();
  await expect(summe(page)).toHaveText(vorher!);
});

test('Fixkostenkonto: Kontostand eintragen und Rücklage für Jahreszahlungen sehen', async ({ page }) => {
  await mitTestdaten(page);
  await tab(page, 'Fixkostenkonto');
  await expect(page.getByText('Rücklage für Jahreszahlungen')).toBeVisible();
  await expect(page.getByText('Jahreszahlungen', { exact: true })).toBeVisible();
  const start = Date.now();
  await page.locator('.konto-karte').click();
  await page.getByLabel('Aktueller Stand').fill('1.234,56');
  await page.getByRole('button', { name: 'Sichern' }).click();
  expect(Date.now() - start).toBeLessThan(10_000);
  await expect(page.locator('.konto-karte')).toContainText('1.234,56 €');
  await expect(page.locator('.status')).toBeVisible();
});

test('Sparkonto: Stand je Eingang eintragen, Gesamtsumme', async ({ page }) => {
  await mitTestdaten(page);
  await tab(page, 'Tagesgeld');
  await page.getByText('Stand eintragen').first().click();
  await page.getByLabel('Stand', { exact: true }).fill('600');
  await page.getByRole('button', { name: 'Sichern' }).click();
  await expect(page.locator('.karte-zahl')).toHaveText('600,00 €');
});

test('Löschen landet im Papierkorb und lässt sich rückgängig machen', async ({ page }) => {
  await mitTestdaten(page);
  await page.getByRole('button', { name: /^Musik/ }).click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('button', { name: /^Musik/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('button', { name: /^Musik/ })).toBeVisible();
});

test('Backup-Import über das Onboarding', async ({ page }) => {
  await oeffneLeer(page);
  const { testdaten } = await import('../src/domain/testdaten');
  await importiere(page, testdaten(HEUTE));
  await expect(page.getByRole('heading', { name: 'Kontostände' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: /^Zur/ }).click();
  await expect(summe(page)).toHaveText('1.511,80 €');
});

for (const groesse of ['100%', '170%']) {
  test(`Keine Überlappungen und kein Zoomen nötig bei Schriftgröße ${groesse}`, async ({ page }) => {
    await mitTestdaten(page);
    await page.addStyleTag({ content: `html { font-size: ${groesse} !important; }` });
    for (const t of [/^Fixkostenkonto/, /^Tagesgeld/, /^Fixkosten$/]) {
      await tab(page, t);
      await pruefeLayout(page);
    }
    await page.getByRole('button', { name: 'Einstellungen' }).click();
    await pruefeLayout(page);
    await tab(page, /^Fixkosten$/);
    await page.getByRole('button', { name: 'Neuer Fixkosten-Posten' }).click();
    await pruefeLayout(page);
  });
}

test('Eingabefelder haben mindestens 16 px (iOS zoomt sonst hinein)', async ({ page }) => {
  await mitTestdaten(page);
  await page.getByRole('button', { name: 'Neuer Fixkosten-Posten' }).click();
  const groessen = await page.locator('.sheet input, .sheet select').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(groessen.length).toBeGreaterThan(0);
  expect(Math.min(...groessen)).toBeGreaterThanOrEqual(16);
});

test('Funktioniert offline nach dem ersten Laden', async ({ page, context }) => {
  await mitTestdaten(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Fixkosten', level: 1 })).toBeVisible();
  await context.setOffline(false);
});
