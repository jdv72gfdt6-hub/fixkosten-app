/*
 * Monatsdurchschnitte: Deckungsprüfung pro Konto und Monatsübersicht.
 *
 * Diese Sicht rechnet AUSSCHLIESSLICH mit Monatsdurchschnitten (Jahreszahlung / 12 usw.).
 * Echte Abbuchungstermine gibt es nur in der Prognose (prognose.ts). Beide Sichten
 * werden nie vermischt, damit nichts doppelt gezählt wird.
 *
 * Intern wird in "Jahres-Cent" summiert (ganzzahlig) und erst am Ende auf Monats-Cent gerundet.
 */
import { anteilJahresCent, jahresCent, monatAusJahresCent, prozent } from './geld';
import { einkommenBetragAm, fixkostenAktivAm, betragAm, ohnePapierkorb } from './posten';
import type { Cent, Daten, Konto, Tag } from './typen';

export type ZeilenArt =
  | 'einkommen'
  | 'umbuchung-ein'
  | 'umbuchung-aus'
  | 'fixkosten'
  | 'probe-ein'
  | 'sparen-aus'
  | 'sparen-ein'
  | 'budget'
  | 'ruecklage'
  | 'karte-ein'
  | 'karte-aus';

export interface BilanzZeile {
  art: ZeilenArt;
  refId: string;
  name: string;
  /** Exakter Jahreswert in Cent (ungerundet summierbar). */
  jahresCent: number;
  /** Gerundeter Monatswert für die Anzeige. */
  monatlich: Cent;
  /** Stammt aus einer nicht-monatlichen Zahlung (anteilige Rücklage). */
  nichtMonatlich: boolean;
}

export interface KontoDeckung {
  konto: Konto;
  zufluesse: BilanzZeile[];
  abfluesse: BilanzZeile[];
  zuflussMonat: Cent;
  abflussMonat: Cent;
  /** Positiv = Überdeckung, negativ = Unterdeckung (pro Monat). */
  saldoMonat: Cent;
  /** Monatlich zurückzulegender Anteil für Quartals-, Halbjahres- und Jahreszahlungen. */
  anteiligeRuecklage: Cent;
  vorschlag: DeckungsVorschlag | null;
}

export interface DeckungsVorschlag {
  art: 'erhoehen' | 'neu' | 'senken';
  umbuchungId?: string;
  vonKontoId?: string;
  /** Änderung in Cent (auf volle Euro aufgerundet). */
  differenz: Cent;
  neuerBetrag?: Cent;
  text: string;
}

function zeile(art: ZeilenArt, refId: string, name: string, jc: number, nichtMonatlich = false): BilanzZeile {
  return { art, refId, name, jahresCent: jc, monatlich: monatAusJahresCent(jc), nichtMonatlich };
}

function summeJc(zeilen: BilanzZeile[]): number {
  return zeilen.reduce((s, z) => s + z.jahresCent, 0);
}

/** Auf volle Euro aufrunden (für Vorschläge zu Daueraufträgen). */
function aufVolleEuro(cent: Cent): Cent {
  return Math.ceil(cent / 100) * 100;
}

/** Deckungsprüfung für alle Konten zum Stichtag (Monatsdurchschnitte). */
export function deckung(daten: Daten, stichtag: Tag): KontoDeckung[] {
  const d = ohnePapierkorb(daten);
  const zu = new Map<string, BilanzZeile[]>();
  const ab = new Map<string, BilanzZeile[]>();
  for (const k of d.konten) {
    zu.set(k.id, []);
    ab.set(k.id, []);
  }
  const push = (m: Map<string, BilanzZeile[]>, kontoId: string | undefined, z: BilanzZeile) => {
    if (kontoId && m.has(kontoId)) m.get(kontoId)!.push(z);
  };
  const kontoName = (id: string) => d.konten.find((k) => k.id === id)?.name ?? 'Unbekanntes Konto';

  for (const e of d.einkommen) {
    push(zu, e.zielKontoId, zeile('einkommen', e.id, e.name, jahresCent(einkommenBetragAm(e, stichtag), e.zeitplan.rhythmus)));
  }
  for (const u of d.umbuchungen) {
    const jc = jahresCent(u.betrag, u.zeitplan.rhythmus);
    push(ab, u.vonKontoId, zeile('umbuchung-aus', u.id, u.name || `Umbuchung → ${kontoName(u.nachKontoId)}`, jc));
    push(zu, u.nachKontoId, zeile('umbuchung-ein', u.id, u.name || `Umbuchung von ${kontoName(u.vonKontoId)}`, jc));
  }
  for (const f of d.fixkosten) {
    if (!fixkostenAktivAm(f, stichtag)) continue;
    // Für die Kontodeckung zählt immer der volle Betrag, der vom Konto abgeht.
    const jc = jahresCent(betragAm(f.preise, stichtag), f.zeitplan.rhythmus);
    push(ab, f.kontoId, zeile('fixkosten', f.id, f.name, jc, f.zeitplan.rhythmus !== 'monatlich' && f.zeitplan.rhythmus !== 'woechentlich'));
    if (f.zielKontoId) push(zu, f.zielKontoId, zeile('probe-ein', f.id, f.name, jc));
  }
  for (const s of d.sparplaene) {
    const jc = jahresCent(s.betrag, s.zeitplan.rhythmus);
    push(ab, s.vonKontoId, zeile('sparen-aus', s.id, s.name, jc));
    push(zu, s.zielKontoId, zeile('sparen-ein', s.id, s.name, jc));
  }
  for (const b of d.budgets) push(ab, b.kontoId, zeile('budget', b.id, b.name, b.monatlich * 12));
  for (const r of d.ruecklagen) {
    if (r.virtuell && r.monatlich) push(ab, r.kontoId, zeile('ruecklage', r.id, r.name, r.monatlich * 12));
  }
  // Kreditkarten: Die Karte wird über das Referenzkonto ausgeglichen.
  for (const k of d.konten) {
    if (!k.kreditkarte) continue;
    const jc = summeJc(ab.get(k.id)!);
    if (jc === 0) continue;
    push(zu, k.id, zeile('karte-ein', k.id, `Ausgleich von ${kontoName(k.kreditkarte.referenzKontoId)}`, jc));
    push(ab, k.kreditkarte.referenzKontoId, zeile('karte-aus', k.id, `Abrechnung ${k.name}`, jc));
  }

  return d.konten.map((konto) => {
    const zufluesse = zu.get(konto.id)!;
    const abfluesse = ab.get(konto.id)!;
    const saldoJc = summeJc(zufluesse) - summeJc(abfluesse);
    const ergebnis: KontoDeckung = {
      konto,
      zufluesse,
      abfluesse,
      zuflussMonat: monatAusJahresCent(summeJc(zufluesse)),
      abflussMonat: monatAusJahresCent(summeJc(abfluesse)),
      saldoMonat: monatAusJahresCent(saldoJc),
      anteiligeRuecklage: monatAusJahresCent(summeJc(abfluesse.filter((z) => z.nichtMonatlich))),
      vorschlag: null,
    };
    ergebnis.vorschlag = vorschlagFuer(ergebnis, daten, kontoName);
    return ergebnis;
  });
}

function vorschlagFuer(k: KontoDeckung, daten: Daten, kontoName: (id: string) => string): DeckungsVorschlag | null {
  if (k.saldoMonat === 0 || k.abfluesse.length === 0) return null;
  // Konten mit eigenem Einkommen werden nicht über Umbuchungen gesteuert.
  if (k.zufluesse.some((z) => z.art === 'einkommen')) return null;
  const eingehend = daten.umbuchungen
    .filter((u) => !u.geloeschtAm && u.nachKontoId === k.konto.id && u.zeitplan.rhythmus === 'monatlich')
    .sort((a, b) => b.betrag - a.betrag)[0];

  if (k.saldoMonat < 0) {
    const differenz = aufVolleEuro(-k.saldoMonat);
    if (eingehend) {
      return {
        art: 'erhoehen',
        umbuchungId: eingehend.id,
        vonKontoId: eingehend.vonKontoId,
        differenz,
        neuerBetrag: eingehend.betrag + differenz,
        text: `Erhöhe deinen Dauerauftrag von ${kontoName(eingehend.vonKontoId)} auf ${k.konto.name} um ${differenz / 100} €, damit alle Abbuchungen gedeckt sind.`,
      };
    }
    return {
      art: 'neu',
      differenz,
      text: `Richte einen monatlichen Dauerauftrag über ${differenz / 100} € auf ${k.konto.name} ein, damit alle Abbuchungen gedeckt sind.`,
    };
  }
  // Deutliche Überdeckung auf einem reinen Fixkostenkonto (mindestens 10 €).
  if (eingehend && k.konto.rolle === 'fixkosten' && k.saldoMonat >= 1000) {
    const differenz = Math.floor(k.saldoMonat / 100) * 100;
    return {
      art: 'senken',
      umbuchungId: eingehend.id,
      vonKontoId: eingehend.vonKontoId,
      differenz,
      neuerBetrag: eingehend.betrag - differenz,
      text: `${k.konto.name} ist um ${differenz / 100} € pro Monat überdeckt. Du könntest den Dauerauftrag senken oder den Betrag als Puffer behalten.`,
    };
  }
  return null;
}

export interface Summe {
  id: string;
  name: string;
  monatlich: Cent;
  jahresCent: number;
}

export interface Monatsuebersicht {
  stichtag: Tag;
  einkommen: Cent;
  /** Fixkosten (eigener Anteil) – ohne Sparen, Rücklagen, Budgets und Umbuchungen. */
  fixkosten: Cent;
  vermoegensaufbau: Cent;
  ruecklagen: Cent;
  budgets: Cent;
  /** Was nach Fixkosten, Vermögensaufbau, Rücklagen und Budgets frei bleibt. */
  frei: Cent;
  /** Prozent oder null, wenn kein Einkommen da ist. */
  fixkostenquote: number | null;
  sparquote: number | null;
  ruecklagenquote: number | null;
  proKategorie: Summe[];
  proLebensbereich: Summe[];
  proKonto: Summe[];
  /** Lebensbereich-Summe enthält alles, was diesem Bereich zugeordnet ist (Fixkosten, Budgets, Rücklagen, Sparen). */
  hinweise: string[];
}

function addiere(m: Map<string, number>, id: string | undefined, jc: number) {
  if (!id) return;
  m.set(id, (m.get(id) ?? 0) + jc);
}

/** Monatsübersicht zum Stichtag. Alle Summen aus ungerundeten Jahres-Cent. */
export function monatsuebersicht(daten: Daten, stichtag: Tag): Monatsuebersicht {
  const d = ohnePapierkorb(daten);
  const kontoById = new Map(d.konten.map((k) => [k.id, k]));

  const einkommenJc = d.einkommen.reduce(
    (s, e) => s + jahresCent(einkommenBetragAm(e, stichtag), e.zeitplan.rhythmus),
    0,
  );

  const proKategorie = new Map<string, number>();
  const proLebensbereich = new Map<string, number>();
  const proKonto = new Map<string, number>();

  let fixJc = 0;
  for (const f of d.fixkosten) {
    if (!fixkostenAktivAm(f, stichtag)) continue;
    const jc = anteilJahresCent(jahresCent(betragAm(f.preise, stichtag), f.zeitplan.rhythmus), f.anteil);
    fixJc += jc;
    addiere(proKategorie, f.kategorieId, jc);
    addiere(proLebensbereich, f.lebensbereichId, jc);
    addiere(proKonto, f.kontoId, jc);
  }

  let vermoegenJc = 0;
  for (const s of d.sparplaene) {
    const jc = jahresCent(s.betrag, s.zeitplan.rhythmus);
    vermoegenJc += jc;
    addiere(proLebensbereich, s.lebensbereichId, jc);
  }

  let ruecklagenJc = 0;
  for (const u of d.umbuchungen) {
    const ziel = kontoById.get(u.nachKontoId);
    if (!ziel) continue;
    const jc = jahresCent(u.betrag, u.zeitplan.rhythmus);
    // Umbuchungen sind keine Kosten. Sie zählen nur, wenn sie Geld in eine Rücklage
    // oder in den Vermögensaufbau verschieben – und dann genau dort, nie als Ausgabe.
    if (ziel.rolle === 'ruecklage') {
      ruecklagenJc += jc;
      addiere(proLebensbereich, ziel.lebensbereichId, jc);
    } else if (ziel.rolle === 'vermoegen') {
      vermoegenJc += jc;
      addiere(proLebensbereich, ziel.lebensbereichId, jc);
    }
  }
  for (const r of d.ruecklagen) {
    if (!r.virtuell || !r.monatlich) continue;
    ruecklagenJc += r.monatlich * 12;
    addiere(proLebensbereich, r.lebensbereichId, r.monatlich * 12);
  }

  let budgetJc = 0;
  for (const b of d.budgets) {
    budgetJc += b.monatlich * 12;
    addiere(proLebensbereich, b.lebensbereichId, b.monatlich * 12);
  }

  const freiJc = einkommenJc - fixJc - vermoegenJc - ruecklagenJc - budgetJc;
  const hinweise: string[] = [];
  if (einkommenJc === 0) hinweise.push('Kein Einkommen hinterlegt – Quoten können nicht berechnet werden.');

  const alsSummen = (m: Map<string, number>, namen: Map<string, string>): Summe[] =>
    [...m.entries()]
      .map(([id, jc]) => ({ id, name: namen.get(id) ?? 'Ohne Zuordnung', jahresCent: jc, monatlich: monatAusJahresCent(jc) }))
      .sort((a, b) => b.jahresCent - a.jahresCent);

  return {
    stichtag,
    einkommen: monatAusJahresCent(einkommenJc),
    fixkosten: monatAusJahresCent(fixJc),
    vermoegensaufbau: monatAusJahresCent(vermoegenJc),
    ruecklagen: monatAusJahresCent(ruecklagenJc),
    budgets: monatAusJahresCent(budgetJc),
    frei: monatAusJahresCent(freiJc),
    fixkostenquote: prozent(fixJc, einkommenJc),
    sparquote: prozent(vermoegenJc, einkommenJc),
    ruecklagenquote: prozent(ruecklagenJc, einkommenJc),
    proKategorie: alsSummen(proKategorie, new Map(d.kategorien.map((k) => [k.id, k.name]))),
    proLebensbereich: alsSummen(proLebensbereich, new Map(d.lebensbereiche.map((l) => [l.id, l.name]))),
    proKonto: alsSummen(proKonto, new Map(d.konten.map((k) => [k.id, k.name]))),
    hinweise,
  };
}

export type Ampel = 'gruen' | 'gelb' | 'rot' | 'unbekannt';

export function ampel(quote: number | null, gelbAb = 40, rotAb = 50): Ampel {
  if (quote === null) return 'unbekannt';
  if (quote > rotAb) return 'rot';
  if (quote >= gelbAb) return 'gelb';
  return 'gruen';
}
