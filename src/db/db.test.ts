import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { testdaten } from '../domain/testdaten';
import { ersetzeAlles, FixkostenDB, ladeDaten, leerePapierkorb } from './db';

describe('Datenbank', () => {
  it('speichert und lädt alle Daten verlustfrei', async () => {
    const d = new FixkostenDB('test-1');
    const daten = testdaten('2026-11-01');
    await ersetzeAlles(daten, 'Test', d);
    const geladen = await ladeDaten(d);
    expect(geladen.fixkosten).toHaveLength(15);
    expect(geladen.konten.map((k) => k.id).sort()).toEqual(daten.konten.map((k) => k.id).sort());
    expect(geladen.einkommen[0]!.historie).toEqual(daten.einkommen[0]!.historie);
    d.close();
  });

  it('legt vor dem Ersetzen automatisch eine Sicherung an', async () => {
    const d = new FixkostenDB('test-2');
    await ersetzeAlles(testdaten('2026-11-01'), 'Erster Import', d);
    expect(await d.sicherungen.count()).toBe(0); // vorher war nichts da
    await ersetzeAlles(testdaten('2026-11-02'), 'Zweiter Import', d);
    const s = await d.sicherungen.toArray();
    expect(s).toHaveLength(1);
    expect(s[0]!.backup.daten.fixkosten).toHaveLength(15);
    d.close();
  });

  it('Papierkorb wird nach 30 Tagen geleert', async () => {
    const d = new FixkostenDB('test-3');
    const daten = testdaten('2026-11-01');
    daten.fixkosten[0]!.geloeschtAm = '2026-09-01';
    daten.fixkosten[1]!.geloeschtAm = '2026-10-20';
    await ersetzeAlles(daten, 'Test', d);
    expect(await leerePapierkorb(d, '2026-11-01')).toBe(1);
    expect(await d.fixkosten.count()).toBe(14);
    d.close();
  });
});
