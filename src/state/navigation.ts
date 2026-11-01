/* Einfache Stapel-Navigation pro Tab (wie UINavigationController) und offene Sheets. */
import { create } from 'zustand';

export type TabId = 'fixkosten' | 'konto' | 'sparen';

export type Route = { typ: 'einstellungen' } | { typ: 'papierkorb' } | { typ: 'kategorien-verwalten' };

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
  | { typ: 'topf'; kontoId: string; schluessel: string }
  | { typ: 'abbuchungstag'; id: string }
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

const leer: Record<TabId, Route[]> = { fixkosten: [], konto: [], sparen: [] };

export const useNav = create<NavStore>((set) => ({
  tab: 'fixkosten',
  stapel: leer,
  sheets: [],
  wechsleTab: (tab) =>
    set((s) => (s.tab === tab ? { stapel: { ...s.stapel, [tab]: [] } } : { tab })),
  oeffne: (r) => set((s) => ({ stapel: { ...s.stapel, [s.tab]: [...s.stapel[s.tab], r] } })),
  zurueck: () => set((s) => ({ stapel: { ...s.stapel, [s.tab]: s.stapel[s.tab].slice(0, -1) } })),
  zeigeSheet: (sheet) => set((s) => ({ sheets: [...s.sheets, sheet] })),
  schliesseSheet: () => set((s) => ({ sheets: s.sheets.slice(0, -1) })),
}));
