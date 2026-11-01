/*
 * Anonymer Testdaten-Modus: realistisches Beispiel mit 3 Konten, Gehalt, Umbuchungen und 15 Fixkosten.
 * Enthält keinerlei persönliche Daten und darf deshalb in der App ausgeliefert werden.
 */
import { plusMonate, plusTage, teile } from './datum';
import { STANDARD_KATEGORIEN, STANDARD_LEBENSBEREICHE, zeitplan } from './standard';
import type { Daten, Fixkosten, Zeitplan } from './typen';

export function testdaten(heute: string): Daten {
  const ab = plusMonate(heute, -14);
  const { jahr } = teile(heute);
  const vor = (tage: number) => plusTage(heute, -tage);

  let n = 0;
  const f = (
    name: string,
    kontoId: string,
    betrag: number,
    kategorieId: string,
    lebensbereichId: string,
    z: Zeitplan,
    extra: Partial<Fixkosten> = {},
  ): Fixkosten => ({
    id: `t-f${++n}`,
    name,
    kontoId,
    kategorieId,
    lebensbereichId,
    zahlungsart: 'lastschrift',
    zeitplan: z,
    preise: [{ gueltigAb: ab, betrag }],
    status: 'aktiv',
    anteil: 100,
    steuerlich: false,
    vertrag: {},
    ...extra,
  });

  return {
    kategorien: STANDARD_KATEGORIEN,
    lebensbereiche: STANDARD_LEBENSBEREICHE,
    konten: [
      { id: 't-giro', name: 'Girokonto', typ: 'giro', bank: 'Hausbank', ibanLast4: '4711', rolle: 'einkommen', dispo: 100000, mindestpuffer: 20000, farbe: 'blue', symbol: 'landmark', reihenfolge: 1 },
      { id: 't-fix', name: 'Fixkostenkonto', typ: 'giro', bank: 'Direktbank', ibanLast4: '0815', rolle: 'fixkosten', mindestpuffer: 10000, farbe: 'teal', symbol: 'receipt', reihenfolge: 2 },
      { id: 't-tg', name: 'Tagesgeld', typ: 'tagesgeld', bank: 'Direktbank', rolle: 'ruecklage', mindestpuffer: 0, farbe: 'green', symbol: 'piggy-bank', lebensbereichId: 'lb-sonstiges', reihenfolge: 3 },
    ],
    kontostaende: [
      { id: 't-s1', kontoId: 't-giro', datum: vor(2), betrag: 384250, quelle: 'manuell', erfasst: 1 },
      { id: 't-s2', kontoId: 't-fix', datum: vor(2), betrag: 31840, quelle: 'manuell', erfasst: 1 },
      { id: 't-s3', kontoId: 't-tg', datum: vor(20), betrag: 512000, quelle: 'manuell', erfasst: 1 },
    ],
    einkommen: [
      { id: 't-e1', name: 'Gehalt', zielKontoId: 't-giro', zeitplan: { ...zeitplan('monatlich', 'letzter-bankarbeitstag'), verschiebung: 'vorher' }, historie: [{ gueltigAb: ab, betrag: 305000 }, { gueltigAb: plusMonate(heute, -3), betrag: 320000 }] },
    ],
    einmalig: [{ id: 't-x1', art: 'ausgabe', name: 'Nebenkosten-Nachzahlung', betrag: 24000, datum: plusTage(heute, 40), kontoId: 't-giro' }],
    umbuchungen: [
      { id: 't-u1', vonKontoId: 't-giro', nachKontoId: 't-fix', betrag: 31000, zeitplan: zeitplan('monatlich', 1), art: 'dauerauftrag' },
      { id: 't-u2', vonKontoId: 't-giro', nachKontoId: 't-tg', betrag: 20000, zeitplan: zeitplan('monatlich', 1), art: 'dauerauftrag' },
    ],
    sparplaene: [{ id: 't-s-etf', name: 'ETF-Sparplan', vonKontoId: 't-giro', betrag: 15000, zeitplan: zeitplan('monatlich', 2) }],
    ruecklagen: [{ id: 't-r1', name: 'Puffer', kontoId: 't-fix', virtuell: true, monatlich: 1500 }],
    budgets: [{ id: 't-b1', name: 'Lebensmittel', kontoId: 't-giro', monatlich: 40000, lebensbereichId: 'lb-sonstiges' }],
    fixkosten: [
      f('Miete', 't-giro', 89000, 'kat-wohnen', 'lb-wohnen', zeitplan('monatlich', 1), { zahlungsart: 'dauerauftrag' }),
      f('Strom', 't-fix', 6800, 'kat-energie', 'lb-wohnen', zeitplan('monatlich', 15), {
        preise: [{ gueltigAb: ab, betrag: 6200 }, { gueltigAb: plusMonate(heute, -2), betrag: 6800 }],
        vertrag: { beginn: `${jahr - 1}-03-01`, mindestlaufzeitMonate: 12, kuendigungsfrist: { wert: 1, einheit: 'monate' }, verlaengerungMonate: 12 },
      }),
      f('Internet', 't-fix', 3999, 'kat-kommunikation', 'lb-kommunikation', zeitplan('monatlich', 5), {
        vertrag: { beginn: `${jahr - 2}-01-15`, mindestlaufzeitMonate: 24, kuendigungsfrist: { wert: 1, einheit: 'monate' }, verlaengerungMonate: 0 },
      }),
      f('Handyvertrag', 't-fix', 2499, 'kat-kommunikation', 'lb-kommunikation', zeitplan('monatlich', 3), {
        vertrag: { beginn: plusMonate(heute, -22), mindestlaufzeitMonate: 24, kuendigungsfrist: { wert: 1, einheit: 'monate' }, verlaengerungMonate: 1 },
      }),
      f('Haftpflicht', 't-fix', 6500, 'kat-versicherungen', 'lb-absicherung', zeitplan('jaehrlich', 1, 1), { steuerlich: true }),
      f('Hausrat', 't-fix', 9800, 'kat-versicherungen', 'lb-wohnen', zeitplan('jaehrlich', 1, 4)),
      f('Kfz-Versicherung', 't-fix', 54000, 'kat-versicherungen', 'lb-auto', zeitplan('jaehrlich', 1, 1), {
        steuerlich: true,
        vertrag: { beginn: `${jahr - 3}-01-01`, mindestlaufzeitMonate: 12, kuendigungsfrist: { wert: 1, einheit: 'monate' }, verlaengerungMonate: 12 },
      }),
      f('Kfz-Steuer', 't-fix', 18000, 'kat-mobilitaet', 'lb-auto', zeitplan('jaehrlich', 10, 6)),
      f('Rundfunkbeitrag', 't-fix', 5508, 'kat-wohnen', 'lb-wohnen', zeitplan('vierteljaehrlich', 15, 3)),
      f('Berufsunfähigkeit', 't-giro', 6400, 'kat-versicherungen', 'lb-absicherung', zeitplan('monatlich', 1), { steuerlich: true }),
      f('Streaming', 't-fix', 1399, 'kat-abos', 'lb-abos', zeitplan('monatlich', 20)),
      f('Musik', 't-fix', 1099, 'kat-abos', 'lb-abos', zeitplan('monatlich', 8)),
      f('Fitnessstudio', 't-fix', 3490, 'kat-gesundheit', 'lb-gesundheit', zeitplan('monatlich', 1), {
        vertrag: { beginn: plusMonate(heute, -11), mindestlaufzeitMonate: 12, kuendigungsfrist: { wert: 4, einheit: 'wochen' }, verlaengerungMonate: 1 },
      }),
      f('ÖPNV-Abo', 't-giro', 5800, 'kat-mobilitaet', 'lb-sonstiges', zeitplan('monatlich', 1)),
      f('Autokredit', 't-giro', 21500, 'kat-kredite', 'lb-auto', zeitplan('monatlich', 15), {
        finanzierung: { restschuld: 412000, zinsPromille: 49, letzteRate: plusMonate(heute, 19) },
      }),
    ],
  };
}
