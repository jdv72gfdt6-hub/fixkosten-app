import type { Cent, Rhythmus } from './typen';

/** Echtes Minuszeichen (U+2212), damit negative Beträge nicht nur über Farbe erkennbar sind. */
export const MINUS = '−';
const NBSP = ' ';

/**
 * Kaufmännisch runden (halbe Cent vom Nullpunkt weg).
 * Math.round würde -0,5 zu 0 runden statt zu -1.
 */
export function rundeKaufmaennisch(wert: number): number {
  const r = Math.sign(wert) * Math.round(Math.abs(wert) + Number.EPSILON * Math.abs(wert));
  return r === 0 ? 0 : r; // -0 vermeiden
}

/**
 * Deutsche Betragseingabe in Cent umwandeln.
 * Akzeptiert: "1.234,56", "1234,56", "1234,5", "12", "-5,00", "12,-", "1.234", "12.50" (Punkt als Dezimal,
 * wenn er nicht wie ein Tausenderpunkt aussieht), mit oder ohne "€".
 * Gibt null zurück, wenn die Eingabe kein gültiger Betrag ist.
 */
export function parseBetrag(eingabe: string): Cent | null {
  let s = eingabe.trim().replace(/€|EUR/gi, '').replace(/[\s  ]/g, '');
  if (s === '') return null;
  let negativ = false;
  if (/^[-−]/.test(s)) {
    negativ = true;
    s = s.slice(1);
  } else if (s.endsWith('-') && !s.endsWith(',-')) {
    negativ = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/,-$/, ',00');

  let euro: string;
  let cent = '';
  if (s.includes(',')) {
    const teile = s.split(',');
    if (teile.length !== 2) return null;
    euro = teile[0]!;
    cent = teile[1]!;
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(euro || '0')) return null;
    euro = euro.replace(/\./g, '');
  } else if (s.includes('.')) {
    // Nur Punkte: Tausenderpunkte ("1.234" / "1.234.567") oder Dezimalpunkt ("12.5", "12.50").
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      euro = s.replace(/\./g, '');
    } else if (/^\d+\.\d{1,2}$/.test(s)) {
      [euro, cent] = s.split('.') as [string, string];
    } else {
      return null;
    }
  } else {
    euro = s;
  }
  if (euro === '') euro = '0';
  if (!/^\d+$/.test(euro) || !/^\d{0,2}$/.test(cent)) return null;
  const betrag = Number(euro) * 100 + Number(cent.padEnd(2, '0'));
  if (!Number.isSafeInteger(betrag)) return null;
  return negativ ? -betrag : betrag;
}

function tausender(ganz: string): string {
  return ganz.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface FormatOptionen {
  /** "+" bei positiven Werten anzeigen (z. B. für Über-/Unterdeckung). */
  vorzeichen?: boolean;
  /** Ohne Cent, wenn der Betrag glatt ist ("400 €" statt "400,00 €"). */
  kurz?: boolean;
  /** Ohne Euro-Zeichen. */
  ohneWaehrung?: boolean;
}

/** Cent als deutschen Betrag formatieren: 123456 → "1.234,56 €", -500 → "−5,00 €". */
export function formatEuro(cent: Cent, opt: FormatOptionen = {}): string {
  const negativ = cent < 0;
  const abs = Math.abs(Math.trunc(cent));
  const ganz = tausender(String(Math.floor(abs / 100)));
  const rest = String(abs % 100).padStart(2, '0');
  const zahl = opt.kurz && rest === '00' ? ganz : `${ganz},${rest}`;
  const zeichen = negativ ? MINUS : opt.vorzeichen && cent > 0 ? '+' : '';
  return `${zeichen}${zahl}${opt.ohneWaehrung ? '' : `${NBSP}€`}`;
}

/** Betrag für Eingabefelder (ohne Tausenderpunkte, ohne €): 123456 → "1234,56". */
export function betragFuerEingabe(cent: Cent): string {
  const negativ = cent < 0;
  const abs = Math.abs(cent);
  return `${negativ ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/** Text für Screenreader: "1.234 Euro 56 Cent", "minus 5 Euro". */
export function euroSprechtext(cent: Cent): string {
  const abs = Math.abs(cent);
  const e = Math.floor(abs / 100);
  const c = abs % 100;
  return `${cent < 0 ? 'minus ' : ''}${tausender(String(e))} Euro${c ? ` ${c} Cent` : ''}`;
}

/** Wie oft pro Jahr ein Rhythmus fällig ist. */
export const ZAHLUNGEN_PRO_JAHR: Record<Rhythmus, number> = {
  woechentlich: 52,
  monatlich: 12,
  zweimonatlich: 6,
  vierteljaehrlich: 4,
  halbjaehrlich: 2,
  jaehrlich: 1,
};

/** Abstand in Monaten für monatsbasierte Rhythmen. */
export const MONATSABSTAND: Record<Exclude<Rhythmus, 'woechentlich'>, number> = {
  monatlich: 1,
  zweimonatlich: 2,
  vierteljaehrlich: 3,
  halbjaehrlich: 6,
  jaehrlich: 12,
};

/**
 * "Jahres-Cent": Betrag × Zahlungen pro Jahr. Ganzzahlig und damit verlustfrei summierbar.
 * Wöchentlich → monatlich = × 52 / 12 entsteht erst beim Teilen durch 12 am Ende.
 */
export function jahresCent(betrag: Cent, rhythmus: Rhythmus): number {
  return betrag * ZAHLUNGEN_PRO_JAHR[rhythmus];
}

/** Jahres-Cent in gerundete Monats-Cent umrechnen (erst hier wird gerundet). */
export function monatAusJahresCent(jc: number): Cent {
  return rundeKaufmaennisch(jc / 12);
}

/** Monatlicher Durchschnitt eines Betrags in einem Rhythmus (gerundet). */
export function monatlich(betrag: Cent, rhythmus: Rhythmus): Cent {
  return monatAusJahresCent(jahresCent(betrag, rhythmus));
}

/** Anteil in Prozent auf einen Betrag anwenden, ohne zwischendurch zu runden (liefert Jahres-Cent). */
export function anteilJahresCent(jc: number, prozent: number): number {
  return (jc * prozent) / 100;
}

/** Prozent (z. B. 51.94) oder null, wenn die Basis 0 ist – keine Division durch null. */
export function prozent(teil: number, ganz: number): number | null {
  if (!ganz) return null;
  return (teil / ganz) * 100;
}

/** Prozentzahl deutsch formatieren: 51.937 → "51,9 %". */
export function formatProzent(p: number | null, stellen = 1): string {
  if (p === null || !Number.isFinite(p)) return '–';
  const f = 10 ** stellen;
  const r = rundeKaufmaennisch(p * f) / f;
  const [g, n = ''] = Math.abs(r).toFixed(stellen).split('.');
  return `${r < 0 ? MINUS : ''}${tausender(g!)}${stellen ? `,${n}` : ''}${NBSP}%`;
}
