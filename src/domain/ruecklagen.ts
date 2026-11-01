/*
 * Rücklagen für Jahreszahlungen (Fixkostenkonto) und Spartöpfe (Sparkonto).
 *
 * Reine Anzeige-Berechnungen: Nichts hier bucht oder verändert Daten.
 */
import { MONATSABSTAND, monatlich } from './geld';
import { plusMonate, plusTage, teile } from './datum';
import { naechsterTermin, termine, zeitplanProblem, type Termin } from './faelligkeiten';
import { ereignisse } from './prognose';
import { aktuellerBetrag, einkommenBetragAm, fixkostenAktivAm, letzterKontostand, ohnePapierkorb } from './posten';
import type { Cent, Daten, Fixkosten, Konto, Ruecklage, Tag } from './typen';

const monatsIndex = (t: Tag) => {
  const { jahr, monat } = teile(t);
  return jahr * 12 + monat;
};

export interface Jahreszahlung {
  posten: Fixkosten;
  betrag: Cent;
  /** Monatlich zurückzulegen (Betrag / Monate zwischen zwei Zahlungen). */
  rate: Cent;
  /** Monate zwischen zwei Zahlungen (2, 3, 6 oder 12). */
  abstand: number;
  naechster: Termin | null;
  /** Sollte heute schon angespart sein. */
  angespart: Cent;
  /** Fälligkeitsmonat fehlt – dann lässt sich nichts berechnen. */
  monatFehlt: boolean;
}

/** Wie viel für eine Zahlung am Stichtag angespart sein sollte: seit der letzten Abbuchung je Monat eine Rate. */
function angespartAm(f: Fixkosten, betrag: Cent, abstand: number, stichtag: Tag): Cent {
  const letzte = termine(f.zeitplan, plusMonate(stichtag, -abstand - 1), stichtag).at(-1);
  if (!letzte) return 0;
  const monate = Math.min(abstand, Math.max(0, monatsIndex(stichtag) - monatsIndex(letzte.ist)));
  return Math.round((betrag * monate) / abstand);
}

/** Alle nicht-monatlichen Fixkosten eines Kontos, sortiert nach der nächsten Abbuchung. */
export function jahreszahlungen(daten: Daten, kontoId: string, stichtag: Tag): Jahreszahlung[] {
  const d = ohnePapierkorb(daten);
  return d.fixkosten
    .filter((f) => f.kontoId === kontoId && f.zeitplan.rhythmus !== 'monatlich' && f.zeitplan.rhythmus !== 'woechentlich' && fixkostenAktivAm(f, stichtag))
    .map((f) => {
      const betrag = aktuellerBetrag(f.preise);
      const abstand = MONATSABSTAND[f.zeitplan.rhythmus as keyof typeof MONATSABSTAND];
      const monatFehlt = zeitplanProblem(f.zeitplan) === 'anker-fehlt';
      return {
        posten: f,
        betrag,
        rate: monatlich(betrag, f.zeitplan.rhythmus),
        abstand,
        naechster: monatFehlt ? null : naechsterTermin(f.zeitplan, plusTage(stichtag, 1)),
        angespart: monatFehlt ? 0 : angespartAm(f, betrag, abstand, stichtag),
        monatFehlt,
      };
    })
    .sort((a, b) => (a.naechster?.ist ?? '9999').localeCompare(b.naechster?.ist ?? '9999'));
}

export interface KontoRuecklage {
  zahlungen: Jahreszahlung[];
  /** Summe, die heute für Jahreszahlungen angespart sein sollte. */
  soll: Cent;
  /** Monatliche Rate für alle Jahreszahlungen zusammen. */
  rateMonatlich: Cent;
  /** Letzter eingetragener Kontostand (oder null). */
  stand: { betrag: Cent; datum: Tag } | null;
  /** Monatliche Abbuchungen, die nach dem Stand noch vor dem nächsten Geldeingang kommen. */
  offenBisEingang: Cent;
  /** Soll am Tag des Kontostands. */
  sollAmStand: Cent;
  /** Kontostand − offene Abbuchungen − Soll. Positiv = mehr da als nötig. null ohne Kontostand. */
  spielraum: Cent | null;
}

/** Stand der Rücklagen für Jahreszahlungen auf einem Konto. */
export function kontoRuecklage(daten: Daten, kontoId: string, heute: Tag): KontoRuecklage {
  const zahlungen = jahreszahlungen(daten, kontoId, heute);
  const soll = zahlungen.reduce((s, z) => s + z.angespart, 0);
  const rateMonatlich = zahlungen.reduce((s, z) => s + z.rate, 0);
  const letzter = letzterKontostand(ohnePapierkorb(daten), kontoId);
  if (!letzter) return { zahlungen, soll, rateMonatlich, stand: null, offenBisEingang: 0, sollAmStand: soll, spielraum: null };

  const datum = letzter.datum;
  const danach = ereignisse(daten, plusTage(datum, 1), plusMonate(datum, 2)).filter((e) => e.kontoId === kontoId);
  const eingang = danach.find((e) => e.betrag > 0)?.datum ?? plusMonate(datum, 1);
  const monatlicheIds = new Set(daten.fixkosten.filter((f) => f.zeitplan.rhythmus === 'monatlich' || f.zeitplan.rhythmus === 'woechentlich').map((f) => f.id));
  const offenBisEingang = -danach
    .filter((e) => e.datum < eingang && e.betrag < 0 && e.art === 'fixkosten' && monatlicheIds.has(e.refId))
    .reduce((s, e) => s + e.betrag, 0);
  const sollAmStand = jahreszahlungen(daten, kontoId, datum).reduce((s, z) => s + z.angespart, 0);
  return {
    zahlungen,
    soll,
    rateMonatlich,
    stand: { betrag: letzter.betrag, datum },
    offenBisEingang,
    sollAmStand,
    spielraum: letzter.betrag - offenBisEingang - sollAmStand,
  };
}

/* ------------------------------------------------------------ Spartöpfe */

export type QuellenTyp = 'einkommen' | 'umbuchung' | 'sparplan' | 'fixkosten';

export interface Spartopf {
  /** Stabile ID der Quelle, z. B. "einkommen:e-123". */
  schluessel: string;
  quelle: { typ: QuellenTyp; id: string };
  name: string;
  monatlich: Cent;
  /** Gespeicherter Stand (Ruecklage-Datensatz) oder undefined. */
  eintrag?: Ruecklage;
  /** Heutiger Stand: eingetragener Stand + Eingänge seither. null, solange kein Stand eingetragen ist. */
  aktuell: Cent | null;
  /** Eingänge seit dem eingetragenen Stand. */
  seitdem: Cent;
}

export const topfSchluessel = (typ: QuellenTyp, id: string) => `${typ}:${id}`;

/** Alle regelmäßigen Geldeingänge eines Kontos als Spartöpfe mit hochgerechnetem Stand. */
export function spartoepfe(daten: Daten, kontoId: string, heute: Tag): Spartopf[] {
  const d = ohnePapierkorb(daten);
  const quellen: { typ: QuellenTyp; id: string; name: string; monatlich: Cent }[] = [
    ...d.einkommen.filter((e) => e.zielKontoId === kontoId).map((e) => ({ typ: 'einkommen' as const, id: e.id, name: e.name, monatlich: monatlich(einkommenBetragAm(e, heute), e.zeitplan.rhythmus) })),
    ...d.umbuchungen.filter((u) => u.nachKontoId === kontoId).map((u) => ({ typ: 'umbuchung' as const, id: u.id, name: u.name || `Von ${d.konten.find((k) => k.id === u.vonKontoId)?.name ?? 'anderem Konto'}`, monatlich: monatlich(u.betrag, u.zeitplan.rhythmus) })),
    ...d.sparplaene.filter((s) => s.zielKontoId === kontoId).map((s) => ({ typ: 'sparplan' as const, id: s.id, name: s.name, monatlich: monatlich(s.betrag, s.zeitplan.rhythmus) })),
    ...d.fixkosten.filter((f) => f.zielKontoId === kontoId && fixkostenAktivAm(f, heute)).map((f) => ({ typ: 'fixkosten' as const, id: f.id, name: f.name, monatlich: monatlich(aktuellerBetrag(f.preise), f.zeitplan.rhythmus) })),
  ];
  return quellen.map((q) => {
    const schluessel = topfSchluessel(q.typ, q.id);
    const eintrag = d.ruecklagen.find((r) => r.quelle && topfSchluessel(r.quelle.typ, r.quelle.id) === schluessel);
    let aktuell: Cent | null = null;
    let seitdem = 0;
    if (eintrag && eintrag.stand !== null && eintrag.stand !== undefined && eintrag.standAm) {
      seitdem = eingaengeSeit(daten, kontoId, q.id, eintrag.standAm, heute);
      aktuell = eintrag.stand + seitdem;
    }
    return { schluessel, quelle: { typ: q.typ, id: q.id }, name: q.name, monatlich: q.monatlich, eintrag, aktuell, seitdem };
  });
}

/** Summe der Eingänge einer Quelle auf dem Konto im Zeitraum (nach "ab", bis einschließlich "bis"). */
function eingaengeSeit(daten: Daten, kontoId: string, refId: string, ab: Tag, bis: Tag): Cent {
  if (ab >= bis) return 0;
  return ereignisse(daten, plusTage(ab, 1), bis)
    .filter((e) => e.kontoId === kontoId && e.refId === refId && e.betrag > 0)
    .reduce((s, e) => s + e.betrag, 0);
}

/** Konto für die Seite "Fixkosten-Konto": Einstellung, sonst das erste Konto mit Rolle Fixkosten. */
export function fixkostenKonto(daten: Daten, gewaehlt?: string): Konto | undefined {
  const konten = ohnePapierkorb(daten).konten;
  return konten.find((k) => k.id === gewaehlt) ?? konten.find((k) => k.rolle === 'fixkosten');
}

/** Konto für die Seite "Sparen": Einstellung, sonst Trade Republic, sonst das Konto mit den meisten Spar-Eingängen. */
export function sparKonto(daten: Daten, gewaehlt?: string, heute = '2000-01-01'): Konto | undefined {
  const d = ohnePapierkorb(daten);
  const direkt = d.konten.find((k) => k.id === gewaehlt) ?? d.konten.find((k) => /trade\s*republic/i.test(`${k.name} ${k.bank}`));
  if (direkt) return direkt;
  const fix = fixkostenKonto(d)?.id;
  return d.konten
    .filter((k) => k.id !== fix && k.rolle !== 'einkommen' && k.typ !== 'kreditkarte')
    .map((k) => ({ k, n: spartoepfe(d, k.id, heute).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.k.reihenfolge - b.k.reihenfolge)[0]?.k;
}
