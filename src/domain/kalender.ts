import { baueTag, letzterDesMonats, plusTage, teile, wochentag } from './datum';
import type { Tag, Verschiebung } from './typen';

/*
 * Bankarbeitstage nach dem TARGET2-Kalender, der für SEPA-Zahlungen gilt.
 * Geschlossen: Wochenende, Neujahr, Karfreitag, Ostermontag, 1. Mai, 25. und 26. Dezember.
 * Zusätzlich behandeln wir den 24.12. und 31.12. als Nicht-Bankarbeitstage (deutsche Bankpraxis).
 * Regionale Feiertage verschieben SEPA-Buchungen nicht und sind deshalb bewusst nicht enthalten.
 */

/** Ostersonntag nach der anonymen gregorianischen Osterformel (Meeus/Jones/Butcher). */
export function ostersonntag(jahr: number): Tag {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return baueTag(jahr, monat, tag);
}

const cache = new Map<number, Set<Tag>>();

/** Alle Nicht-Bankarbeitstage eines Jahres außer Wochenenden. */
export function bankfeiertage(jahr: number): Set<Tag> {
  let s = cache.get(jahr);
  if (!s) {
    const ostern = ostersonntag(jahr);
    s = new Set([
      baueTag(jahr, 1, 1),
      plusTage(ostern, -2), // Karfreitag
      plusTage(ostern, 1), // Ostermontag
      baueTag(jahr, 5, 1),
      baueTag(jahr, 12, 24),
      baueTag(jahr, 12, 25),
      baueTag(jahr, 12, 26),
      baueTag(jahr, 12, 31),
    ]);
    cache.set(jahr, s);
  }
  return s;
}

export function istBankarbeitstag(tag: Tag): boolean {
  const wt = wochentag(tag);
  if (wt === 0 || wt === 6) return false;
  return !bankfeiertage(teile(tag).jahr).has(tag);
}

export function naechsterBankarbeitstag(tag: Tag): Tag {
  let t = tag;
  while (!istBankarbeitstag(t)) t = plusTage(t, 1);
  return t;
}

export function vorherigerBankarbeitstag(tag: Tag): Tag {
  let t = tag;
  while (!istBankarbeitstag(t)) t = plusTage(t, -1);
  return t;
}

/** Termin auf einen Bankarbeitstag verschieben (falls nötig). */
export function aufBankarbeitstag(tag: Tag, regel: Verschiebung): Tag {
  return regel === 'vorher' ? vorherigerBankarbeitstag(tag) : naechsterBankarbeitstag(tag);
}

export function letzterBankarbeitstag(jahr: number, monat: number): Tag {
  return vorherigerBankarbeitstag(letzterDesMonats(jahr, monat));
}
