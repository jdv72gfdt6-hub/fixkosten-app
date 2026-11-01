import { describe, expect, it } from 'vitest';
import { formatTag, heute, parseTagDeutsch, plusMonate, plusTage, tagImMonatBegrenzt } from './datum';
import { istBankarbeitstag, letzterBankarbeitstag, naechsterBankarbeitstag, ostersonntag, vorherigerBankarbeitstag } from './kalender';

describe('TARGET2-Bankarbeitstage', () => {
  it('Ostersonntag', () => {
    expect(ostersonntag(2026)).toBe('2026-04-05');
    expect(ostersonntag(2027)).toBe('2027-03-28');
    expect(ostersonntag(2024)).toBe('2024-03-31');
  });
  it('geschlossene Tage', () => {
    for (const t of ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-24', '2026-12-25', '2026-12-31']) {
      expect(istBankarbeitstag(t), t).toBe(false);
    }
  });
  it('Wochenende ist kein Bankarbeitstag', () => {
    expect(istBankarbeitstag('2026-10-31')).toBe(false); // Samstag
    expect(istBankarbeitstag('2026-11-01')).toBe(false); // Sonntag
    expect(istBankarbeitstag('2026-11-02')).toBe(true);
  });
  it('regionale Feiertage verschieben SEPA-Buchungen nicht', () => {
    expect(istBankarbeitstag('2026-10-03')).toBe(false); // Samstag – zur Kontrolle
    expect(istBankarbeitstag('2025-10-03')).toBe(true); // Tag der Deutschen Einheit (Freitag) ist TARGET2-offen
    expect(istBankarbeitstag('2026-06-04')).toBe(true); // Fronleichnam
    expect(istBankarbeitstag('2026-11-18')).toBe(true); // Buß- und Bettag (Sachsen)
  });
  it('Verschiebung nachher / vorher', () => {
    expect(naechsterBankarbeitstag('2026-11-01')).toBe('2026-11-02');
    expect(vorherigerBankarbeitstag('2026-10-31')).toBe('2026-10-30');
    expect(naechsterBankarbeitstag('2026-12-24')).toBe('2026-12-28');
    expect(naechsterBankarbeitstag('2027-01-01')).toBe('2027-01-04');
  });
  it('letzter Bankarbeitstag des Monats (Gehalt)', () => {
    expect(letzterBankarbeitstag(2026, 10)).toBe('2026-10-30');
    expect(letzterBankarbeitstag(2026, 11)).toBe('2026-11-30');
    expect(letzterBankarbeitstag(2026, 12)).toBe('2026-12-30'); // 31.12. geschlossen
    expect(letzterBankarbeitstag(2027, 1)).toBe('2027-01-29');
  });
});

describe('Kalendertage ohne Zeitzonen-Fehler', () => {
  it('Monatsende: 31. wird zum letzten Tag, 29.02. in Nicht-Schaltjahren zum 28.02.', () => {
    expect(tagImMonatBegrenzt(2026, 4, 31)).toBe('2026-04-30');
    expect(tagImMonatBegrenzt(2026, 2, 29)).toBe('2026-02-28');
    expect(tagImMonatBegrenzt(2028, 2, 29)).toBe('2028-02-29');
    expect(plusMonate('2026-01-31', 1)).toBe('2026-02-28');
  });
  it('Sommerzeit-Umstellung verschiebt keinen Tag', () => {
    expect(plusTage('2026-03-28', 1)).toBe('2026-03-29');
    expect(plusTage('2026-03-29', 1)).toBe('2026-03-30');
    expect(plusTage('2026-10-24', 1)).toBe('2026-10-25');
    expect(plusTage('2026-10-25', 1)).toBe('2026-10-26');
  });
  it('heute() nutzt lokale Zeit, nicht UTC', () => {
    // 00:30 Uhr lokal am 01.11. – in UTC wäre es je nach Zone noch der 31.10.
    expect(heute(new Date(2026, 10, 1, 0, 30))).toBe('2026-11-01');
    expect(heute(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-31');
  });
  it('deutsches Datumsformat', () => {
    expect(formatTag('2026-10-31')).toBe('31.10.2026');
    expect(parseTagDeutsch('31.10.2026')).toBe('2026-10-31');
    expect(parseTagDeutsch('1.2.27')).toBe('2027-02-01');
    expect(parseTagDeutsch('31.02.2026')).toBeNull();
  });
});
