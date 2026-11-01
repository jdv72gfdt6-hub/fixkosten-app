/**
 * Datenmodell der App.
 *
 * Grundregeln:
 * - Geldbeträge sind immer ganze Cent (Integer), niemals Kommazahlen.
 * - Kalendertage sind Strings "YYYY-MM-DD" in lokaler Zeit, niemals Date-Objekte oder UTC.
 * - Jede Geldart hat ihre eigene Tabelle. Umbuchungen, Sparpläne, Rücklagen und Budgets
 *   können dadurch technisch nicht in die Fixkosten-Summe geraten.
 */

export type Cent = number;
/** Kalendertag "YYYY-MM-DD" (lokal, Europe/Berlin). */
export type Tag = string;

export type Rhythmus =
  | 'woechentlich'
  | 'monatlich'
  | 'zweimonatlich'
  | 'vierteljaehrlich'
  | 'halbjaehrlich'
  | 'jaehrlich';

/** Was passiert, wenn der Termin auf keinen Bankarbeitstag fällt. */
export type Verschiebung = 'vorher' | 'nachher';

export interface Zeitplan {
  rhythmus: Rhythmus;
  /** Tag im Monat (1–31), letzter Bankarbeitstag oder null = "Tag fehlt". */
  tag: number | 'letzter-bankarbeitstag' | null;
  /** Ein Monat (1–12), in dem die Zahlung fällig ist. Pflicht für nicht-monatliche Rhythmen. */
  ankerMonat?: number | null;
  /** Eine konkrete Fälligkeit. Pflicht für wöchentlich; legt sonst Monat und Tag fest. */
  ankerDatum?: Tag | null;
  verschiebung: Verschiebung;
}

export type KontoTyp =
  | 'giro'
  | 'tagesgeld'
  | 'bauspar'
  | 'depot'
  | 'versicherung'
  | 'kreditkarte'
  | 'bargeld'
  | 'sonstiges';

export type KontoRolle = 'einkommen' | 'fixkosten' | 'variabel' | 'ruecklage' | 'vermoegen';

export interface Konto {
  id: string;
  name: string;
  typ: KontoTyp;
  bank: string;
  /** Nur die letzten 4 Stellen der IBAN – niemals die volle IBAN. */
  ibanLast4?: string;
  rolle: KontoRolle;
  dispo?: Cent;
  mindestpuffer: Cent;
  farbe: string;
  symbol: string;
  /** Für Rücklagekonten: Lebensbereich, dem die Einzahlungen zugeordnet werden (z. B. Auto). */
  lebensbereichId?: string;
  kreditkarte?: { referenzKontoId: string; abrechnungstag: number };
  reihenfolge: number;
  geloeschtAm?: Tag;
}

export interface Kontostand {
  id: string;
  kontoId: string;
  datum: Tag;
  betrag: Cent;
  quelle: 'manuell' | 'abgleich';
  /** Zeitstempel der Erfassung (ms), entscheidet bei mehreren Ständen am selben Tag. */
  erfasst?: number;
}

export interface Betragsstand {
  gueltigAb: Tag;
  betrag: Cent;
}

export interface Einkommen {
  id: string;
  name: string;
  zielKontoId: string;
  zeitplan: Zeitplan;
  /** Betragsverlauf; Änderungen werden angehängt, nie überschrieben. */
  historie: Betragsstand[];
  geloeschtAm?: Tag;
}

export interface Einmalig {
  id: string;
  art: 'einnahme' | 'ausgabe';
  name: string;
  betrag: Cent;
  datum: Tag;
  kontoId: string;
  notiz?: string;
  geloeschtAm?: Tag;
}

export interface Umbuchung {
  id: string;
  name?: string;
  vonKontoId: string;
  nachKontoId: string;
  betrag: Cent;
  zeitplan: Zeitplan;
  art: 'dauerauftrag' | 'manuell';
  geloeschtAm?: Tag;
}

export type Zahlungsart = 'lastschrift' | 'dauerauftrag' | 'kreditkarte' | 'paypal' | 'ueberweisung';
export type PostenStatus = 'aktiv' | 'pausiert' | 'gekuendigt';
export type Fristeinheit = 'tage' | 'wochen' | 'monate';

export interface Vertrag {
  beginn?: Tag | null;
  mindestlaufzeitMonate?: number | null;
  kuendigungsfrist?: { wert: number; einheit: Fristeinheit } | null;
  /** Automatische Verlängerung in Monaten; 0 = danach jederzeit mit Frist kündbar. */
  verlaengerungMonate?: number | null;
}

export interface Finanzierung {
  restschuld?: Cent | null;
  /** Zinssatz in Promille p. a. (z. B. 49 = 4,9 %), um Kommazahlen zu vermeiden. */
  zinsPromille?: number | null;
  /** Datum der letzten Rate. Danach fällt der Posten automatisch aus der Prognose. */
  letzteRate?: Tag | null;
}

export interface Fixkosten {
  id: string;
  name: string;
  anbieter?: string;
  kategorieId: string;
  lebensbereichId?: string;
  tags?: string[];
  kontoId: string;
  zahlungsart: Zahlungsart;
  zeitplan: Zeitplan;
  preise: Betragsstand[];
  status: PostenStatus;
  /** Bei gekündigten Posten: letzter Tag, an dem noch abgebucht wird. */
  endeAm?: Tag | null;
  /** Eigener Anteil in Prozent (Standard 100). Volle Summe zählt trotzdem für die Kontoprognose. */
  anteil: number;
  steuerlich: boolean;
  vertrag?: Vertrag;
  finanzierung?: Finanzierung;
  /**
   * Probe-Rate: Das Geld gilt als Fixkosten (für die Quote), landet aber in Wirklichkeit
   * auf diesem eigenen Konto (z. B. Bargeld) und bleibt dein Vermögen.
   */
  zielKontoId?: string;
  notiz?: string;
  portalUrl?: string;
  geprueftAm?: Tag | null;
  geloeschtAm?: Tag;
}

export interface Sparplan {
  id: string;
  name: string;
  vonKontoId: string;
  zielKontoId?: string;
  betrag: Cent;
  zeitplan: Zeitplan;
  lebensbereichId?: string;
  geloeschtAm?: Tag;
}

export interface Ruecklage {
  id: string;
  name: string;
  kontoId: string;
  /**
   * Virtuell = Topf auf einem Konto, das auch andere Zwecke hat (z. B. Puffer auf dem Fixkostenkonto).
   * Nicht virtuell = eigenes Rücklagekonto; der Monatsbetrag ergibt sich dort aus den Umbuchungen.
   */
  virtuell: boolean;
  monatlich?: Cent;
  ziel?: Cent | null;
  stand?: Cent | null;
  lebensbereichId?: string;
  geloeschtAm?: Tag;
}

export interface Budget {
  id: string;
  name: string;
  kontoId: string;
  monatlich: Cent;
  lebensbereichId?: string;
  geloeschtAm?: Tag;
}

export interface Kategorie {
  id: string;
  name: string;
  farbe: string;
  symbol: string;
  reihenfolge: number;
}

export interface Lebensbereich {
  id: string;
  name: string;
  farbe: string;
  reihenfolge: number;
}

/** Abgehakter Eintrag im Monatsabschluss. */
export interface AbschlussEintrag {
  id: string; // `${monat}|${ereignisSchluessel}`
  monat: string; // "YYYY-MM"
  schluessel: string;
  erledigt: boolean;
  istBetrag?: Cent | null;
}

export interface Einstellungen {
  ampelGelb: number; // Prozent
  ampelRot: number;
  prognoseMonate: 3 | 6 | 12;
  design: 'auto' | 'hell' | 'dunkel';
  betraegeAusblenden: boolean;
  letztesBackup?: Tag | null;
  onboardingFertig: boolean;
  zuletztGenutztesKontoId?: string;
}

/** Alle fachlichen Daten in einem Objekt – Eingabe für alle Berechnungen. */
export interface Daten {
  konten: Konto[];
  kontostaende: Kontostand[];
  einkommen: Einkommen[];
  einmalig: Einmalig[];
  umbuchungen: Umbuchung[];
  fixkosten: Fixkosten[];
  sparplaene: Sparplan[];
  ruecklagen: Ruecklage[];
  budgets: Budget[];
  kategorien: Kategorie[];
  lebensbereiche: Lebensbereich[];
}

export const LEERE_DATEN: Daten = {
  konten: [],
  kontostaende: [],
  einkommen: [],
  einmalig: [],
  umbuchungen: [],
  fixkosten: [],
  sparplaene: [],
  ruecklagen: [],
  budgets: [],
  kategorien: [],
  lebensbereiche: [],
};
