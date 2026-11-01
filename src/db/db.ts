/*
 * Lokale Datenbank (IndexedDB über Dexie). Kein Server – alle Daten bleiben auf dem Gerät.
 *
 * Schema-Versionen: Jede Änderung bekommt eine neue `this.version(n)` mit `.upgrade()`.
 * Vor jedem Upgrade wird automatisch eine Sicherung im Speicher (Tabelle `sicherungen`) angelegt.
 */
import Dexie, { type Table } from 'dexie';
import { erstelleBackup, SCHEMA_VERSION, TABELLEN, type Backup } from '../domain/backup';
import { heute, plusTage } from '../domain/datum';
import { STANDARD_EINSTELLUNGEN } from '../domain/standard';
import type {
  AbschlussEintrag, Budget, Daten, Einkommen, Einmalig, Einstellungen, Fixkosten, Kategorie, Konto, Kontostand,
  Lebensbereich, Ruecklage, Sparplan, Umbuchung,
} from '../domain/typen';

export interface Sicherung {
  id?: number;
  erstelltAm: string;
  grund: string;
  backup: Backup;
}

interface MetaEintrag {
  schluessel: string;
  wert: unknown;
}

export class FixkostenDB extends Dexie {
  konten!: Table<Konto, string>;
  kontostaende!: Table<Kontostand, string>;
  einkommen!: Table<Einkommen, string>;
  einmalig!: Table<Einmalig, string>;
  umbuchungen!: Table<Umbuchung, string>;
  fixkosten!: Table<Fixkosten, string>;
  sparplaene!: Table<Sparplan, string>;
  ruecklagen!: Table<Ruecklage, string>;
  budgets!: Table<Budget, string>;
  kategorien!: Table<Kategorie, string>;
  lebensbereiche!: Table<Lebensbereich, string>;
  abschluss!: Table<AbschlussEintrag, string>;
  meta!: Table<MetaEintrag, string>;
  sicherungen!: Table<Sicherung, number>;

  constructor(name = 'fixkosten') {
    super(name);
    // Version 1 – Ausgangsschema. Nur Felder, nach denen gesucht wird, sind indiziert.
    this.version(1).stores({
      konten: 'id, reihenfolge',
      kontostaende: 'id, kontoId, datum',
      einkommen: 'id, zielKontoId',
      einmalig: 'id, kontoId, datum',
      umbuchungen: 'id, vonKontoId, nachKontoId',
      fixkosten: 'id, kontoId, kategorieId, status',
      sparplaene: 'id, vonKontoId',
      ruecklagen: 'id, kontoId',
      budgets: 'id, kontoId',
      kategorien: 'id, reihenfolge',
      lebensbereiche: 'id, reihenfolge',
      abschluss: 'id, monat',
      meta: 'schluessel',
      sicherungen: '++id, erstelltAm',
    });
    // Beispiel für künftige Versionen:
    // this.version(2).stores({ ... }).upgrade(async (tx) => { await sicherungVorMigration(tx, 1); ... });
    if (SCHEMA_VERSION !== 1) throw new Error('Dexie-Schema und SCHEMA_VERSION passen nicht zusammen.');
  }
}

export const db = new FixkostenDB();

export async function ladeDaten(d: FixkostenDB = db): Promise<Daten> {
  const eintraege = await Promise.all(TABELLEN.map((t) => (d.table(t) as Table<unknown>).toArray()));
  return Object.fromEntries(TABELLEN.map((t, i) => [t, eintraege[i]])) as unknown as Daten;
}

export async function ladeEinstellungen(d: FixkostenDB = db): Promise<Einstellungen> {
  const e = await d.meta.get('einstellungen');
  return { ...STANDARD_EINSTELLUNGEN, ...((e?.wert as Partial<Einstellungen>) ?? {}) };
}

export async function speichereEinstellungen(e: Einstellungen, d: FixkostenDB = db): Promise<void> {
  await d.meta.put({ schluessel: 'einstellungen', wert: e });
}

/** Ersetzt alle Daten in einer Transaktion. Vorher wird automatisch eine Sicherung angelegt. */
export async function ersetzeAlles(neu: Daten, grund: string, d: FixkostenDB = db, einstellungen?: Partial<Einstellungen>, abschluss?: AbschlussEintrag[]): Promise<void> {
  await legeSicherungAn(grund, d);
  await d.transaction('rw', [...TABELLEN.map((t) => d.table(t)), d.abschluss, d.meta], async () => {
    for (const t of TABELLEN) {
      await d.table(t).clear();
      await d.table(t).bulkPut(neu[t] as unknown[]);
    }
    if (abschluss) {
      await d.abschluss.clear();
      await d.abschluss.bulkPut(abschluss);
    }
    if (einstellungen) {
      const alt = await ladeEinstellungen(d);
      await speichereEinstellungen({ ...alt, ...einstellungen }, d);
    }
  });
}

/** Interne Sicherung (die letzten 5 werden behalten). */
export async function legeSicherungAn(grund: string, d: FixkostenDB = db): Promise<void> {
  const daten = await ladeDaten(d);
  const leer = TABELLEN.every((t) => daten[t].length === 0);
  if (leer) return;
  const backup = erstelleBackup(daten, await ladeEinstellungen(d), await d.abschluss.toArray());
  await d.sicherungen.add({ erstelltAm: new Date().toISOString(), grund, backup });
  const alle = await d.sicherungen.orderBy('erstelltAm').primaryKeys();
  if (alle.length > 5) await d.sicherungen.bulkDelete(alle.slice(0, alle.length - 5));
}

/** Endgültig löschen, was länger als 30 Tage im Papierkorb liegt. */
export async function leerePapierkorb(d: FixkostenDB = db, stichtag = heute()): Promise<number> {
  const grenzTag = plusTage(stichtag, -30);
  let n = 0;
  for (const t of TABELLEN) {
    const tab = d.table(t) as Table<{ id: string; geloeschtAm?: string }, string>;
    const alt = (await tab.toArray()).filter((x) => x.geloeschtAm && x.geloeschtAm < grenzTag).map((x) => x.id);
    if (alt.length) {
      await tab.bulkDelete(alt);
      n += alt.length;
    }
  }
  return n;
}

/** Den Browser bitten, die Daten nicht automatisch zu löschen. */
export async function speicherDauerhaft(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
