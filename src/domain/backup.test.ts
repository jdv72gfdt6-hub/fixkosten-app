import { describe, expect, it } from 'vitest';
import { erstelleBackup, migriere, MIGRATIONEN, pruefeBackup, SCHEMA_VERSION } from './backup';
import { STANDARD_EINSTELLUNGEN } from './standard';
import { testdaten } from './testdaten';

describe('Backup', () => {
  it('Export und Import ergeben dieselben Daten', () => {
    const daten = testdaten('2026-11-01');
    const b = JSON.parse(JSON.stringify(erstelleBackup(daten, STANDARD_EINSTELLUNGEN, [])));
    const r = pruefeBackup(b);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.daten).toEqual(daten);
      expect(r.vorschau.anzahl.fixkosten).toBe(15);
    }
  });

  it('lehnt fremde Dateien und neuere Versionen ab', () => {
    expect(pruefeBackup({ foo: 1 }).ok).toBe(false);
    expect(pruefeBackup(null).ok).toBe(false);
    const r = pruefeBackup({ format: 'fixkosten-backup', schemaVersion: SCHEMA_VERSION + 1, daten: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler[0]).toContain('neueren App-Version');
  });

  it('lehnt Kommazahlen als Beträge ab', () => {
    const d = testdaten('2026-11-01');
    (d.budgets[0] as { monatlich: number }).monatlich = 400.5;
    const r = pruefeBackup(erstelleBackup(d, STANDARD_EINSTELLUNGEN, []));
    expect(r.ok).toBe(false);
  });

  it('lehnt volle IBAN ab', () => {
    const d = testdaten('2026-11-01');
    d.konten[0]!.ibanLast4 = 'DE89370400440532013000';
    expect(pruefeBackup(erstelleBackup(d, STANDARD_EINSTELLUNGEN, [])).ok).toBe(false);
  });

  it('lehnt ungültige Tage ab (z. B. UTC-Zeitstempel)', () => {
    const d = testdaten('2026-11-01');
    d.kontostaende[0]!.datum = '2026-10-30T23:00:00.000Z';
    expect(pruefeBackup(erstelleBackup(d, STANDARD_EINSTELLUNGEN, [])).ok).toBe(false);
  });

  it('Migrationen laufen der Reihe nach', () => {
    MIGRATIONEN[90] = (d) => ({ ...d, schritt: [90] });
    MIGRATIONEN[91] = (d) => ({ ...d, schritt: [...(d.schritt as number[]), 91] });
    expect(migriere({}, 90, 92)).toEqual({ schritt: [90, 91] });
    expect(() => migriere({}, 90, 93)).toThrow('Keine Migration von Version 92');
    delete MIGRATIONEN[90];
    delete MIGRATIONEN[91];
  });
});
