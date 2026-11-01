import { describe, expect, it } from 'vitest';
import { baldKuendbar, finanzierungsenden, kuendigungsinfo, kuendigungsstichtag, preisaenderungen } from './vertraege';
import { erzeugeIcs } from './ics';
import { neuerFixkostenPosten, zeitplan } from './standard';
import { LEERE_DATEN, type Fixkosten, type Vertrag } from './typen';

const mitVertrag = (vertrag: Vertrag, extra: Partial<Fixkosten> = {}) =>
  neuerFixkostenPosten({ name: 'Vertrag', kontoId: 'k', vertrag, preise: [{ gueltigAb: '2025-01-01', betrag: 2000 }], ...extra }, '2025-01-01');

describe('Kündigungsfristen', () => {
  it('unvollständige Vertragsdaten werden erkannt', () => {
    const i = kuendigungsinfo(mitVertrag({}), '2026-11-01');
    expect(i.status).toBe('unvollstaendig');
    expect(i.fehlt).toEqual(['Vertragsbeginn', 'Mindestlaufzeit', 'Kündigungsfrist']);
  });

  it('24 Monate ab 15.03.2025, 3 Monate Frist → Ende 14.03.2027, kündigen bis 14.12.2026', () => {
    const i = kuendigungsinfo(mitVertrag({ beginn: '2025-03-15', mindestlaufzeitMonate: 24, kuendigungsfrist: { wert: 3, einheit: 'monate' }, verlaengerungMonate: 12 }), '2026-11-01');
    expect(i.laufzeitEnde).toBe('2027-03-14');
    expect(i.kuendigenBis).toBe('2026-12-14');
    expect(i.tageBisKuendigung).toBe(43);
  });

  it('Frist verpasst → automatische Verlängerung um 12 Monate', () => {
    const i = kuendigungsinfo(mitVertrag({ beginn: '2025-01-01', mindestlaufzeitMonate: 12, kuendigungsfrist: { wert: 3, einheit: 'monate' }, verlaengerungMonate: 12 }), '2026-11-01');
    expect(i.laufzeitEnde).toBe('2027-12-31');
    expect(i.kuendigenBis).toBe('2027-09-30');
  });

  it('nach Mindestlaufzeit ohne Verlängerung: jederzeit mit Frist kündbar', () => {
    const i = kuendigungsinfo(mitVertrag({ beginn: '2024-01-15', mindestlaufzeitMonate: 24, kuendigungsfrist: { wert: 1, einheit: 'monate' }, verlaengerungMonate: 0 }), '2026-11-01');
    expect(i.jederzeit).toBe(true);
    expect(i.laufzeitEnde).toBe('2026-12-01');
  });

  it('Frist in Wochen und Tagen', () => {
    expect(kuendigungsstichtag('2026-12-31', { wert: 4, einheit: 'wochen' })).toBe('2026-12-03');
    expect(kuendigungsstichtag('2026-12-31', { wert: 30, einheit: 'tage' })).toBe('2026-12-01');
    expect(kuendigungsstichtag('2027-02-28', { wert: 1, einheit: 'monate' })).toBe('2027-01-31');
  });

  it('Monatsende beim Laufzeitende: Beginn 31.01. + 1 Monat endet am 28.02.', () => {
    const i = kuendigungsinfo(mitVertrag({ beginn: '2027-01-31', mindestlaufzeitMonate: 1, kuendigungsfrist: { wert: 1, einheit: 'tage' }, verlaengerungMonate: 1 }), '2026-11-01');
    expect(i.laufzeitEnde).toBe('2027-02-28');
  });

  it('Liste "Bald kündbar" sortiert nach letztem Kündigungstag', () => {
    const a = mitVertrag({ beginn: '2025-03-15', mindestlaufzeitMonate: 24, kuendigungsfrist: { wert: 3, einheit: 'monate' }, verlaengerungMonate: 12 }, { id: 'a', name: 'A' });
    const b = mitVertrag({ beginn: '2025-12-10', mindestlaufzeitMonate: 12, kuendigungsfrist: { wert: 1, einheit: 'monate' }, verlaengerungMonate: 12 }, { id: 'b', name: 'B' });
    const liste = baldKuendbar({ ...LEERE_DATEN, fixkosten: [a, b] }, '2026-11-01');
    expect(liste.map((x) => x.posten.name)).toEqual(['B', 'A']);
  });
});

describe('Preisänderungen und Finanzierungen', () => {
  it('Erhöhung mit Differenz in € und %, Jahreswirkung', () => {
    const f = neuerFixkostenPosten({ name: 'Strom', kontoId: 'k', preise: [{ gueltigAb: '2025-01-01', betrag: 5000 }, { gueltigAb: '2026-09-01', betrag: 5500 }] }, '2025-01-01');
    const [p] = preisaenderungen({ ...LEERE_DATEN, fixkosten: [f] }, '2025-11-01');
    expect(p!.differenz).toBe(500);
    expect(p!.prozent).toBe(10);
    expect(p!.jahreswirkung).toBe(6000);
  });

  it('Kredit: ab dem Folgemonat der letzten Rate mehr frei', () => {
    const f = neuerFixkostenPosten({ name: 'Kredit', kontoId: 'k', finanzierung: { letzteRate: '2027-05-15' }, preise: [{ gueltigAb: '2025-01-01', betrag: 21500 }] }, '2025-01-01');
    const [e] = finanzierungsenden({ ...LEERE_DATEN, fixkosten: [f] }, '2026-11-01');
    expect(e!.freiAbMonat).toBe('2027-06');
    expect(e!.mehrFreiMonatlich).toBe(21500);
  });
});

describe('Kalenderdatei (.ics)', () => {
  it('feste UIDs, Ganztagstermine, CRLF, Erinnerung', () => {
    const ics = erzeugeIcs([{ uid: 'kuendigung-a@fixkosten-app', datum: '2026-12-14', titel: 'Kündigungsfrist: Strom, Gas; Wasser', erinnerungTageVorher: 14 }], new Date(Date.UTC(2026, 10, 1, 10, 0, 0)));
    expect(ics).toContain('UID:kuendigung-a@fixkosten-app\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261214\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20261215\r\n');
    expect(ics).toContain('SUMMARY:Kündigungsfrist: Strom\\, Gas\\; Wasser');
    expect(ics).toContain('TRIGGER:-P14DT0H0M0S');
    expect(ics).toContain('DTSTAMP:20261101T100000Z');
    expect(ics.split('\r\n').every((z) => new TextEncoder().encode(z).length <= 75)).toBe(true);
  });

  it('lange Zeilen werden gefaltet', () => {
    const ics = erzeugeIcs([{ uid: 'x', datum: '2026-12-14', titel: 'Ä'.repeat(80) }]);
    expect(ics).toMatch(/\r\n Ä/);
  });
});

describe('Zeitplan-Hilfe', () => {
  it('Standard-Zeitplan', () => {
    expect(zeitplan()).toEqual({ rhythmus: 'monatlich', tag: 1, ankerMonat: null, ankerDatum: null, verschiebung: 'nachher' });
  });
});
