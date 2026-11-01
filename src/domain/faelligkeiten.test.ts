import { describe, expect, it } from 'vitest';
import { faelligkeitsmonate, naechsterTermin, termine, zeitplanProblem } from './faelligkeiten';
import { zeitplan } from './standard';

describe('Fälligkeiten', () => {
  it('Rundfunkbeitrag: vierteljährlich am 15., Anker 15.09.2026 → nächste 15.12.2026', () => {
    const z = { ...zeitplan('vierteljaehrlich', 15), ankerDatum: '2026-09-15' };
    expect(faelligkeitsmonate(z)).toEqual([3, 6, 9, 12]);
    expect(naechsterTermin(z, '2026-11-01')?.ist).toBe('2026-12-15');
    expect(termine(z, '2027-01-01', '2027-12-31').map((t) => t.ist)).toEqual(['2027-03-15', '2027-06-15', '2027-09-15', '2027-12-15']);
  });

  it('Wochenende verschiebt auf den nächsten Bankarbeitstag', () => {
    const z = zeitplan('monatlich', 1);
    const t = termine(z, '2026-11-01', '2026-11-30');
    expect(t).toEqual([{ soll: '2026-11-01', ist: '2026-11-02', angenommen: false }]);
  });

  it('Verschiebung über die Monatsgrenze wird erfasst', () => {
    const z = zeitplan('monatlich', 31);
    // 31.10.2026 ist Samstag → 02.11.2026
    expect(termine(z, '2026-11-01', '2026-11-05').map((t) => t.ist)).toEqual(['2026-11-02']);
    expect(termine(z, '2026-10-01', '2026-10-31').map((t) => t.ist)).toEqual([]);
  });

  it('Tag 31 in kurzen Monaten, 29.02. im Nicht-Schaltjahr', () => {
    const z = { ...zeitplan('monatlich', 31), verschiebung: 'vorher' as const };
    expect(termine(z, '2027-02-01', '2027-02-28')[0]!.soll).toBe('2027-02-28');
    const j = { ...zeitplan('jaehrlich'), ankerDatum: '2028-02-29', tag: null };
    expect(termine(j, '2027-01-01', '2027-12-31')[0]!.soll).toBe('2027-02-28');
  });

  it('Gehalt am letzten Bankarbeitstag', () => {
    const z = { ...zeitplan('monatlich', 'letzter-bankarbeitstag'), verschiebung: 'vorher' as const };
    expect(termine(z, '2026-10-01', '2027-01-31').map((t) => t.ist)).toEqual(['2026-10-30', '2026-11-30', '2026-12-30', '2027-01-29']);
  });

  it('ohne Ankermonat gibt es bei Jahreszahlungen keine Fälligkeit, sondern einen Hinweis', () => {
    const z = zeitplan('jaehrlich', 1);
    expect(zeitplanProblem(z)).toBe('anker-fehlt');
    expect(termine(z, '2026-01-01', '2027-12-31')).toEqual([]);
  });

  it('fehlender Tag: Hinweis und vorsichtige Annahme 1. des Monats', () => {
    const z = zeitplan('halbjaehrlich', null, 2);
    expect(zeitplanProblem(z)).toBe('tag-fehlt');
    const t = termine(z, '2026-11-01', '2027-08-31');
    expect(t.map((x) => x.soll)).toEqual(['2027-02-01', '2027-08-01']);
    expect(t.every((x) => x.angenommen)).toBe(true);
  });

  it('wöchentlich braucht ein Ankerdatum', () => {
    expect(zeitplanProblem(zeitplan('woechentlich'))).toBe('anker-fehlt');
    const z = { ...zeitplan('woechentlich'), ankerDatum: '2026-11-04' };
    expect(termine(z, '2026-11-01', '2026-11-30').map((t) => t.ist)).toEqual(['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25']);
  });
});
