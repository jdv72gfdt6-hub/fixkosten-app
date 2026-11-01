/*
 * Echte Buchungstermine und Kontostand-Prognose.
 *
 * Diese Sicht verwendet die tatsächlichen Abbuchungstage (inkl. Bankarbeitstage) und NIE
 * Monatsdurchschnitte. Eine Jahreszahlung erscheint hier einmal im Fälligkeitsmonat in voller Höhe.
 */
import { formatEuro } from './geld';
import { formatTag, plusMonate, plusTage, tagImMonatBegrenzt, tageImMonat, tageZwischen, teile, monatPlus } from './datum';
import { termine } from './faelligkeiten';
import { aufBankarbeitstag } from './kalender';
import { betragAm, einkommenBetragAm, fixkostenAktivAm, letzterKontostand, ohnePapierkorb } from './posten';
import type { Cent, Daten, Konto, Tag } from './typen';

export type EreignisArt = 'einkommen' | 'umbuchung' | 'fixkosten' | 'probe' | 'sparen' | 'budget' | 'einmalig' | 'karte';

export interface Ereignis {
  /** Stabiler Schlüssel je Termin, z. B. für den Monatsabschluss. */
  schluessel: string;
  datum: Tag;
  sollDatum: Tag;
  kontoId: string;
  /** Vorzeichenbehaftet aus Sicht des Kontos: negativ = Abfluss. */
  betrag: Cent;
  art: EreignisArt;
  refId: string;
  name: string;
  angenommen: boolean;
  gegenkontoId?: string;
}

interface Optionen {
  /** Budgets (z. B. Tanken) tageweise verteilen. Für Kalender und Abschluss aus. */
  mitBudgets?: boolean;
}

/** Abrechnungstermine einer Kreditkarte im Zeitraum (auf Bankarbeitstag verschoben). */
function abrechnungstermine(konto: Konto, von: Tag, bis: Tag): Tag[] {
  if (!konto.kreditkarte) return [];
  const ergebnis: Tag[] = [];
  const s = teile(von);
  const e = teile(bis);
  const n = (e.jahr - s.jahr) * 12 + (e.monat - s.monat) + 1;
  for (let i = -1; i <= n; i++) {
    const { jahr, monat } = monatPlus(s.jahr, s.monat, i);
    const t = aufBankarbeitstag(tagImMonatBegrenzt(jahr, monat, konto.kreditkarte.abrechnungstag), 'nachher');
    if (t >= von && t <= bis) ergebnis.push(t);
  }
  return ergebnis;
}

/** Alle erwarteten Buchungen aller Konten im Zeitraum [von, bis]. */
export function ereignisse(daten: Daten, von: Tag, bis: Tag, opt: Optionen = {}): Ereignis[] {
  const d = ohnePapierkorb(daten);
  const kontoIds = new Set(d.konten.map((k) => k.id));
  const liste: Ereignis[] = [];
  const add = (e: Ereignis) => {
    if (kontoIds.has(e.kontoId)) liste.push(e);
  };

  for (const e of d.einkommen) {
    for (const t of termine(e.zeitplan, von, bis)) {
      add({ schluessel: `einkommen|${e.id}|${t.soll}`, datum: t.ist, sollDatum: t.soll, kontoId: e.zielKontoId, betrag: einkommenBetragAm(e, t.soll), art: 'einkommen', refId: e.id, name: e.name, angenommen: t.angenommen });
    }
  }
  for (const u of d.umbuchungen) {
    for (const t of termine(u.zeitplan, von, bis)) {
      const name = u.name || 'Umbuchung';
      add({ schluessel: `umbuchung|${u.id}|${t.soll}`, datum: t.ist, sollDatum: t.soll, kontoId: u.vonKontoId, betrag: -u.betrag, art: 'umbuchung', refId: u.id, name, angenommen: t.angenommen, gegenkontoId: u.nachKontoId });
      add({ schluessel: `umbuchung-ein|${u.id}|${t.soll}`, datum: t.ist, sollDatum: t.soll, kontoId: u.nachKontoId, betrag: u.betrag, art: 'umbuchung', refId: u.id, name, angenommen: t.angenommen, gegenkontoId: u.vonKontoId });
    }
  }
  for (const f of d.fixkosten) {
    for (const t of termine(f.zeitplan, von, bis)) {
      if (!fixkostenAktivAm(f, t.soll)) continue;
      const betrag = betragAm(f.preise, t.soll);
      add({ schluessel: `fixkosten|${f.id}|${t.soll}`, datum: t.ist, sollDatum: t.soll, kontoId: f.kontoId, betrag: -betrag, art: 'fixkosten', refId: f.id, name: f.name, angenommen: t.angenommen, gegenkontoId: f.zielKontoId });
      if (f.zielKontoId) {
        add({ schluessel: `probe|${f.id}|${t.soll}`, datum: t.ist, sollDatum: t.soll, kontoId: f.zielKontoId, betrag, art: 'probe', refId: f.id, name: f.name, angenommen: t.angenommen, gegenkontoId: f.kontoId });
      }
    }
  }
  for (const s of d.sparplaene) {
    for (const t of termine(s.zeitplan, von, bis)) {
      add({ schluessel: `sparen|${s.id}|${t.soll}`, datum: t.ist, sollDatum: t.soll, kontoId: s.vonKontoId, betrag: -s.betrag, art: 'sparen', refId: s.id, name: s.name, angenommen: t.angenommen, gegenkontoId: s.zielKontoId });
      if (s.zielKontoId) {
        add({ schluessel: `sparen-ein|${s.id}|${t.soll}`, datum: t.ist, sollDatum: t.soll, kontoId: s.zielKontoId, betrag: s.betrag, art: 'sparen', refId: s.id, name: s.name, angenommen: t.angenommen, gegenkontoId: s.vonKontoId });
      }
    }
  }
  for (const e of d.einmalig) {
    if (e.datum < von || e.datum > bis) continue;
    add({ schluessel: `einmalig|${e.id}|${e.datum}`, datum: e.datum, sollDatum: e.datum, kontoId: e.kontoId, betrag: e.art === 'einnahme' ? e.betrag : -e.betrag, art: 'einmalig', refId: e.id, name: e.name, angenommen: false });
  }

  // Kreditkarten: alle Belastungen einer Abrechnungsperiode werden gesammelt vom Referenzkonto abgebucht.
  for (const k of d.konten) {
    if (!k.kreditkarte) continue;
    for (const abrechnung of abrechnungstermine(k, von, bis)) {
      const vorher = abrechnungstermine(k, plusMonate(abrechnung, -2), plusTage(abrechnung, -1)).at(-1) ?? plusMonate(abrechnung, -1);
      const belastungen = ereignisse(
        { ...daten, konten: daten.konten.map((x) => (x.id === k.id ? { ...x, kreditkarte: undefined } : x)) },
        plusTage(vorher, 1),
        abrechnung,
      ).filter((e) => e.kontoId === k.id && e.betrag < 0);
      const summe = -belastungen.reduce((s, e) => s + e.betrag, 0);
      if (summe === 0) continue;
      const name = `Abrechnung ${k.name}`;
      add({ schluessel: `karte|${k.id}|${abrechnung}`, datum: abrechnung, sollDatum: abrechnung, kontoId: k.kreditkarte.referenzKontoId, betrag: -summe, art: 'karte', refId: k.id, name, angenommen: false, gegenkontoId: k.id });
      add({ schluessel: `karte-ein|${k.id}|${abrechnung}`, datum: abrechnung, sollDatum: abrechnung, kontoId: k.id, betrag: summe, art: 'karte', refId: k.id, name, angenommen: false, gegenkontoId: k.kreditkarte.referenzKontoId });
    }
  }

  if (opt.mitBudgets) {
    for (const b of d.budgets) {
      for (let t = von; t <= bis; t = plusTage(t, 1)) {
        const { jahr, monat, tag } = teile(t);
        const n = tageImMonat(jahr, monat);
        // Ganzzahlig verteilen: Summe über den Monat ist exakt der Monatsbetrag.
        const anteil = Math.floor((b.monatlich * tag) / n) - Math.floor((b.monatlich * (tag - 1)) / n);
        if (anteil) add({ schluessel: `budget|${b.id}|${t}`, datum: t, sollDatum: t, kontoId: b.kontoId, betrag: -anteil, art: 'budget', refId: b.id, name: b.name, angenommen: false });
      }
    }
  }

  return liste.sort((a, b) => (a.datum === b.datum ? a.betrag - b.betrag : a.datum < b.datum ? -1 : 1));
}

export interface PrognosePunkt {
  datum: Tag;
  saldo: Cent;
}

export type WarnStufe = 'puffer' | 'minus' | 'dispo';

export interface PrognoseWarnung {
  kontoId: string;
  datum: Tag;
  stufe: WarnStufe;
  /** Tiefster Stand im betroffenen Zeitraum. */
  tiefsterSaldo: Cent;
  /** Fehlbetrag bis zum Mindestpuffer. */
  fehlbetrag: Cent;
  ursache: Ereignis | null;
  text: string;
}

export interface KontoPrognose {
  kontoId: string;
  startDatum: Tag;
  startSaldo: Cent;
  /** Kein Kontostand eingetragen: Prognose startet bei 0 € und erzeugt keine Warnungen. */
  ohneStand: boolean;
  /** Tage seit dem letzten eingetragenen Stand. */
  standAlterTage: number | null;
  punkte: PrognosePunkt[];
  tiefpunkt: PrognosePunkt;
  warnungen: PrognoseWarnung[];
  ereignisse: Ereignis[];
  angenommeneTermine: number;
}

/** Ab so vielen Tagen gilt ein Kontostand als veraltet. */
export const STAND_VERALTET_TAGE = 14;

/** Saldo eines Kontos an einem Tag aus Startstand und Ereignissen. */
export function saldoAm(daten: Daten, kontoId: string, tag: Tag): { saldo: Cent; ohneStand: boolean } {
  const stand = letzterKontostandBis(daten, kontoId, tag);
  if (!stand) return { saldo: 0, ohneStand: true };
  const e = ereignisseMitKarte(daten, stand.datum, tag).filter((x) => x.kontoId === kontoId);
  return { saldo: stand.betrag + e.reduce((s, x) => s + x.betrag, 0), ohneStand: false };
}

function letzterKontostandBis(daten: Daten, kontoId: string, tag: Tag) {
  return letzterKontostand({ ...daten, kontostaende: daten.kontostaende.filter((k) => k.datum <= tag) }, kontoId);
}

/** Ereignisse ab dem Tag NACH dem Stand (der Stand enthält die Buchungen seines Tages). */
function ereignisseMitKarte(daten: Daten, standDatum: Tag, bis: Tag): Ereignis[] {
  return ereignisse(daten, plusTage(standDatum, 1), bis, { mitBudgets: true });
}

/** Tägliche Kontostand-Prognose für alle Konten bis heute + monate. */
export function prognose(daten: Daten, heute: Tag, monate: number): KontoPrognose[] {
  const d = ohnePapierkorb(daten);
  const ende = plusMonate(heute, monate);
  return d.konten.map((konto) => prognoseKonto(daten, konto, heute, ende));
}

export function prognoseKonto(daten: Daten, konto: Konto, heute: Tag, ende: Tag): KontoPrognose {
  const stand = letzterKontostand(daten, konto.id);
  const ohneStand = !stand;
  const startDatum = stand ? (stand.datum < heute ? stand.datum : heute) : heute;
  const startSaldo = stand?.betrag ?? 0;
  const alle = ereignisseMitKarte(daten, startDatum, ende);
  let eigene = alle.filter((e) => e.kontoId === konto.id);

  // Offene Kartenbelastungen aus dem eingetragenen Kartenstand werden bei der nächsten Abrechnung ausgeglichen.
  if (konto.kreditkarte === undefined) {
    for (const karte of daten.konten.filter((k) => k.kreditkarte?.referenzKontoId === konto.id && !k.geloeschtAm)) {
      const kStand = letzterKontostand(daten, karte.id);
      if (!kStand || kStand.betrag >= 0) continue;
      const erste = eigene.find((e) => e.art === 'karte' && e.refId === karte.id && e.datum > kStand.datum);
      if (erste) eigene = eigene.map((e) => (e === erste ? { ...e, betrag: e.betrag + kStand.betrag } : e));
    }
  }

  const punkte: PrognosePunkt[] = [];
  const warnungen: PrognoseWarnung[] = [];
  const proTag = new Map<Tag, Ereignis[]>();
  for (const e of eigene) {
    const l = proTag.get(e.datum);
    if (l) l.push(e);
    else proTag.set(e.datum, [e]);
  }

  const warnungAktiv = !ohneStand && konto.typ !== 'kreditkarte';
  let saldo = startSaldo;
  let tief: PrognosePunkt | null = null;
  let offen: PrognoseWarnung | null = null;

  for (let t = startDatum; t <= ende; t = plusTage(t, 1)) {
    const heuteEreignisse = t === startDatum ? [] : (proTag.get(t) ?? []);
    for (const e of heuteEreignisse) saldo += e.betrag;
    punkte.push({ datum: t, saldo });
    if (t >= heute && (!tief || saldo < tief.saldo)) tief = { datum: t, saldo };

    if (!warnungAktiv || t < heute) continue;
    const stufe: WarnStufe | null =
      konto.dispo !== undefined && saldo < -konto.dispo ? 'dispo' : saldo < 0 ? 'minus' : saldo < konto.mindestpuffer ? 'puffer' : null;
    if (stufe) {
      if (!offen) {
        // Ursache: größte Abbuchung der letzten 30 Tage (z. B. der Jahresbeitrag, der das Konto geleert hat).
        const ab = plusTage(t, -30);
        const ursache = eigene.filter((e) => e.betrag < 0 && e.art !== 'budget' && e.datum > ab && e.datum <= t).sort((a, b) => a.betrag - b.betrag)[0] ?? null;
        offen = { kontoId: konto.id, datum: t, stufe, tiefsterSaldo: saldo, fehlbetrag: 0, ursache, text: '' };
        warnungen.push(offen);
      }
      if (saldo < offen.tiefsterSaldo) offen.tiefsterSaldo = saldo;
      if (rang(stufe) > rang(offen.stufe)) offen.stufe = stufe;
    } else {
      offen = null;
    }
  }
  for (const w of warnungen) {
    w.fehlbetrag = konto.mindestpuffer - w.tiefsterSaldo;
    w.text = warnText(w, konto);
  }

  return {
    kontoId: konto.id,
    startDatum,
    startSaldo,
    ohneStand,
    standAlterTage: stand ? tageZwischen(stand.datum, heute) : null,
    punkte,
    tiefpunkt: tief ?? punkte.at(-1)!,
    warnungen,
    ereignisse: eigene.filter((e) => e.art !== 'budget'),
    angenommeneTermine: eigene.filter((e) => e.angenommen).length,
  };
}

function rang(s: WarnStufe): number {
  return s === 'puffer' ? 0 : s === 'minus' ? 1 : 2;
}

function warnText(w: PrognoseWarnung, konto: Konto): string {
  const wegen = w.ursache ? ` wegen ${w.ursache.name}` : '';
  const grenze = w.stufe === 'puffer' ? `unter den Mindestpuffer von ${formatEuro(konto.mindestpuffer, { kurz: true })}` : w.stufe === 'minus' ? 'ins Minus' : 'über den Dispo';
  return `Am ${formatTag(w.datum)} fällt ${konto.name} ${grenze}${wegen}. Es fehlen ${formatEuro(w.fehlbetrag)}.`;
}
