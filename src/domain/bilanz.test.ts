import { describe, expect, it } from 'vitest';
import { ampel, deckung, monatsuebersicht } from './bilanz';
import { STANDARD_KATEGORIEN, zeitplan, neuerFixkostenPosten } from './standard';
import { LEERE_DATEN, type Daten, type Konto } from './typen';

const konto = (id: string, extra: Partial<Konto> = {}): Konto => ({
  id, name: id, typ: 'giro', bank: '', rolle: 'fixkosten', mindestpuffer: 0, farbe: 'blue', symbol: 'x', reihenfolge: 0, ...extra,
});

function basis(): Daten {
  return {
    ...LEERE_DATEN,
    kategorien: STANDARD_KATEGORIEN,
    konten: [konto('giro', { rolle: 'einkommen' }), konto('fix'), konto('spar', { rolle: 'ruecklage' })],
    einkommen: [{ id: 'e', name: 'Gehalt', zielKontoId: 'giro', zeitplan: zeitplan(), historie: [{ gueltigAb: '2026-01-01', betrag: 300000 }] }],
    umbuchungen: [
      { id: 'u1', vonKontoId: 'giro', nachKontoId: 'fix', betrag: 10000, zeitplan: zeitplan(), art: 'dauerauftrag' },
      { id: 'u2', vonKontoId: 'giro', nachKontoId: 'spar', betrag: 5000, zeitplan: zeitplan(), art: 'dauerauftrag' },
    ],
    fixkosten: [
      neuerFixkostenPosten({ name: 'Abo', kontoId: 'fix', preise: [{ gueltigAb: '2026-01-01', betrag: 5000 }] }, '2026-01-01'),
      neuerFixkostenPosten({ name: 'Jahresbeitrag', kontoId: 'fix', zeitplan: zeitplan('jaehrlich', 1, 12), preise: [{ gueltigAb: '2026-01-01', betrag: 87600 }] }, '2026-01-01'),
    ],
  };
}

describe('Deckungsprüfung', () => {
  it('rechnet mit Monatsdurchschnitten inkl. anteiliger Jahreszahlung', () => {
    const fix = deckung(basis(), '2026-11-01').find((k) => k.konto.id === 'fix')!;
    expect(fix.abflussMonat).toBe(5000 + 7300);
    expect(fix.anteiligeRuecklage).toBe(7300);
    expect(fix.saldoMonat).toBe(10000 - 12300);
  });

  it('macht einen konkreten Vorschlag auf volle Euro', () => {
    const fix = deckung(basis(), '2026-11-01').find((k) => k.konto.id === 'fix')!;
    expect(fix.vorschlag?.art).toBe('erhoehen');
    expect(fix.vorschlag?.differenz).toBe(2300);
    expect(fix.vorschlag?.neuerBetrag).toBe(12300);
    expect(fix.vorschlag?.text).toContain('um 23 €');
  });

  it('Umbuchungen sind nie Kosten', () => {
    const ue = monatsuebersicht(basis(), '2026-11-01');
    expect(ue.fixkosten).toBe(12300);
    expect(ue.ruecklagen).toBe(5000); // Umbuchung auf Rücklagekonto
    expect(ue.frei).toBe(300000 - 12300 - 5000);
  });

  it('Kostenanteil: Quote mit eigenem Anteil, Kontodeckung mit vollem Betrag', () => {
    const d = basis();
    d.fixkosten[0]!.anteil = 50;
    const ue = monatsuebersicht(d, '2026-11-01');
    expect(ue.fixkosten).toBe(2500 + 7300);
    const fix = deckung(d, '2026-11-01').find((k) => k.konto.id === 'fix')!;
    expect(fix.abflussMonat).toBe(12300);
  });

  it('pausierte, gekündigte und abgelaufene Posten zählen nicht', () => {
    const d = basis();
    d.fixkosten[0]!.status = 'pausiert';
    d.fixkosten[1]!.status = 'gekuendigt';
    d.fixkosten[1]!.endeAm = '2026-10-31';
    expect(monatsuebersicht(d, '2026-11-01').fixkosten).toBe(0);
    d.fixkosten[0]!.status = 'aktiv';
    d.fixkosten[0]!.finanzierung = { letzteRate: '2026-10-15' };
    expect(monatsuebersicht(d, '2026-11-01').fixkosten).toBe(0);
    expect(monatsuebersicht(d, '2026-10-01').fixkosten).toBe(5000 + 7300);
  });

  it('Kreditkarte: Belastungen werden über das Referenzkonto ausgeglichen', () => {
    const d = basis();
    d.konten.push(konto('karte', { typ: 'kreditkarte', kreditkarte: { referenzKontoId: 'fix', abrechnungstag: 20 } }));
    d.fixkosten.push(neuerFixkostenPosten({ name: 'Streaming', kontoId: 'karte', zahlungsart: 'kreditkarte', preise: [{ gueltigAb: '2026-01-01', betrag: 1299 }] }, '2026-01-01'));
    const k = deckung(d, '2026-11-01');
    expect(k.find((x) => x.konto.id === 'karte')!.saldoMonat).toBe(0);
    expect(k.find((x) => x.konto.id === 'fix')!.abflussMonat).toBe(12300 + 1299);
    // In den Fixkosten zählt der Posten genau einmal.
    expect(monatsuebersicht(d, '2026-11-01').fixkosten).toBe(12300 + 1299);
  });

  it('ohne Einkommen: keine Division durch null, sondern Hinweis', () => {
    const d = { ...basis(), einkommen: [] };
    const ue = monatsuebersicht(d, '2026-11-01');
    expect(ue.fixkostenquote).toBeNull();
    expect(ue.hinweise.length).toBe(1);
    expect(ampel(ue.fixkostenquote)).toBe('unbekannt');
  });

  it('Gehaltserhöhung mit Gültig-ab-Datum', () => {
    const d = basis();
    d.einkommen[0]!.historie.push({ gueltigAb: '2026-12-01', betrag: 320000 });
    expect(monatsuebersicht(d, '2026-11-15').einkommen).toBe(300000);
    expect(monatsuebersicht(d, '2026-12-01').einkommen).toBe(320000);
  });

  it('Ampel-Grenzen', () => {
    expect(ampel(39.9)).toBe('gruen');
    expect(ampel(40)).toBe('gelb');
    expect(ampel(50)).toBe('gelb');
    expect(ampel(50.1)).toBe('rot');
    expect(ampel(45, 30, 44)).toBe('rot');
  });
});
