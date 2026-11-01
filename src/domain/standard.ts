/* Standard-Kategorien, Lebensbereiche, Vorlagen und Hilfen zum Anlegen neuer Einträge. */
import type { Einstellungen, Fixkosten, Kategorie, Lebensbereich, Rhythmus, Zeitplan } from './typen';

export const STANDARD_KATEGORIEN: Kategorie[] = [
  { id: 'kat-wohnen', name: 'Wohnen', farbe: 'orange', symbol: 'house', reihenfolge: 1 },
  { id: 'kat-energie', name: 'Energie', farbe: 'yellow', symbol: 'zap', reihenfolge: 2 },
  { id: 'kat-versicherungen', name: 'Versicherungen', farbe: 'blue', symbol: 'shield', reihenfolge: 3 },
  { id: 'kat-mobilitaet', name: 'Mobilität', farbe: 'indigo', symbol: 'car', reihenfolge: 4 },
  { id: 'kat-kommunikation', name: 'Kommunikation', farbe: 'teal', symbol: 'smartphone', reihenfolge: 5 },
  { id: 'kat-abos', name: 'Abos & Streaming', farbe: 'pink', symbol: 'play', reihenfolge: 6 },
  { id: 'kat-kredite', name: 'Kredite & Finanzierung', farbe: 'red', symbol: 'landmark', reihenfolge: 7 },
  { id: 'kat-gesundheit', name: 'Gesundheit & Fitness', farbe: 'green', symbol: 'heart-pulse', reihenfolge: 8 },
  { id: 'kat-sparen', name: 'Sparen & Investieren', farbe: 'mint', symbol: 'piggy-bank', reihenfolge: 9 },
  { id: 'kat-sonstiges', name: 'Sonstiges', farbe: 'gray', symbol: 'circle-ellipsis', reihenfolge: 10 },
];

export const STANDARD_LEBENSBEREICHE: Lebensbereich[] = [
  { id: 'lb-wohnen', name: 'Wohnen', farbe: 'orange', reihenfolge: 1 },
  { id: 'lb-auto', name: 'Auto', farbe: 'indigo', reihenfolge: 2 },
  { id: 'lb-absicherung', name: 'Absicherung', farbe: 'blue', reihenfolge: 3 },
  { id: 'lb-kommunikation', name: 'Kommunikation', farbe: 'teal', reihenfolge: 4 },
  { id: 'lb-abos', name: 'Abos', farbe: 'pink', reihenfolge: 5 },
  { id: 'lb-gesundheit', name: 'Gesundheit & Fitness', farbe: 'green', reihenfolge: 6 },
  { id: 'lb-sonstiges', name: 'Sonstiges', farbe: 'gray', reihenfolge: 7 },
];

export const STANDARD_EINSTELLUNGEN: Einstellungen = {
  ampelGelb: 40,
  ampelRot: 50,
  prognoseMonate: 12,
  design: 'auto',
  betraegeAusblenden: false,
  letztesBackup: null,
  onboardingFertig: false,
};

export function zeitplan(rhythmus: Rhythmus = 'monatlich', tag: Zeitplan['tag'] = 1, ankerMonat: number | null = null): Zeitplan {
  return { rhythmus, tag, ankerMonat, ankerDatum: null, verschiebung: 'nachher' };
}

export interface Vorlage {
  name: string;
  kategorieId: string;
  lebensbereichId: string;
  rhythmus: Rhythmus;
  /** Rundfunkbeitrag ist gesetzlich festgelegt; sonst kein Betrag vorbelegt. */
  betrag?: number;
  tag?: number;
  steuerlich?: boolean;
}

/** Vorlagen für typische Posten (schnelle Eingabe). */
export const VORLAGEN: Vorlage[] = [
  { name: 'Miete', kategorieId: 'kat-wohnen', lebensbereichId: 'lb-wohnen', rhythmus: 'monatlich', tag: 1 },
  { name: 'Strom', kategorieId: 'kat-energie', lebensbereichId: 'lb-wohnen', rhythmus: 'monatlich' },
  { name: 'Handy', kategorieId: 'kat-kommunikation', lebensbereichId: 'lb-kommunikation', rhythmus: 'monatlich' },
  { name: 'Haftpflicht', kategorieId: 'kat-versicherungen', lebensbereichId: 'lb-absicherung', rhythmus: 'jaehrlich', steuerlich: true },
  { name: 'Kfz-Versicherung', kategorieId: 'kat-versicherungen', lebensbereichId: 'lb-auto', rhythmus: 'jaehrlich', steuerlich: true },
  { name: 'Streaming', kategorieId: 'kat-abos', lebensbereichId: 'lb-abos', rhythmus: 'monatlich' },
  { name: 'Fitnessstudio', kategorieId: 'kat-gesundheit', lebensbereichId: 'lb-gesundheit', rhythmus: 'monatlich' },
  { name: 'Rundfunkbeitrag', kategorieId: 'kat-wohnen', lebensbereichId: 'lb-wohnen', rhythmus: 'vierteljaehrlich', betrag: 5508, tag: 15 },
];

export function neueId(praefix = 'x'): string {
  return `${praefix}-${crypto.randomUUID()}`;
}

/** Neuer Fixkosten-Posten mit sinnvollen Standardwerten. */
export function neuerFixkostenPosten(teil: Partial<Fixkosten> & Pick<Fixkosten, 'name' | 'kontoId'>, ab: string): Fixkosten {
  return {
    id: neueId('f'),
    kategorieId: 'kat-sonstiges',
    zahlungsart: 'lastschrift',
    zeitplan: zeitplan(),
    preise: [{ gueltigAb: ab, betrag: 0 }],
    status: 'aktiv',
    anteil: 100,
    steuerlich: false,
    vertrag: {},
    ...teil,
  };
}

export const RHYTHMUS_NAMEN: Record<Rhythmus, string> = {
  woechentlich: 'Wöchentlich',
  monatlich: 'Monatlich',
  zweimonatlich: 'Alle 2 Monate',
  vierteljaehrlich: 'Vierteljährlich',
  halbjaehrlich: 'Halbjährlich',
  jaehrlich: 'Jährlich',
};
