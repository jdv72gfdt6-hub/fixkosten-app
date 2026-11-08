import { expect, test, type Page } from '@playwright/test';

const summe = (page: Page) => page.locator('.summe');
const zeilen = (page: Page) => page.getByRole('list', { name: 'Unterkonten' }).getByRole('button');

async function oeffneLeer(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    await Promise.all(dbs.map((d) => new Promise((r) => { const q = indexedDB.deleteDatabase(d.name!); q.onsuccess = q.onerror = q.onblocked = r; })));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Trade Republic', level: 1 })).toBeVisible();
}

async function neu(page: Page, name: string, betrag: string) {
  await page.getByRole('button', { name: 'Unterkonto hinzufügen' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Stand in Euro').fill(betrag);
  await page.getByRole('button', { name: 'Sichern' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
}

/** Kein horizontales Scrollen, nichts ragt heraus, keine überlappenden Texte. */
async function pruefeLayout(page: Page) {
  const breite = page.viewportSize()!.width;
  const fehler = await page.evaluate((breite) => {
    const f: string[] = [];
    if (innerWidth !== breite) f.push(`Browser zoomt heraus (${innerWidth}px statt ${breite}px)`);
    if (document.documentElement.scrollWidth > innerWidth + 1) f.push(`horizontal scrollbar (${document.documentElement.scrollWidth}px)`);
    const schneidet = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    for (const z of document.querySelectorAll('.zeile, .knoepfe, .hinweis, .kopf')) {
      const kinder = [...z.children].filter((c) => c.getBoundingClientRect().width > 0);
      for (let i = 0; i < kinder.length; i++)
        for (let j = i + 1; j < kinder.length; j++)
          if (schneidet(kinder[i]!.getBoundingClientRect(), kinder[j]!.getBoundingClientRect())) f.push(`Überlappung: "${kinder[i]!.textContent}" / "${kinder[j]!.textContent}"`);
    }
    for (const el of document.querySelectorAll('main *')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > innerWidth + 1 || r.left < -1)) f.push(`ragt heraus: ${el.className} "${el.textContent?.slice(0, 30)}"`);
      if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && !(el instanceof HTMLInputElement)) f.push(`abgeschnitten: ${el.className} "${el.textContent?.slice(0, 30)}"`);
    }
    return f.slice(0, 10);
  }, breite);
  expect(fehler).toEqual([]);
}

test('Eine einzige Seite: leer, ohne Tabs und ohne Einstellungen', async ({ page }) => {
  await oeffneLeer(page);
  await expect(summe(page)).toHaveText('0,00 €');
  await expect(page.getByText('Noch keine Unterkonten')).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveText(['Unterkonto hinzufügen']);
});

test('Unterkonten anlegen: Die Gesamtsumme ist ihre Summe und bleibt nach dem Neuladen', async ({ page }) => {
  await oeffneLeer(page);
  await neu(page, 'Kindergeld', '1.000,10');
  await neu(page, 'Auto-Service', '75,05');
  await expect(summe(page)).toHaveText('1.075,15 €');
  await expect(zeilen(page)).toHaveText([/^Kindergeld.*1\.000,10/, /^Auto-Service.*75,05/]);
  await page.reload();
  await expect(summe(page)).toHaveText('1.075,15 €');
  await expect(zeilen(page)).toHaveCount(2);
});

test('Unterkonto ändern, Abbrechen verwirft', async ({ page }) => {
  await oeffneLeer(page);
  await neu(page, 'Urlaub', '100');
  await zeilen(page).first().click();
  await page.getByLabel('Stand in Euro').fill('999');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(summe(page)).toHaveText('100,00 €');

  await zeilen(page).first().click();
  await expect(page.getByLabel('Stand in Euro')).toHaveValue('100,00');
  await page.getByLabel('Name').fill('Reisen');
  await page.getByLabel('Stand in Euro').fill('250,50');
  await page.getByLabel('Stand in Euro').press('Enter');
  await expect(zeilen(page).first()).toContainText('Reisen');
  await expect(summe(page)).toHaveText('250,50 €');
});

test('Falsche Eingaben werden abgefangen', async ({ page }) => {
  await oeffneLeer(page);
  await page.getByRole('button', { name: 'Unterkonto hinzufügen' }).click();
  await page.getByRole('button', { name: 'Sichern' }).click();
  await expect(page.getByText('Bitte einen Namen eingeben.')).toBeVisible();
  await page.getByLabel('Name').fill('Test');
  for (const falsch of ['', 'abc', '-5']) {
    await page.getByLabel('Stand in Euro').fill(falsch);
    await page.getByRole('button', { name: 'Sichern' }).click();
    await expect(page.getByText('Bitte einen Betrag wie 1.234,56 eingeben.')).toBeVisible();
  }
  await expect(summe(page)).toHaveText('0,00 €');
  await page.getByLabel('Stand in Euro').fill('0');
  await page.getByRole('button', { name: 'Sichern' }).click();
  await expect(zeilen(page)).toHaveCount(1);
});

test('Löschen lässt sich rückgängig machen', async ({ page }) => {
  await oeffneLeer(page);
  await neu(page, 'Eins', '10');
  await neu(page, 'Zwei', '20');
  await zeilen(page).first().click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(summe(page)).toHaveText('20,00 €');
  await expect(page.getByRole('status')).toContainText('„Eins“ gelöscht');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(summe(page)).toHaveText('30,00 €');
  await expect(zeilen(page)).toHaveText([/^Eins/, /^Zwei/]);
});

test('Trade-Republic-Töpfe der früheren App werden übernommen', async ({ page }) => {
  await oeffneLeer(page);
  await page.evaluate(async () => {
    // Zustand der früheren App nachstellen: Datenbank-Version 1 (Dexie speichert sie mal 10).
    await Promise.all((await indexedDB.databases()).map((d) => new Promise((r) => { const q = indexedDB.deleteDatabase(d.name!); q.onsuccess = q.onerror = q.onblocked = r; })));
    await new Promise<void>((fertig, fehler) => {
      const q = indexedDB.open('fixkosten', 10);
      q.onupgradeneeded = () => {
        for (const t of ['konten', 'kontostaende', 'einkommen', 'einmalig', 'umbuchungen', 'fixkosten', 'sparplaene', 'ruecklagen', 'budgets', 'kategorien', 'lebensbereiche', 'abschluss']) q.result.createObjectStore(t, { keyPath: 'id' });
        q.result.createObjectStore('meta', { keyPath: 'schluessel' });
        q.result.createObjectStore('sicherungen', { keyPath: 'id', autoIncrement: true });
      };
      q.onerror = () => fehler(q.error);
      q.onsuccess = () => {
        const tx = q.result.transaction(['konten', 'einkommen', 'ruecklagen'], 'readwrite');
        tx.objectStore('konten').put({ id: 'tr', name: 'Trade Republic', reihenfolge: 1 });
        tx.objectStore('einkommen').put({ id: 'kg', name: 'Kindergeld', zielKontoId: 'tr' });
        tx.objectStore('ruecklagen').put({ id: 'r', name: 'Kindergeld', kontoId: 'tr', stand: 150000, quelle: { typ: 'einkommen', id: 'kg' } });
        tx.oncomplete = () => { q.result.close(); fertig(); };
      };
    });
  });
  await page.reload();
  await expect(zeilen(page)).toHaveText([/^Kindergeld.*1\.500,00/]);
  await expect(summe(page)).toHaveText('1.500,00 €');
});

for (const groesse of ['100%', '170%']) {
  for (const breite of [320, 390]) {
    test(`Keine Überlappungen und kein Zoomen: Schrift ${groesse}, ${breite} px breit`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 844 });
      await oeffneLeer(page);
      await page.addStyleTag({ content: `html { font-size: ${groesse} !important; }` });
      await pruefeLayout(page);
      await neu(page, 'Kindergeld', '1.234.567,89');
      await neu(page, 'Rücklage für das Auto und den nächsten großen Service', '98.765,43');
      await neu(page, 'Donaudampfschifffahrtsgesellschaftskapitänsmütze', '5');
      await pruefeLayout(page);
      await zeilen(page).first().click();
      await pruefeLayout(page);
      await page.getByRole('button', { name: 'Löschen' }).click();
      await pruefeLayout(page);
    });
  }
}

test('Eingabefelder haben mindestens 16 px (iOS zoomt sonst hinein)', async ({ page }) => {
  await oeffneLeer(page);
  await page.getByRole('button', { name: 'Unterkonto hinzufügen' }).click();
  const groessen = await page.locator('input').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(groessen).toHaveLength(2);
  expect(Math.min(...groessen)).toBeGreaterThanOrEqual(16);
});

test('Funktioniert offline nach dem ersten Laden', async ({ page, context }) => {
  await oeffneLeer(page);
  await neu(page, 'Offline', '12');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(summe(page)).toHaveText('12,00 €');
  await context.setOffline(false);
});

for (const schema of ['light', 'dark'] as const) {
  test(`Screenshots ${schema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: schema });
    await oeffneLeer(page);
    await page.screenshot({ path: `screenshots/${schema}/1-leer.png` });
    await neu(page, 'Kindergeld', '1.500');
    await neu(page, 'Auto-Service', '675');
    await neu(page, 'Urlaub', '320,50');
    await page.screenshot({ path: `screenshots/${schema}/2-liste.png` });
    await zeilen(page).nth(1).click();
    await page.screenshot({ path: `screenshots/${schema}/3-bearbeiten.png` });
    await page.getByRole('button', { name: 'Löschen' }).click();
    await page.screenshot({ path: `screenshots/${schema}/4-geloescht.png` });
    await page.addStyleTag({ content: 'html { font-size: 170% !important; }' });
    await page.screenshot({ path: `screenshots/${schema}/5-grosse-schrift.png` });
  });
}
