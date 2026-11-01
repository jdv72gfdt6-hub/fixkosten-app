import { MONATSABSTAND } from './geld';
import { monatPlus, plusTage, tagImMonatBegrenzt, tageZwischen, teile } from './datum';
import { aufBankarbeitstag, letzterBankarbeitstag } from './kalender';
import type { Tag, Zeitplan } from './typen';

export interface Termin {
  /** Vertraglicher Termin (vor Verschiebung auf einen Bankarbeitstag). */
  soll: Tag;
  /** Tatsächlicher Buchungstag. */
  ist: Tag;
  /** true, wenn der Tag fehlt und angenommen wurde (Prognose rechnet vorsichtshalber früh). */
  angenommen: boolean;
}

export type ZeitplanProblem = 'anker-fehlt' | 'tag-fehlt';

/** Tag, der angenommen wird, wenn er fehlt: der 1. – vorsichtig, weil früh im Monat. */
export const ANNAHME_TAG = 1;

/** Wirksamer Tag und Ankermonat: Ankerdatum ergänzt fehlende Angaben. */
function wirksam(z: Zeitplan): { tag: Zeitplan['tag']; ankerMonat: number | null } {
  const anker = z.ankerDatum ? teile(z.ankerDatum) : null;
  return {
    tag: z.tag ?? anker?.tag ?? null,
    ankerMonat: anker?.monat ?? z.ankerMonat ?? null,
  };
}

/** Prüft, ob ein Zeitplan vollständig ist. null = alles da. */
export function zeitplanProblem(z: Zeitplan): ZeitplanProblem | null {
  if (z.rhythmus === 'woechentlich') return z.ankerDatum ? null : 'anker-fehlt';
  const w = wirksam(z);
  if (z.rhythmus !== 'monatlich' && w.ankerMonat === null) return 'anker-fehlt';
  if (w.tag === null) return 'tag-fehlt';
  return null;
}

/** Monate, in denen ein Zeitplan fällig ist (1–12), z. B. [3, 6, 9, 12]. Leer, wenn Anker fehlt. */
export function faelligkeitsmonate(z: Zeitplan): number[] {
  if (z.rhythmus === 'woechentlich') return [];
  const abstand = MONATSABSTAND[z.rhythmus];
  if (abstand === 1) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const { ankerMonat } = wirksam(z);
  if (ankerMonat === null) return [];
  const monate: number[] = [];
  for (let m = 1; m <= 12; m++) if ((((m - ankerMonat) % abstand) + abstand) % abstand === 0) monate.push(m);
  return monate;
}

/**
 * Alle Buchungstermine eines Zeitplans im Zeitraum [von, bis] (inklusive).
 * Ohne Ankerdatum bzw. Ankermonat bei nicht-monatlichen Rhythmen gibt es keine Termine.
 */
export function termine(z: Zeitplan, von: Tag, bis: Tag): Termin[] {
  if (von > bis) return [];
  const ergebnis: Termin[] = [];

  if (z.rhythmus === 'woechentlich') {
    if (!z.ankerDatum) return [];
    const k = Math.ceil(tageZwischen(z.ankerDatum, plusTage(von, -7)) / 7);
    for (let i = k; ; i++) {
      const soll = plusTage(z.ankerDatum, i * 7);
      const ist = aufBankarbeitstag(soll, z.verschiebung);
      if (soll > bis && ist > bis) break;
      if (ist >= von && ist <= bis) ergebnis.push({ soll, ist, angenommen: false });
    }
    return ergebnis;
  }

  const abstand = MONATSABSTAND[z.rhythmus];
  const w = wirksam(z);
  if (abstand > 1 && w.ankerMonat === null) return [];

  const start = teile(von);
  const ende = teile(bis);
  // Einen Monat Rand, weil die Verschiebung über Monatsgrenzen gehen kann.
  const anzahl = (ende.jahr - start.jahr) * 12 + (ende.monat - start.monat) + 2;
  for (let i = -1; i <= anzahl; i++) {
    const { jahr, monat } = monatPlus(start.jahr, start.monat, i);
    if (abstand > 1 && ((((monat - w.ankerMonat!) % abstand) + abstand) % abstand) !== 0) continue;
    let soll: Tag;
    let ist: Tag;
    if (w.tag === 'letzter-bankarbeitstag') {
      soll = ist = letzterBankarbeitstag(jahr, monat);
    } else {
      soll = tagImMonatBegrenzt(jahr, monat, w.tag ?? ANNAHME_TAG);
      ist = aufBankarbeitstag(soll, z.verschiebung);
    }
    if (ist >= von && ist <= bis) ergebnis.push({ soll, ist, angenommen: w.tag === null });
  }
  return ergebnis;
}

/** Nächster Termin ab einem Tag (inklusive), sucht maximal 2 Jahre voraus. */
export function naechsterTermin(z: Zeitplan, ab: Tag): Termin | null {
  return termine(z, ab, plusTage(ab, 731))[0] ?? null;
}
