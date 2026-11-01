import { describe, expect, it } from 'vitest';
import { fixkostenKonto, jahreszahlungen, kontoRuecklage, sparKonto, spartoepfe } from './ruecklagen';
import { neuerFixkostenPosten, zeitplan } from './standard';
import { LEERE_DATEN, type Daten, type Konto } from './typen';

const konto = (id: string, extra: Partial<Konto> = {}): Konto => ({
  id, name: id, typ: 'giro', bank: '', rolle: 'fixkosten', mindestpuffer: 10000, farbe: 'blue', symbol: 'x', reihenfolge: 0, ...extra,
});

const posten = (id: string, name: string, betrag: number, z = zeitplan('monatlich', 1)) =>
  neuerFixkostenPosten({ id, name, kontoId: 'c24', zeitplan: z, preise: [{ gueltigAb: '2026-01-01', betrag }] }, '2026-01-01');

function daten(): Daten {
  return {
    ...LEERE_DATEN,
    konten: [
      konto('giro', { rolle: 'einkommen', name: 'Volksbank', reihenfolge: 1 }),
      konto('c24', { name: 'C24', reihenfolge: 2 }),
      konto('tr', { name: 'Trade Republic', rolle: 'ruecklage', reihenfolge: 3 }),
    ],
    einkommen: [{ id: 'kg', name: 'Kindergeld', zielKontoId: 'tr', zeitplan: zeitplan('monatlich', 1), historie: [{ gueltigAb: '2026-01-01', betrag: 25000 }] }],
    umbuchungen: [
      { id: 'u-c24', vonKontoId: 'giro', nachKontoId: 'c24', betrag: 40000, zeitplan: zeitplan('monatlich', 1), art: 'dauerauftrag' },
      { id: 'u-auto', name: 'Auto-Service', vonKontoId: 'giro', nachKontoId: 'tr', betrag: 7500, zeitplan: zeitplan('monatlich', 1), art: 'dauerauftrag' },
    ],
    fixkosten: [
      posten('haft', 'Haftpflicht', 7200, zeitplan('jaehrlich', 1, 2)), // 01.02.2026 Sonntag → 02.02.
      posten('unfall', 'Unfallversicherung', 16758, zeitplan('halbjaehrlich', 1, 6)), // Juni + Dezember
      posten('rundfunk', 'Rundfunkbeitrag', 5508, { ...zeitplan('vierteljaehrlich', 15), ankerDatum: '2026-09-15' }),
      posten('kfz', 'KFZ-Steuer', 25200, zeitplan('jaehrlich', null, 8)), // 01.08.2026 Samstag → 03.08.
      posten('hausrat', 'Hausrat', 12000, zeitplan('jaehrlich', null, null)), // Monat fehlt
      posten('strom', 'Strom', 5500, zeitplan('monatlich', 5)),
    ],
  };
}

describe('Rücklagen für Jahreszahlungen', () => {
  it('angespart = Betrag × Monate seit der letzten Abbuchung / Abstand', () => {
    const z = jahreszahlungen(daten(), 'c24', '2026-11-01');
    const nach = Object.fromEntries(z.map((x) => [x.posten.name, x]));
    expect(nach['Haftpflicht']!.angespart).toBe(5400); // 9/12 von 72 €
    expect(nach['Unfallversicherung']!.angespart).toBe(13965); // 5/6 von 167,58 €
    expect(nach['Rundfunkbeitrag']!.angespart).toBe(3672); // 2/3 von 55,08 €
    expect(nach['KFZ-Steuer']!.angespart).toBe(6300); // 3/12 von 252 €
    expect(nach['Hausrat']!.monatFehlt).toBe(true);
    expect(nach['Hausrat']!.angespart).toBe(0);
    expect(z.map((x) => x.posten.name)).not.toContain('Strom');
  });

  it('sortiert nach nächster Abbuchung, Monatsrate je Posten', () => {
    const z = jahreszahlungen(daten(), 'c24', '2026-11-01');
    expect(z[0]!.posten.name).toBe('Unfallversicherung');
    expect(z[0]!.naechster!.ist).toBe('2026-12-01');
    expect(z[1]!.posten.name).toBe('Rundfunkbeitrag');
    expect(z[1]!.rate).toBe(1836);
    expect(z.at(-1)!.posten.name).toBe('Hausrat');
  });

  it('im Fälligkeitsmonat vor der Abbuchung ist der volle Betrag angespart, danach 0', () => {
    const vorher = jahreszahlungen(daten(), 'c24', '2026-12-10').find((x) => x.posten.id === 'rundfunk')!;
    expect(vorher.angespart).toBe(5508);
    const danach = jahreszahlungen(daten(), 'c24', '2026-12-16').find((x) => x.posten.id === 'rundfunk')!;
    expect(danach.angespart).toBe(0);
  });

  it('Spielraum = Kontostand − offene Monatsabbuchungen − Soll', () => {
    const d = daten();
    d.kontostaende = [{ id: 's', kontoId: 'c24', datum: '2026-11-02', betrag: 30000, quelle: 'manuell' }];
    const r = kontoRuecklage(d, 'c24', '2026-11-02'); // 01.11. ist Sonntag, Eingang am 02.11.
    expect(r.soll).toBe(5400 + 13965 + 3672 + 6300);
    expect(r.offenBisEingang).toBe(5500); // Strom am 05.11., nächster Eingang 01.12.
    expect(r.spielraum).toBe(30000 - 5500 - 29337);
  });

  it('ohne Kontostand kein Spielraum', () => {
    expect(kontoRuecklage(daten(), 'c24', '2026-11-01').spielraum).toBeNull();
  });
});

describe('Spartöpfe', () => {
  it('jede regelmäßige Einzahlung ist ein Topf, Stand wird mit den Eingängen hochgerechnet', () => {
    const d = daten();
    d.ruecklagen = [{ id: 'r', name: 'Kindergeld', kontoId: 'tr', virtuell: false, stand: 100000, standAm: '2026-11-02', quelle: { typ: 'einkommen', id: 'kg' } }];
    const t = spartoepfe(d, 'tr', '2027-01-15');
    expect(t.map((x) => x.name)).toEqual(['Kindergeld', 'Auto-Service']);
    expect(t[0]!.monatlich).toBe(25000);
    expect(t[0]!.seitdem).toBe(50000); // 01.12. und 04.01.
    expect(t[0]!.aktuell).toBe(150000);
    expect(t[1]!.monatlich).toBe(7500);
    expect(t[1]!.aktuell).toBeNull();
  });

  it('Sparkonto wird am Namen Trade Republic erkannt, Fixkostenkonto an der Rolle', () => {
    expect(sparKonto(daten())?.id).toBe('tr');
    expect(fixkostenKonto(daten())?.id).toBe('c24');
    expect(sparKonto(daten(), 'giro')?.id).toBe('giro');
  });

  it('ohne Trade Republic: Konto mit den meisten Spar-Eingängen', () => {
    const d = daten();
    d.konten[2]!.name = 'Tagesgeld';
    expect(sparKonto(d)?.id).toBe('tr');
  });
});
