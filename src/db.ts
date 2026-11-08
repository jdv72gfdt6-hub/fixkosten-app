/*
 * Lokale Datenbank (IndexedDB über Dexie). Kein Server – alle Daten bleiben auf dem Gerät.
 *
 * Die Tabellen aus Version 1 gehören zur früheren Fixkosten-App. Sie bleiben unverändert erhalten:
 * Beim ersten Start werden nur die Trade-Republic-Töpfe daraus als Unterkonten übernommen.
 */
import Dexie, { type Table } from 'dexie';
import type { Cent } from './geld';

export interface Unterkonto {
  id: string;
  name: string;
  stand: Cent;
  reihenfolge: number;
}

interface Alt {
  id: string;
  name?: string;
  bank?: string;
  kontoId?: string;
  zielKontoId?: string;
  nachKontoId?: string;
  vonKontoId?: string;
  geloeschtAm?: string;
  stand?: Cent | null;
  betrag?: Cent;
  datum?: string;
  erfasst?: number;
  quelle?: { typ: string; id: string } | string;
}

interface MetaEintrag {
  schluessel: string;
  wert: unknown;
}

const UEBERNOMMEN = 'unterkontenUebernommen';

export const neueId = () => crypto.randomUUID();

export class AppDB extends Dexie {
  unterkonten!: Table<Unterkonto, string>;
  meta!: Table<MetaEintrag, string>;

  constructor(name = 'fixkosten') {
    super(name);
    this.version(1).stores(TABELLEN_V1);
    this.version(2).stores({ unterkonten: 'id, reihenfolge' });
  }
}

/** Schema der früheren App. Muss bestehen bleiben, damit vorhandene Daten erhalten bleiben. */
export const TABELLEN_V1 = {
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
};

export const db = new AppDB();

/** Einmalig: Töpfe des früheren Trade-Republic-Kontos als Unterkonten anlegen. */
export async function uebernehmeAlteDaten(d: AppDB = db): Promise<void> {
  await d.transaction('rw', d.tables, async () => {
    if (await d.meta.get(UEBERNOMMEN)) return;
    await d.meta.put({ schluessel: UEBERNOMMEN, wert: true });
    await d.unterkonten.bulkPut(await alteToepfe(d));
  });
}

async function alteToepfe(d: AppDB): Promise<Unterkonto[]> {
  const lade = async (t: string) => ((await d.table(t).toArray()) as Alt[]).filter((x) => !x.geloeschtAm);
  const konten = await lade('konten');
  const einstellungen = (await d.meta.get('einstellungen'))?.wert as { sparKontoId?: string } | undefined;
  const konto = konten.find((k) => k.id === einstellungen?.sparKontoId) ?? konten.find((k) => /trade\s*republic/i.test(`${k.name} ${k.bank ?? ''}`));
  if (!konto) return [];

  const quellen = [
    ...(await lade('einkommen')).filter((e) => e.zielKontoId === konto.id).map((e) => ({ id: e.id, name: e.name })),
    ...(await lade('umbuchungen')).filter((u) => u.nachKontoId === konto.id).map((u) => ({ id: u.id, name: u.name || `Von ${konten.find((k) => k.id === u.vonKontoId)?.name ?? 'anderem Konto'}` })),
    ...(await lade('sparplaene')).filter((s) => s.zielKontoId === konto.id).map((s) => ({ id: s.id, name: s.name })),
    ...(await lade('fixkosten')).filter((f) => f.zielKontoId === konto.id).map((f) => ({ id: f.id, name: f.name })),
  ];
  const toepfe = (await lade('ruecklagen')).filter((r) => r.kontoId === konto.id);
  const quelleVon = (r: Alt) => (r.quelle && typeof r.quelle === 'object' ? r.quelle.id : undefined);

  const mitQuelle = quellen.map((q) => ({ name: q.name ?? 'Unterkonto', stand: toepfe.find((r) => quelleVon(r) === q.id)?.stand ?? 0 }));
  const ohneQuelle = toepfe.filter((r) => !quellen.some((q) => q.id === quelleVon(r)) && typeof r.stand === 'number').map((r) => ({ name: r.name ?? 'Unterkonto', stand: r.stand! }));
  const liste = [...mitQuelle, ...ohneQuelle];

  // Nur ein Gesamtstand eingetragen, keine einzelnen Töpfe: Er darf nicht verloren gehen.
  if (!liste.some((x) => x.stand !== 0)) {
    const letzter = (await lade('kontostaende'))
      .filter((s) => s.kontoId === konto.id)
      .sort((a, b) => (a.datum ?? '').localeCompare(b.datum ?? '') || (a.erfasst ?? 0) - (b.erfasst ?? 0))
      .at(-1);
    if (letzter?.betrag) liste.push({ name: 'Sonstiges', stand: Math.max(0, letzter.betrag) });
  }
  return liste.map((x, reihenfolge) => ({ id: neueId(), name: x.name, stand: x.stand, reihenfolge }));
}

export async function speichereUnterkonto(k: { id?: string; name: string; stand: Cent }, d: AppDB = db): Promise<string> {
  return d.transaction('rw', d.unterkonten, async () => {
    const alt = k.id ? await d.unterkonten.get(k.id) : undefined;
    const letztes = await d.unterkonten.orderBy('reihenfolge').last();
    const id = k.id ?? neueId();
    await d.unterkonten.put({ id, name: k.name, stand: k.stand, reihenfolge: alt?.reihenfolge ?? (letztes ? letztes.reihenfolge + 1 : 0) });
    return id;
  });
}

/** Den Browser bitten, die Daten nicht automatisch zu löschen. */
export async function speicherDauerhaft(): Promise<void> {
  if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
}
