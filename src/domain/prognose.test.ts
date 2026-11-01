import { describe, expect, it } from 'vitest';
import { ereignisse, prognose, saldoAm } from './prognose';
import { abgleich, anstehend, erwarteteBuchungen } from './termine';
import { neuerFixkostenPosten, zeitplan } from './standard';
import { testdaten } from './testdaten';
import { LEERE_DATEN, type Daten, type Konto } from './typen';

const konto = (id: string, extra: Partial<Konto> = {}): Konto => ({
  id, name: id, typ: 'giro', bank: '', rolle: 'fixkosten', mindestpuffer: 10000, farbe: 'blue', symbol: 'x', reihenfolge: 0, ...extra,
});

function daten(): Daten {
  return {
    ...LEERE_DATEN,
    konten: [konto('giro', { rolle: 'einkommen', name: 'Girokonto' }), konto('fix', { name: 'Fixkostenkonto' })],
    kontostaende: [
      { id: 's1', kontoId: 'giro', datum: '2026-11-01', betrag: 50000, quelle: 'manuell' },
      { id: 's2', kontoId: 'fix', datum: '2026-11-01', betrag: 15000, quelle: 'manuell' },
    ],
    einkommen: [{ id: 'e', name: 'Gehalt', zielKontoId: 'giro', zeitplan: { ...zeitplan('monatlich', 'letzter-bankarbeitstag'), verschiebung: 'vorher' }, historie: [{ gueltigAb: '2026-01-01', betrag: 200000 }] }],
    umbuchungen: [{ id: 'u', vonKontoId: 'giro', nachKontoId: 'fix', betrag: 10000, zeitplan: zeitplan('monatlich', 1), art: 'dauerauftrag' }],
    fixkosten: [
      neuerFixkostenPosten({ id: 'f1', name: 'Abo', kontoId: 'fix', zeitplan: zeitplan('monatlich', 5), preise: [{ gueltigAb: '2026-01-01', betrag: 5000 }] }, '2026-01-01'),
      neuerFixkostenPosten({ id: 'f2', name: 'Jahresbeitrag Haftpflicht', kontoId: 'fix', zeitplan: zeitplan('jaehrlich', 1, 12), preise: [{ gueltigAb: '2026-01-01', betrag: 18400 }] }, '2026-01-01'),
    ],
  };
}

describe('Kontostand-Prognose', () => {
  it('Umbuchung bucht ab und gut – Summe über alle Konten bleibt gleich', () => {
    const e = ereignisse(daten(), '2026-11-02', '2026-11-02').filter((x) => x.art === 'umbuchung');
    expect(e.map((x) => x.betrag).sort()).toEqual([-10000, 10000]);
  });

  it('Jahreszahlung erscheint einmal in voller Höhe am echten Termin (keine Durchschnitte)', () => {
    const e = ereignisse(daten(), '2026-11-02', '2027-11-01').filter((x) => x.refId === 'f2');
    expect(e).toHaveLength(1);
    expect(e[0]!.datum).toBe('2026-12-01');
    expect(e[0]!.betrag).toBe(-18400);
  });

  it('Warnung mit Datum und Ursache, wenn der Puffer unterschritten wird', () => {
    const p = prognose(daten(), '2026-11-01', 3).find((x) => x.kontoId === 'fix')!;
    // 150 + 100 (02.11.) − 50 (05.11.) = 200; 01.12.: +100 − 184 = 116; 07.12. (5. ist Samstag): −50 = 66 < 100 Puffer
    const w = p.warnungen[0]!;
    expect(w.datum).toBe('2026-12-07');
    expect(w.ursache?.name).toBe('Jahresbeitrag Haftpflicht');
    expect(w.fehlbetrag).toBe(3400);
    expect(w.text).toBe('Am 07.12.2026 fällt Fixkostenkonto unter den Mindestpuffer von 100 € wegen Jahresbeitrag Haftpflicht. Es fehlen 34,00 €.');
  });

  it('Gehalt am letzten Bankarbeitstag (Dezember: 30.12.)', () => {
    const e = ereignisse(daten(), '2026-12-01', '2026-12-31').filter((x) => x.art === 'einkommen');
    expect(e.map((x) => x.datum)).toEqual(['2026-12-30']);
  });

  it('Kreditkarte: gesammelte Abbuchung am Abrechnungstag vom Referenzkonto', () => {
    const d = daten();
    d.konten.push(konto('karte', { typ: 'kreditkarte', name: 'Kreditkarte', kreditkarte: { referenzKontoId: 'giro', abrechnungstag: 20 } }));
    d.fixkosten.push(
      neuerFixkostenPosten({ id: 'k1', name: 'Streaming', kontoId: 'karte', zahlungsart: 'kreditkarte', zeitplan: zeitplan('monatlich', 3), preise: [{ gueltigAb: '2026-01-01', betrag: 1299 }] }, '2026-01-01'),
      neuerFixkostenPosten({ id: 'k2', name: 'Musik', kontoId: 'karte', zahlungsart: 'kreditkarte', zeitplan: zeitplan('monatlich', 25), preise: [{ gueltigAb: '2026-01-01', betrag: 999 }] }, '2026-01-01'),
    );
    const e = ereignisse(d, '2026-11-01', '2026-11-30').filter((x) => x.art === 'karte' && x.kontoId === 'giro');
    // Periode 21.10.–20.11.: Musik 25.10. (Sonntag → 26.10.) + Streaming 03.11. = 22,98 €
    expect(e).toHaveLength(1);
    expect(e[0]!.datum).toBe('2026-11-20');
    expect(e[0]!.betrag).toBe(-2298);
  });

  it('gekündigte Posten fallen nach dem Enddatum heraus', () => {
    const d = daten();
    d.fixkosten[0]!.status = 'gekuendigt';
    d.fixkosten[0]!.endeAm = '2026-11-30';
    const e = ereignisse(d, '2026-11-01', '2027-02-28').filter((x) => x.refId === 'f1');
    expect(e.map((x) => x.datum)).toEqual(['2026-11-05']);
  });

  it('Budgets werden exakt über den Monat verteilt', () => {
    const d = daten();
    d.budgets = [{ id: 'b', name: 'Tanken', kontoId: 'giro', monatlich: 30000 }];
    const e = ereignisse(d, '2026-11-01', '2026-11-30', { mitBudgets: true }).filter((x) => x.art === 'budget');
    expect(e.reduce((s, x) => s + x.betrag, 0)).toBe(-30000);
    expect(e).toHaveLength(30);
  });

  it('ohne Kontostand: Prognose ab 0 €, aber keine Warnungen', () => {
    const d = { ...daten(), kontostaende: [] };
    const p = prognose(d, '2026-11-01', 3);
    expect(p.every((x) => x.ohneStand && x.warnungen.length === 0)).toBe(true);
  });

  it('Saldo am Tag und Abgleich mit Ursachensuche', () => {
    const d = daten();
    expect(saldoAm(d, 'fix', '2026-11-05').saldo).toBe(15000 + 10000 - 5000);
    const a = abgleich(d, 'fix', '2026-11-05', 25000); // Abo wurde nicht abgebucht
    expect(a.differenz).toBe(5000);
    expect(a.kandidaten[0]!.exakt).toBe(true);
    expect(a.kandidaten[0]!.ereignis.name).toBe('Abo');
  });

  it('Monatsabschluss listet jeden Vorgang einmal', () => {
    const b = erwarteteBuchungen(daten(), '2026-12');
    expect(b.filter((x) => x.art === 'umbuchung')).toHaveLength(1);
    expect(b.map((x) => x.name)).toContain('Jahresbeitrag Haftpflicht');
  });

  it('Anstehend: nicht-monatliche Abbuchungen der nächsten 60 Tage', () => {
    const a = anstehend(daten(), '2026-11-01', 60);
    expect(a.map((x) => x.titel)).toContain('Jahresbeitrag Haftpflicht');
    expect(a.map((x) => x.titel)).not.toContain('Abo');
  });

  it('Testdaten laufen ohne Fehler durch alle Berechnungen', () => {
    const t = testdaten('2026-11-01');
    expect(t.konten).toHaveLength(3);
    expect(t.fixkosten).toHaveLength(15);
    const p = prognose(t, '2026-11-01', 12);
    expect(p).toHaveLength(3);
    expect(p[0]!.punkte.length).toBeGreaterThan(360);
  });
});
