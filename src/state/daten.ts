/* Reaktiver Zugriff auf die Datenbank und alle abgeleiteten Berechnungen. */
import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useMemo } from 'react';
import { ladeDaten, ladeEinstellungen, speichereEinstellungen } from '../db/db';
import { deckung, monatsuebersicht } from '../domain/bilanz';
import { heute as heuteEcht, istTag } from '../domain/datum';
import { prognose } from '../domain/prognose';
import { anstehend } from '../domain/termine';
import { baldKuendbar, preisaenderungen } from '../domain/vertraege';
import { plusMonate } from '../domain/datum';
import { luecken } from '../domain/vollstaendigkeit';
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

/** Alle Berechnungen, einmal pro Datenstand. */
export function useBerechnung() {
  const { daten, roh, einstellungen } = useDaten();
  return useMemo(() => {
    const h = heute();
    return {
      heute: h,
      uebersicht: monatsuebersicht(roh, h),
      deckung: deckung(roh, h),
      prognose: prognose(roh, h, einstellungen.prognoseMonate),
      anstehend: anstehend(roh, h, 60),
      baldKuendbar: baldKuendbar(roh, h, 90),
      preisaenderungen: preisaenderungen(roh, plusMonate(h, -12)),
      luecken: luecken(roh, h),
      daten,
    };
  }, [daten, roh, einstellungen.prognoseMonate]);
}
