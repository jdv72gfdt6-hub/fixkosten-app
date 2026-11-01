/* Unvollständige Daten erkennen – sie erzeugen keine Abstürze, sondern Hinweise in der App. */
import { zeitplanProblem } from './faelligkeiten';
import { letzterKontostand, ohnePapierkorb } from './posten';
import { STAND_VERALTET_TAGE } from './prognose';
import { tageZwischen } from './datum';
import type { Daten, Tag, Zeitplan } from './typen';

export type LueckenArt = 'tag-fehlt' | 'anker-fehlt' | 'stand-fehlt' | 'stand-veraltet' | 'vertrag-fehlt' | 'laufzeit-fehlt';

export interface Luecke {
  art: LueckenArt;
  bereich: 'konto' | 'einkommen' | 'umbuchung' | 'fixkosten' | 'sparplan';
  refId: string;
  name: string;
  text: string;
}

export const LUECKEN_TEXT: Record<LueckenArt, string> = {
  'tag-fehlt': 'Tag fehlt',
  'anker-fehlt': 'Fälligkeitsmonat fehlt',
  'stand-fehlt': 'Kontostand fehlt',
  'stand-veraltet': 'Kontostand veraltet',
  'vertrag-fehlt': 'Vertragsdaten unvollständig',
  'laufzeit-fehlt': 'Laufzeitende fehlt',
};

function zeitplanLuecke(z: Zeitplan): LueckenArt | null {
  return zeitplanProblem(z);
}

export function luecken(daten: Daten, heute: Tag): Luecke[] {
  const d = ohnePapierkorb(daten);
  const l: Luecke[] = [];
  for (const k of d.konten) {
    const s = letzterKontostand(d, k.id);
    if (!s) l.push({ art: 'stand-fehlt', bereich: 'konto', refId: k.id, name: k.name, text: LUECKEN_TEXT['stand-fehlt'] });
    else if (tageZwischen(s.datum, heute) > STAND_VERALTET_TAGE) {
      l.push({ art: 'stand-veraltet', bereich: 'konto', refId: k.id, name: k.name, text: `Stand vom ${s.datum.split('-').reverse().join('.')}` });
    }
  }
  const mitZeitplan = [
    ...d.einkommen.map((x) => ({ bereich: 'einkommen' as const, x, name: x.name })),
    ...d.umbuchungen.map((x) => ({ bereich: 'umbuchung' as const, x, name: x.name || 'Umbuchung' })),
    ...d.fixkosten.filter((f) => f.status !== 'gekuendigt').map((x) => ({ bereich: 'fixkosten' as const, x, name: x.name })),
    ...d.sparplaene.map((x) => ({ bereich: 'sparplan' as const, x, name: x.name })),
  ];
  for (const { bereich, x, name } of mitZeitplan) {
    const art = zeitplanLuecke(x.zeitplan);
    if (art) l.push({ art, bereich, refId: x.id, name, text: LUECKEN_TEXT[art] });
  }
  for (const f of d.fixkosten) {
    if (f.status === 'gekuendigt') continue;
    if (f.finanzierung && !f.finanzierung.letzteRate) {
      l.push({ art: 'laufzeit-fehlt', bereich: 'fixkosten', refId: f.id, name: f.name, text: LUECKEN_TEXT['laufzeit-fehlt'] });
    }
  }
  return l;
}

/** Lücken eines einzelnen Eintrags (für Badges in Listen). */
export function lueckenVon(alle: Luecke[], refId: string): Luecke[] {
  return alle.filter((l) => l.refId === refId);
}

/** Vertragsdaten-Lücken werden separat gezählt, weil sie fast alle Posten betreffen. */
export function vertragUnvollstaendig(daten: Daten): number {
  return ohnePapierkorb(daten).fixkosten.filter(
    (f) => f.status === 'aktiv' && (!f.vertrag?.beginn || f.vertrag.mindestlaufzeitMonate == null || !f.vertrag.kuendigungsfrist),
  ).length;
}
