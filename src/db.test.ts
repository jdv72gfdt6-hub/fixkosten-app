import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { AppDB, speichere, TABELLEN_V1, uebernehmeAlteDaten } from './db';

let nummer = 0;

/** Datenbank im Zustand der früheren App anlegen und mit dem neuen Schema öffnen. */
async function alteApp(inhalt: Record<string, object[]>) {
  const name = `test-${nummer++}`;
  const alt = new Dexie(name);
  alt.version(1).stores(TABELLEN_V1);
  await alt.open();
  for (const [tabelle, zeilen] of Object.entries(inhalt)) await alt.table(tabelle).bulkPut(zeilen);
  alt.close();
  return new AppDB(name);
}

const namenUndStaende = async (d: AppDB) => (await d.unterkonten.orderBy('reihenfolge').toArray()).map((k) => [k.name, k.stand]);

const tr = { id: 'tr', name: 'Trade Republic', reihenfolge: 3 };
const quellen = {
  einkommen: [{ id: 'kg', name: 'Kindergeld', zielKontoId: 'tr' }, { id: 'gehalt', name: 'Gehalt', zielKontoId: 'giro' }],
  umbuchungen: [{ id: 'auto', name: 'Auto-Service', vonKontoId: 'giro', nachKontoId: 'tr' }],
};

describe('Übernahme aus der früheren App', () => {
  it('legt je Topf ein Unterkonto an, Töpfe ohne Stand mit 0 €', async () => {
    const d = await alteApp({
      konten: [tr, { id: 'giro', name: 'Giro', reihenfolge: 1 }],
      ...quellen,
      ruecklagen: [{ id: 'r', name: 'Kindergeld', kontoId: 'tr', stand: 100000, quelle: { typ: 'einkommen', id: 'kg' } }],
    });
    await uebernehmeAlteDaten(d);
    expect(await namenUndStaende(d)).toEqual([['Kindergeld', 100000], ['Auto-Service', 0]]);
    d.close();
  });

  it('läuft nur einmal: Gelöschtes kommt nicht wieder, keine Doppelungen', async () => {
    const d = await alteApp({ konten: [tr], ...quellen });
    await uebernehmeAlteDaten(d);
    await d.unterkonten.clear();
    await uebernehmeAlteDaten(d);
    expect(await d.unterkonten.count()).toBe(0);
    d.close();
  });

  it('übersteht zwei gleichzeitige Starts ohne Doppelungen', async () => {
    const d = await alteApp({ konten: [tr], ...quellen });
    await Promise.all([uebernehmeAlteDaten(d), uebernehmeAlteDaten(d)]);
    expect(await d.unterkonten.count()).toBe(2);
    d.close();
  });

  it('nur Gesamtstand eingetragen: Er landet in "Sonstiges"', async () => {
    const d = await alteApp({
      konten: [tr],
      ...quellen,
      kontostaende: [
        { id: 'a', kontoId: 'tr', datum: '2026-10-01', betrag: 1000 },
        { id: 'b', kontoId: 'tr', datum: '2026-11-02', betrag: 2000 },
        { id: 'c', kontoId: 'giro', datum: '2026-11-03', betrag: 9000 },
      ],
    });
    await uebernehmeAlteDaten(d);
    expect(await namenUndStaende(d)).toEqual([['Kindergeld', 0], ['Auto-Service', 0], ['Sonstiges', 2000]]);
    d.close();
  });

  it('ignoriert Einträge aus dem Papierkorb und andere Konten', async () => {
    const d = await alteApp({
      konten: [tr, { id: 'x', name: 'Anderes' }],
      einkommen: [{ id: 'weg', name: 'Gelöscht', zielKontoId: 'tr', geloeschtAm: '2026-11-01' }, { id: 'y', name: 'Fremd', zielKontoId: 'x' }],
      ruecklagen: [{ id: 'r', name: 'Topf', kontoId: 'tr', stand: 500 }],
    });
    await uebernehmeAlteDaten(d);
    expect(await namenUndStaende(d)).toEqual([['Topf', 500]]);
    d.close();
  });

  it('nutzt das früher gewählte Sparkonto', async () => {
    const d = await alteApp({
      konten: [tr, { id: 'tg', name: 'Tagesgeld' }],
      meta: [{ schluessel: 'einstellungen', wert: { sparKontoId: 'tg' } }],
      ruecklagen: [{ id: 'r', name: 'Gewählt', kontoId: 'tg', stand: 700 }, { id: 's', name: 'Nicht gewählt', kontoId: 'tr', stand: 800 }],
    });
    await uebernehmeAlteDaten(d);
    expect(await namenUndStaende(d)).toEqual([['Gewählt', 700]]);
    d.close();
  });

  it('ohne frühere Daten startet die App leer', async () => {
    const d = await alteApp({});
    await uebernehmeAlteDaten(d);
    expect(await d.unterkonten.count()).toBe(0);
    d.close();
  });

  it('lässt die Daten der früheren App unverändert', async () => {
    const d = await alteApp({ konten: [tr], fixkosten: [{ id: 'f', name: 'Miete', kontoId: 'c24' }] });
    await uebernehmeAlteDaten(d);
    expect(await d.table('fixkosten').toArray()).toEqual([{ id: 'f', name: 'Miete', kontoId: 'c24' }]);
    expect(await d.table('konten').toArray()).toEqual([tr]);
    d.close();
  });
});

describe('Speichern', () => {
  it('hängt neue Unterkonten hinten an, Ändern behält die Reihenfolge', async () => {
    const d = await alteApp({});
    const a = await speichere(d.unterkonten, { name: 'A', stand: 100 });
    await speichere(d.unterkonten, { name: 'B', stand: 200 });
    await speichere(d.unterkonten, { id: a, name: 'A2', stand: 300 });
    expect(await namenUndStaende(d)).toEqual([['A2', 300], ['B', 200]]);
    d.close();
  });

  it('Spartöpfe liegen in einer eigenen Tabelle, Ziel und Datum bleiben erhalten', async () => {
    const d = await alteApp({});
    await speichere(d.unterkonten, { name: 'Konto', stand: 100 });
    const id = await speichere(d.spartoepfe, { name: 'Urlaub', stand: 64000, ziel: 150000, bis: '2027-06' });
    expect(await d.spartoepfe.get(id)).toEqual({ id, name: 'Urlaub', stand: 64000, ziel: 150000, bis: '2027-06', reihenfolge: 0 });
    expect(await d.unterkonten.count()).toBe(1);
    d.close();
  });
});
