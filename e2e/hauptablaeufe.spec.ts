import { expect, test } from '@playwright/test';
import { HEUTE, importiere, mitTestdaten, oeffneLeer, pruefeKeinHorizontalesScrollen } from './hilfen';

const kachel = (name: string) => `.kachel:has-text("${name}") .kachel-wert`;

test('Onboarding mit Testdaten führt zur Übersicht mit allen Kacheln', async ({ page }) => {
  await mitTestdaten(page);
  for (const t of ['Fixkosten / Monat', 'Frei verfügbar', 'Bald kündbar', 'Preiserhöhungen']) {
    await expect(page.locator('.kachel', { hasText: t })).toBeVisible();
  }
  await expect(page.locator(kachel('Fixkosten / Monat'))).toHaveText('1.511,80 €');
});

test('Neuer Posten in 3 Schritten erhöht die Fixkosten', async ({ page }) => {
  await mitTestdaten(page);
  const start = Date.now();
  await page.getByRole('button', { name: 'Neuer Eintrag' }).click();
  await page.getByRole('button', { name: /Fixkosten-Posten/ }).click();
  await page.getByLabel('Name').fill('Zeitung');
  await page.getByLabel('Betrag pro Zahlung').fill('19,90');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Sichern' }).last().click();
  expect(Date.now() - start).toBeLessThan(10_000);
  await expect(page.locator(kachel('Fixkosten / Monat'))).toHaveText('1.531,70 €');
  await expect(page.getByRole('status')).toContainText('Zeitung angelegt');
});

test('Umbuchungen zählen nie als Kosten', async ({ page }) => {
  await mitTestdaten(page);
  const vorher = await page.locator(kachel('Fixkosten / Monat')).textContent();
  await page.getByRole('button', { name: 'Neuer Eintrag' }).click();
  await page.getByRole('button', { name: /Umbuchung zwischen Konten/ }).click();
  await page.getByLabel('Betrag').fill('500');
  await page.getByRole('button', { name: 'Sichern' }).click();
  await expect(page.locator(kachel('Fixkosten / Monat'))).toHaveText(vorher!);
});

test('Kontostand aktualisieren in unter 10 Sekunden', async ({ page }) => {
  await mitTestdaten(page);
  const start = Date.now();
  await page.getByRole('button', { name: 'Neuer Eintrag' }).click();
  await page.getByRole('button', { name: 'Kontostand aktualisieren' }).click();
  await page.getByLabel('Aktueller Stand').fill('1.234,56');
  await page.getByRole('button', { name: 'Sichern' }).click();
  expect(Date.now() - start).toBeLessThan(10_000);
  await expect(page.getByText('1.234,56 €').first()).toBeVisible();
});

test('Löschen landet im Papierkorb und lässt sich rückgängig machen', async ({ page }) => {
  await mitTestdaten(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Verträge' }).click();
  await page.getByRole('button', { name: /^Musik/ }).click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('button', { name: /^Musik/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('button', { name: /^Musik/ })).toBeVisible();
});

test('Backup-Import mit Vorschau und Monatsabschluss', async ({ page }) => {
  await oeffneLeer(page);
  const { testdaten } = await import('../src/domain/testdaten');
  await importiere(page, testdaten(HEUTE));
  await expect(page.getByRole('heading', { name: 'Kontostände' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Kalender' }).click();
  await page.getByRole('button', { name: 'Monatsabschluss' }).click();
  const erste = page.getByRole('checkbox').first();
  await erste.click();
  await expect(erste).toHaveAttribute('aria-checked', 'true');
});

test('Alle Tabs ohne horizontales Scrollen auf 390 px', async ({ page }) => {
  await mitTestdaten(page);
  for (const tab of ['Übersicht', 'Konten', 'Kalender', 'Verträge', 'Einstellungen']) {
    await page.getByRole('navigation').getByRole('button', { name: tab }).click();
    await pruefeKeinHorizontalesScrollen(page);
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Konten' }).click();
  await page.getByRole('button', { name: 'Geldfluss' }).click();
  await pruefeKeinHorizontalesScrollen(page);
});

test('Funktioniert offline nach dem ersten Laden', async ({ page, context }) => {
  await mitTestdaten(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Übersicht', level: 1 })).toBeVisible();
  await context.setOffline(false);
});

