import type { ReactNode } from 'react';
import type { Ampel, KontoDeckung } from '../domain/bilanz';
import { formatTag, formatTagKurz } from '../domain/datum';
import { RHYTHMUS_NAMEN } from '../domain/standard';
import type { Daten, Fixkosten, Kategorie, Konto, Zeitplan } from '../domain/typen';
import { faelligkeitsmonate } from '../domain/faelligkeiten';
import { monatsname } from '../domain/datum';
import { Betrag } from './Betrag';

export function kontoVon(d: Daten, id: string | undefined): Konto | undefined {
  return d.konten.find((k) => k.id === id);
}

export function kategorieVon(d: Daten, id: string): Kategorie | undefined {
  return d.kategorien.find((k) => k.id === id);
}

export const KONTO_TYP_NAMEN: Record<Konto['typ'], string> = {
  giro: 'Girokonto',
  tagesgeld: 'Tagesgeld / Sparkonto',
  bauspar: 'Bausparvertrag',
  depot: 'Depot',
  versicherung: 'Fondsgebundene Versicherung',
  kreditkarte: 'Kreditkarte',
  bargeld: 'Bargeld',
  sonstiges: 'PayPal / Sonstiges',
};

export const KONTO_ROLLE_NAMEN: Record<Konto['rolle'], string> = {
  einkommen: 'Einkommen',
  fixkosten: 'Fixkosten',
  variabel: 'Variable Ausgaben',
  ruecklage: 'Rücklage',
  vermoegen: 'Vermögensaufbau',
};

/** Kurzbeschreibung eines Zeitplans: "Monatlich am 15.", "Vierteljährlich am 15. (Mär, Jun, Sep, Dez)". */
export function zeitplanText(z: Zeitplan): string {
  const r = RHYTHMUS_NAMEN[z.rhythmus];
  if (z.rhythmus === 'woechentlich') return z.ankerDatum ? `${r} ab ${formatTag(z.ankerDatum)}` : r;
  const tag = z.tag ?? (z.ankerDatum ? Number(z.ankerDatum.slice(8, 10)) : null);
  const tagText = tag === 'letzter-bankarbeitstag' ? 'am letzten Bankarbeitstag' : tag ? `am ${tag}.` : '';
  const monate = z.rhythmus !== 'monatlich' ? faelligkeitsmonate(z).map((m) => monatsname(m, true)).join(', ') : '';
  return [r, tagText, monate && `(${monate})`].filter(Boolean).join(' ');
}

export function ampelText(a: Ampel): string {
  return a === 'gruen' ? 'im grünen Bereich' : a === 'gelb' ? 'erhöht' : a === 'rot' ? 'zu hoch' : 'unbekannt';
}

export function ampelKlasse(a: Ampel): 'gruen' | 'gelb' | 'rot' | 'grau' {
  return a === 'unbekannt' ? 'grau' : a;
}

/** Abzeichen für den Deckungsstatus eines Kontos. */
export function DeckungAbzeichen({ d }: { d: KontoDeckung }): ReactNode {
  if (d.zufluesse.length === 0 && d.abfluesse.length === 0) return null;
  if (d.saldoMonat === 0) return <span className="abzeichen gruen">genau gedeckt</span>;
  if (d.saldoMonat > 0) {
    return (
      <span className="abzeichen gruen">
        <Betrag wert={d.saldoMonat} vorzeichen /> / Monat
      </span>
    );
  }
  return (
    <span className="abzeichen rot">
      Unterdeckung <Betrag wert={d.saldoMonat} /> / Monat
    </span>
  );
}

export function tagKurz(t: string): string {
  return formatTagKurz(t);
}

export function istNichtMonatlich(f: Fixkosten): boolean {
  return f.zeitplan.rhythmus !== 'monatlich' && f.zeitplan.rhythmus !== 'woechentlich';
}

/** Datei im Browser herunterladen (Backup, Kalender, CSV). */
export function speichereDatei(name: string, inhalt: string, typ: string) {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
