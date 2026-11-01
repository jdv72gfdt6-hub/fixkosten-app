/*
 * Schreibende Aktionen mit "Rückgängig".
 * Jede Änderung merkt sich den vorherigen Zustand des Eintrags; Löschen verschiebt in den Papierkorb.
 */
import type { Table } from 'dexie';
import { create } from 'zustand';
import { heute } from '../domain/datum';
import type { Daten } from '../domain/typen';
import { db } from './db';

export type Tabelle = keyof Daten;

interface Rueckgaengig {
  text: string;
  schritte: { tabelle: Tabelle; id: string; alt: unknown | null }[];
  zeit: number;
}

interface RueckgaengigStore {
  letzter: Rueckgaengig | null;
  setze: (r: Rueckgaengig | null) => void;
}

export const useRueckgaengig = create<RueckgaengigStore>((set) => ({
  letzter: null,
  setze: (letzter) => set({ letzter }),
}));

function tab(t: Tabelle) {
  return db.table(t) as Table<{ id: string; geloeschtAm?: string }, string>;
}

/** Mehrere Einträge in einer Transaktion speichern; ein "Rückgängig" für alles. */
export async function speichereMehrere(eintraege: { tabelle: Tabelle; wert: { id: string } }[], text: string): Promise<void> {
  if (eintraege.length === 0) return;
  const schritte: Rueckgaengig['schritte'] = [];
  await db.transaction('rw', [...new Set(eintraege.map((e) => tab(e.tabelle)))], async () => {
    for (const e of eintraege) {
      const alt = (await tab(e.tabelle).get(e.wert.id)) ?? null;
      schritte.push({ tabelle: e.tabelle, id: e.wert.id, alt });
      await tab(e.tabelle).put(e.wert as { id: string });
    }
  });
  useRueckgaengig.getState().setze({ text, schritte, zeit: Date.now() });
}

export function speichere<T extends { id: string }>(tabelle: Tabelle, wert: T, text = 'Gespeichert'): Promise<void> {
  return speichereMehrere([{ tabelle, wert }], text);
}

/** In den Papierkorb verschieben (30 Tage wiederherstellbar). */
export async function inPapierkorb(tabelle: Tabelle, id: string, text = 'Gelöscht'): Promise<void> {
  const alt = await tab(tabelle).get(id);
  if (!alt) return;
  await speichere(tabelle, { ...alt, geloeschtAm: heute() }, text);
}

export async function wiederherstellen(tabelle: Tabelle, id: string): Promise<void> {
  const alt = await tab(tabelle).get(id);
  if (!alt) return;
  const { geloeschtAm: _entfernt, ...rest } = alt;
  await speichere(tabelle, rest as { id: string }, 'Wiederhergestellt');
}

export async function endgueltigLoeschen(tabelle: Tabelle, id: string): Promise<void> {
  await tab(tabelle).delete(id);
}

export async function rueckgaengig(): Promise<void> {
  const r = useRueckgaengig.getState().letzter;
  if (!r) return;
  await db.transaction('rw', [...new Set(r.schritte.map((s) => tab(s.tabelle)))], async () => {
    for (const s of [...r.schritte].reverse()) {
      if (s.alt === null) await tab(s.tabelle).delete(s.id);
      else await tab(s.tabelle).put(s.alt as { id: string });
    }
  });
  useRueckgaengig.getState().setze(null);
}
