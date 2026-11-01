/* Anstehende Fristen, Kalender-Export, Monatsabschluss und Kontostand-Abgleich. */
import { formatEuro } from './geld';
import { ersterDesMonats, formatTag, letzterDesMonats, plusMonate, plusTage } from './datum';
import type { KalenderTermin } from './ics';
import { ereignisse, saldoAm, type Ereignis } from './prognose';
import { letzterKontostand, ohnePapierkorb } from './posten';
import { finanzierungsenden, kuendigungsinfo } from './vertraege';
import type { Cent, Daten, Tag } from './typen';

export type AnstehendArt = 'kuendigung' | 'abbuchung' | 'einmalig' | 'letzte-rate';

export interface AnstehendEintrag {
  datum: Tag;
  art: AnstehendArt;
  titel: string;
  betrag?: Cent;
  refId: string;
  kontoId?: string;
}

const NICHT_MONATLICH = new Set(['zweimonatlich', 'vierteljaehrlich', 'halbjaehrlich', 'jaehrlich']);

/** Fristen und größere Termine der nächsten `tage` Tage. */
export function anstehend(daten: Daten, heute: Tag, tage = 60): AnstehendEintrag[] {
  const d = ohnePapierkorb(daten);
  const bis = plusTage(heute, tage);
  const liste: AnstehendEintrag[] = [];

  for (const f of d.fixkosten) {
    const info = kuendigungsinfo(f, heute);
    if (info.status === 'ok' && !info.jederzeit && info.kuendigenBis! <= bis) {
      liste.push({ datum: info.kuendigenBis!, art: 'kuendigung', titel: `${f.name} kündigen bis`, refId: f.id });
    }
  }
  const fixIds = new Map(d.fixkosten.map((f) => [f.id, f]));
  for (const e of ereignisse(daten, heute, bis)) {
    if (e.art === 'fixkosten') {
      const f = fixIds.get(e.refId);
      if (f && NICHT_MONATLICH.has(f.zeitplan.rhythmus)) {
        liste.push({ datum: e.datum, art: 'abbuchung', titel: e.name, betrag: e.betrag, refId: e.refId, kontoId: e.kontoId });
      }
    } else if (e.art === 'einmalig' && e.betrag < 0) {
      liste.push({ datum: e.datum, art: 'einmalig', titel: e.name, betrag: e.betrag, refId: e.refId, kontoId: e.kontoId });
    }
  }
  for (const fe of finanzierungsenden(daten, heute)) {
    if (fe.letzteRate <= bis) liste.push({ datum: fe.letzteRate, art: 'letzte-rate', titel: `Letzte Rate ${fe.posten.name}`, refId: fe.posten.id });
  }
  return liste.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
}

/** Termine für den .ics-Export: Kündigungsfristen, nicht-monatliche Abbuchungen (12 Monate), letzte Raten. */
export function kalenderTermine(daten: Daten, heute: Tag): KalenderTermin[] {
  const d = ohnePapierkorb(daten);
  const konto = new Map(d.konten.map((k) => [k.id, k.name]));
  const termine: KalenderTermin[] = [];
  for (const f of d.fixkosten) {
    const info = kuendigungsinfo(f, heute);
    if (info.status === 'ok' && !info.jederzeit) {
      termine.push({
        uid: `kuendigung-${f.id}@fixkosten-app`,
        datum: info.kuendigenBis!,
        titel: `Kündigungsfrist: ${f.name}`,
        beschreibung: `Letzter Tag, an dem die Kündigung eingehen muss. Laufzeit endet am ${formatTag(info.laufzeitEnde!)}.`,
        erinnerungTageVorher: 14,
      });
    }
  }
  const fixIds = new Map(d.fixkosten.map((f) => [f.id, f]));
  for (const e of ereignisse(daten, heute, plusMonate(heute, 12))) {
    const f = e.art === 'fixkosten' ? fixIds.get(e.refId) : undefined;
    if (f && NICHT_MONATLICH.has(f.zeitplan.rhythmus)) {
      termine.push({
        uid: `abbuchung-${f.id}-${e.sollDatum}@fixkosten-app`,
        datum: e.datum,
        titel: `${f.name}: ${formatEuro(-e.betrag)}`,
        beschreibung: `Abbuchung von ${konto.get(e.kontoId) ?? 'Konto'}. Bitte prüfen, ob genug Geld auf dem Konto ist.`,
        erinnerungTageVorher: 3,
      });
    } else if (e.art === 'einmalig' && e.betrag < 0) {
      termine.push({ uid: `einmalig-${e.refId}@fixkosten-app`, datum: e.datum, titel: `${e.name}: ${formatEuro(-e.betrag)}`, erinnerungTageVorher: 3 });
    }
  }
  for (const fe of finanzierungsenden(daten, heute)) {
    termine.push({ uid: `letzte-rate-${fe.posten.id}@fixkosten-app`, datum: fe.letzteRate, titel: `Letzte Rate: ${fe.posten.name}` });
  }
  return termine.sort((a, b) => (a.datum < b.datum ? -1 : 1));
}

/** Gegenbuchungen, die im Abschluss nicht doppelt erscheinen sollen. */
function istGegenbuchung(e: Ereignis): boolean {
  return /^(umbuchung-ein|sparen-ein|probe|karte-ein)\|/.test(e.schluessel);
}

/** Erwartete Buchungen eines Monats für die Abschluss-Checkliste (eine Zeile pro Vorgang). */
export function erwarteteBuchungen(daten: Daten, monat: string, kontoId?: string): Ereignis[] {
  const [j, m] = monat.split('-').map(Number) as [number, number];
  return ereignisse(daten, ersterDesMonats(j, m), letzterDesMonats(j, m)).filter((e) => {
    if (kontoId) return e.kontoId === kontoId;
    return !istGegenbuchung(e);
  });
}

export interface RuecklagenCheck {
  kontoId: string;
  bis: Tag;
  /** Nicht-monatliche Abbuchungen im Zeitraum (z. B. Jahresbeiträge). */
  faellig: Ereignis[];
  tiefsterSaldo: Cent;
  tiefsterTag: Tag;
  /** Was heute zusätzlich auf dem Konto sein müsste, damit der Mindestpuffer nie unterschritten wird. */
  fehlbetrag: Cent;
  ohneStand: boolean;
}

/**
 * Reichen Kontostand und laufende Umbuchungen für die nächsten nicht-monatlichen Fälligkeiten?
 * Nutzt die echte Prognose (Termine), nicht die Monatsdurchschnitte.
 */
export function ruecklagenCheck(daten: Daten, kontoId: string, heute: Tag, monate = 4): RuecklagenCheck {
  const d = ohnePapierkorb(daten);
  const konto = d.konten.find((k) => k.id === kontoId);
  const bis = plusMonate(heute, monate);
  const stand = letzterKontostand(d, kontoId);
  const start = stand ? (stand.datum < heute ? stand.datum : heute) : heute;
  let saldo = stand?.betrag ?? 0;
  let tief = { saldo, tag: heute };
  const alle = ereignisse(daten, plusTage(start, 1), bis, { mitBudgets: true }).filter((e) => e.kontoId === kontoId);
  for (const e of alle) {
    saldo += e.betrag;
    if (e.datum >= heute && saldo < tief.saldo) tief = { saldo, tag: e.datum };
  }
  const nichtMonatlich = new Set(d.fixkosten.filter((f) => NICHT_MONATLICH.has(f.zeitplan.rhythmus)).map((f) => f.id));
  const puffer = konto?.mindestpuffer ?? 0;
  return {
    kontoId,
    bis,
    faellig: alle.filter((e) => e.art === 'fixkosten' && nichtMonatlich.has(e.refId) && e.datum >= heute),
    tiefsterSaldo: tief.saldo,
    tiefsterTag: tief.tag,
    fehlbetrag: Math.max(0, puffer - tief.saldo),
    ohneStand: !stand,
  };
}

export interface AbgleichErgebnis {
  erwartet: Cent;
  differenz: Cent;
  ohneStand: boolean;
  /** Buchungen seit dem letzten Stand, die die Differenz erklären könnten; exakte Treffer zuerst. */
  kandidaten: { ereignis: Ereignis; exakt: boolean }[];
}

/** Echten Kontostand mit dem erwarteten Stand vergleichen und mögliche Ursachen finden. */
export function abgleich(daten: Daten, kontoId: string, datum: Tag, istSaldo: Cent): AbgleichErgebnis {
  const { saldo, ohneStand } = saldoAm(daten, kontoId, datum);
  const differenz = istSaldo - saldo;
  const stand = letzterKontostand({ ...daten, kontostaende: daten.kontostaende.filter((k) => k.datum <= datum) }, kontoId);
  const kandidaten = stand
    ? ereignisse(daten, plusTage(stand.datum, 1), datum)
        .filter((e) => e.kontoId === kontoId)
        .map((ereignis) => ({ ereignis, exakt: differenz !== 0 && Math.abs(ereignis.betrag) === Math.abs(differenz) }))
        .sort((a, b) => Number(b.exakt) - Number(a.exakt) || Math.abs(Math.abs(a.ereignis.betrag) - Math.abs(differenz)) - Math.abs(Math.abs(b.ereignis.betrag) - Math.abs(differenz)))
    : [];
  return { erwartet: saldo, differenz, ohneStand, kandidaten };
}
