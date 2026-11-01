import type { Betragsstand, Cent, Daten, Einkommen, Fixkosten, Tag } from './typen';

/** Betrag, der an einem Tag gilt: der letzte Stand mit gueltigAb <= tag, sonst der früheste. */
export function betragAm(verlauf: Betragsstand[], tag: Tag): Cent {
  if (verlauf.length === 0) return 0;
  const sortiert = [...verlauf].sort((a, b) => (a.gueltigAb < b.gueltigAb ? -1 : 1));
  let aktuell = sortiert[0]!;
  for (const s of sortiert) if (s.gueltigAb <= tag) aktuell = s;
  return aktuell.betrag;
}

/** Aktueller (neuester) Betrag eines Verlaufs. */
export function aktuellerBetrag(verlauf: Betragsstand[]): Cent {
  if (verlauf.length === 0) return 0;
  return [...verlauf].sort((a, b) => (a.gueltigAb < b.gueltigAb ? -1 : 1)).at(-1)!.betrag;
}

/** Letzter Tag, an dem ein Fixkosten-Posten noch abgebucht wird (oder null = unbegrenzt). */
export function letzterAbbuchungstag(f: Fixkosten): Tag | null {
  const grenzen: Tag[] = [];
  if (f.status === 'gekuendigt' && f.endeAm) grenzen.push(f.endeAm);
  if (f.finanzierung?.letzteRate) grenzen.push(f.finanzierung.letzteRate);
  if (grenzen.length === 0) return null;
  return grenzen.sort()[0]!;
}

/**
 * Wird ein Posten an diesem Tag noch abgebucht?
 * Pausierte Posten nie; gekündigte nur bis zum Enddatum; Kredite nur bis zur letzten Rate.
 */
export function fixkostenAktivAm(f: Fixkosten, tag: Tag): boolean {
  if (f.geloeschtAm) return false;
  if (f.status === 'pausiert') return false;
  if (f.status === 'gekuendigt' && !f.endeAm) return false;
  const ende = letzterAbbuchungstag(f);
  return ende === null || tag <= ende;
}

export function einkommenBetragAm(e: Einkommen, tag: Tag): Cent {
  return betragAm(e.historie, tag);
}

/** Nur nicht gelöschte Einträge. */
export function sichtbar<T extends { geloeschtAm?: Tag }>(liste: T[]): T[] {
  return liste.filter((x) => !x.geloeschtAm);
}

/** Kopie der Daten ohne gelöschte Einträge (Papierkorb). */
export function ohnePapierkorb(d: Daten): Daten {
  return {
    ...d,
    konten: sichtbar(d.konten).sort((a, b) => a.reihenfolge - b.reihenfolge),
    einkommen: sichtbar(d.einkommen),
    einmalig: sichtbar(d.einmalig),
    umbuchungen: sichtbar(d.umbuchungen),
    fixkosten: sichtbar(d.fixkosten),
    sparplaene: sichtbar(d.sparplaene),
    ruecklagen: sichtbar(d.ruecklagen),
    budgets: sichtbar(d.budgets),
  };
}

/** Aktuellster Kontostand eines Kontos. */
export function letzterKontostand(d: Daten, kontoId: string) {
  let best: Daten['kontostaende'][number] | undefined;
  for (const k of d.kontostaende) {
    if (k.kontoId !== kontoId) continue;
    if (!best || k.datum > best.datum || (k.datum === best.datum && (k.erfasst ?? 0) >= (best.erfasst ?? 0))) best = k;
  }
  return best ?? null;
}
