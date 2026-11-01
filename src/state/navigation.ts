/* Einfache Stapel-Navigation pro Tab (wie UINavigationController) und offene Sheets. */
import { create } from 'zustand';

export type TabId = 'uebersicht' | 'konten' | 'kalender' | 'vertraege' | 'einstellungen';

export type Route =
  | { typ: 'konto'; id: string }
  | { typ: 'kategorie'; id: string }
  | { typ: 'lebensbereiche' }
  | { typ: 'papierkorb' }
  | { typ: 'luecken' }
  | { typ: 'kategorien-verwalten' };

export type Sheet =
  | { typ: 'neu' }
  | { typ: 'fixkosten'; id?: string; vorlageKontoId?: string }
  | { typ: 'konto'; id?: string }
  | { typ: 'kontostand'; kontoId: string }
  | { typ: 'einkommen'; id?: string }
  | { typ: 'umbuchung'; id?: string }
  | { typ: 'sparplan'; id?: string }
  | { typ: 'budget'; id?: string }
  | { typ: 'ruecklage'; id?: string }
  | { typ: 'einmalig'; id?: string }
  | { typ: 'suche' }
  | { typ: 'import' };

interface NavStore {
  tab: TabId;
  stapel: Record<TabId, Route[]>;
  sheets: Sheet[];
  wechsleTab: (t: TabId) => void;
  oeffne: (r: Route) => void;
  zurueck: () => void;
  zeigeSheet: (s: Sheet) => void;
  schliesseSheet: () => void;
}

const leer: Record<TabId, Route[]> = { uebersicht: [], konten: [], kalender: [], vertraege: [], einstellungen: [] };

export const useNav = create<NavStore>((set) => ({
  tab: 'uebersicht',
  stapel: leer,
  sheets: [],
  wechsleTab: (tab) =>
    set((s) => (s.tab === tab ? { stapel: { ...s.stapel, [tab]: [] } } : { tab })),
  oeffne: (r) => set((s) => ({ stapel: { ...s.stapel, [s.tab]: [...s.stapel[s.tab], r] } })),
  zurueck: () => set((s) => ({ stapel: { ...s.stapel, [s.tab]: s.stapel[s.tab].slice(0, -1) } })),
  zeigeSheet: (sheet) => set((s) => ({ sheets: [...s.sheets, sheet] })),
  schliesseSheet: () => set((s) => ({ sheets: s.sheets.slice(0, -1) })),
}));

export interface Ansichten {
  konten: 'konten' | 'geldfluss';
  kalender: 'kalender' | 'abschluss';
  vertraege: 'alle' | 'kuendbar' | 'preise';
}

/** Gewählte Unteransicht (Segment-Steuerung) je Tab. */
export const useAnsicht = create<Ansichten & { setze: (t: Partial<Ansichten>) => void }>((set) => ({
  konten: 'konten',
  kalender: 'kalender',
  vertraege: 'alle',
  setze: (t) => set(t),
}));

/** Von überall aus zu einer Seite in einem anderen Tab springen. */
export function geheZu(tab: TabId, route?: Route) {
  useNav.setState((s) => ({ tab, stapel: { ...s.stapel, [tab]: route ? [route] : [] } }));
}
