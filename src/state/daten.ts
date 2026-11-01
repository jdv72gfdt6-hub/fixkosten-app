/* Reaktiver Zugriff auf die Datenbank und alle abgeleiteten Berechnungen. */
import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useMemo } from 'react';
import { ladeDaten, ladeEinstellungen, speichereEinstellungen } from '../db/db';
import { monatsuebersicht } from '../domain/bilanz';
import { heute as heuteEcht, istTag } from '../domain/datum';
import type { Daten, Einstellungen } from '../domain/typen';

/** "Heute" – für Screenshots und Tests per ?heute=YYYY-MM-DD festlegbar. */
export function heute(): string {
  const p = new URLSearchParams(location.search).get('heute');
  return p && istTag(p) ? p : heuteEcht();
}

export function useDatenRoh(): { daten: Daten; einstellungen: Einstellungen } | undefined {
  return useLiveQuery(async () => {
    const [daten, einstellungen] = await Promise.all([ladeDaten(), ladeEinstellungen()]);
    return { daten, einstellungen };
  });
}

export interface DatenKontextWert {
  /** Alle Daten inkl. Papierkorb. */
  roh: Daten;
  /** Ohne Papierkorb. */
  daten: Daten;
  einstellungen: Einstellungen;
}

export const DatenKontext = createContext<DatenKontextWert | null>(null);

export function useDaten(): DatenKontextWert {
  const k = useContext(DatenKontext);
  if (!k) throw new Error('Daten noch nicht geladen');
  return k;
}

export function useDatenOptional(): DatenKontextWert | null {
  return useContext(DatenKontext);
}

export async function aendereEinstellungen(teil: Partial<Einstellungen>): Promise<void> {
  const alt = await ladeEinstellungen();
  await speichereEinstellungen({ ...alt, ...teil });
}

/** Berechnungen für die Fixkosten-Seite, einmal pro Datenstand. */
export function useBerechnung() {
  const { daten, roh } = useDaten();
  return useMemo(() => {
    const h = heute();
    return { heute: h, uebersicht: monatsuebersicht(roh, h), daten };
  }, [daten, roh]);
}
