/*
 * Backup-Format, Prüfung beim Import und Migrationen zwischen Schema-Versionen.
 *
 * Jede Schemaänderung bekommt hier eine Migrationsfunktion (Version n → n+1) mit Test.
 * Die Datenbank (db.ts) nutzt dieselben Funktionen, damit Backup und DB immer gleich migriert werden.
 */
import { istTag } from './datum';
import { LEERE_DATEN, type AbschlussEintrag, type Daten, type Einstellungen } from './typen';

export const BACKUP_FORMAT = 'fixkosten-backup';
export const SCHEMA_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportiertAm: string;
  daten: Daten;
  einstellungen?: Partial<Einstellungen>;
  abschluss?: AbschlussEintrag[];
}

type Migration = (daten: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrationen: Schlüssel = Ausgangsversion. Beispiel für eine künftige Version 2:
 *   1: (d) => ({ ...d, fixkosten: d.fixkosten.map((f) => ({ ...f, neuesFeld: null })) })
 */
export const MIGRATIONEN: Record<number, Migration> = {};

export function migriere(daten: Record<string, unknown>, vonVersion: number, bisVersion = SCHEMA_VERSION): Record<string, unknown> {
  let d = daten;
  for (let v = vonVersion; v < bisVersion; v++) {
    const m = MIGRATIONEN[v];
    if (!m) throw new Error(`Keine Migration von Version ${v} auf ${v + 1} vorhanden.`);
    d = m(d);
  }
  return d;
}

export const TABELLEN = Object.keys(LEERE_DATEN) as (keyof Daten)[];

const BETRAGSFELDER = ['betrag', 'dispo', 'mindestpuffer', 'monatlich', 'ziel', 'stand', 'restschuld'];
const TAGFELDER = ['datum', 'gueltigAb', 'endeAm', 'geprueftAm', 'beginn', 'letzteRate', 'ankerDatum', 'geloeschtAm'];

/** Prüft rekursiv, dass Beträge ganze Cent und Tage gültige Kalendertage sind. */
function pruefeWerte(wert: unknown, pfad: string, fehler: string[]) {
  if (fehler.length > 10) return;
  if (Array.isArray(wert)) {
    wert.forEach((x, i) => pruefeWerte(x, `${pfad}[${i}]`, fehler));
    return;
  }
  if (!wert || typeof wert !== 'object') return;
  for (const [k, v] of Object.entries(wert)) {
    if (BETRAGSFELDER.includes(k) && v !== null && v !== undefined && !Number.isSafeInteger(v)) {
      fehler.push(`${pfad}.${k}: Betrag muss in ganzen Cent angegeben sein.`);
    } else if (TAGFELDER.includes(k) && v !== null && v !== undefined && !istTag(v)) {
      fehler.push(`${pfad}.${k}: Ungültiges Datum "${String(v)}".`);
    } else if (k === 'ibanLast4' && v && !/^\d{0,4}$/.test(String(v))) {
      fehler.push(`${pfad}.ibanLast4: Nur die letzten 4 Ziffern der IBAN sind erlaubt.`);
    } else if (typeof v === 'object') {
      pruefeWerte(v, `${pfad}.${k}`, fehler);
    }
  }
}

export interface BackupVorschau {
  exportiertAm: string;
  schemaVersion: number;
  anzahl: Record<keyof Daten, number>;
}

export type PruefErgebnis =
  | { ok: true; backup: Backup; vorschau: BackupVorschau }
  | { ok: false; fehler: string[] };

/** Prüft eine Backup-Datei vollständig, bevor irgendetwas überschrieben wird. */
export function pruefeBackup(json: unknown): PruefErgebnis {
  if (!json || typeof json !== 'object') return { ok: false, fehler: ['Die Datei enthält kein gültiges Backup.'] };
  const b = json as Record<string, unknown>;
  if (b.format !== BACKUP_FORMAT) return { ok: false, fehler: ['Die Datei ist kein Backup dieser App.'] };
  const version = Number(b.schemaVersion);
  if (!Number.isInteger(version) || version < 1) return { ok: false, fehler: ['Unbekannte Schema-Version.'] };
  if (version > SCHEMA_VERSION) {
    return { ok: false, fehler: [`Das Backup stammt aus einer neueren App-Version (${version}). Bitte zuerst die App aktualisieren.`] };
  }
  if (!b.daten || typeof b.daten !== 'object') return { ok: false, fehler: ['Im Backup fehlen die Daten.'] };

  let roh: Record<string, unknown>;
  try {
    roh = migriere(b.daten as Record<string, unknown>, version);
  } catch (e) {
    return { ok: false, fehler: [(e as Error).message] };
  }

  const fehler: string[] = [];
  const daten = { ...LEERE_DATEN } as Daten;
  for (const t of TABELLEN) {
    const liste = roh[t] ?? [];
    if (!Array.isArray(liste)) {
      fehler.push(`"${t}" ist keine Liste.`);
      continue;
    }
    liste.forEach((x, i) => {
      if (!x || typeof x !== 'object' || typeof (x as { id?: unknown }).id !== 'string') fehler.push(`${t}[${i}]: Eintrag ohne ID.`);
    });
    (daten as unknown as Record<string, unknown[]>)[t] = liste;
  }
  pruefeWerte(daten, 'daten', fehler);
  if (fehler.length) return { ok: false, fehler: fehler.slice(0, 10) };

  const anzahl = Object.fromEntries(TABELLEN.map((t) => [t, daten[t].length])) as Record<keyof Daten, number>;
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportiertAm: String(b.exportiertAm ?? ''),
      daten,
      einstellungen: (b.einstellungen as Partial<Einstellungen>) ?? undefined,
      abschluss: Array.isArray(b.abschluss) ? (b.abschluss as AbschlussEintrag[]) : undefined,
    },
    vorschau: { exportiertAm: String(b.exportiertAm ?? ''), schemaVersion: version, anzahl },
  };
}

export function erstelleBackup(daten: Daten, einstellungen: Einstellungen, abschluss: AbschlussEintrag[], jetzt = new Date()): Backup {
  return { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportiertAm: jetzt.toISOString(), daten, einstellungen, abschluss };
}
