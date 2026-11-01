import { addDays, addMonths, differenceInCalendarDays, getDaysInMonth } from 'date-fns';
import type { Tag } from './typen';

/*
 * Kalendertage werden als "YYYY-MM-DD" in lokaler Zeit behandelt.
 * Niemals toISOString() verwenden – das rechnet in UTC und verschiebt Tage.
 * Intern wird mit lokalen Date-Objekten um 12:00 Uhr gerechnet, damit
 * Sommer-/Winterzeitwechsel nie einen Tag verschieben.
 */

const TAG_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function istTag(s: unknown): s is Tag {
  if (typeof s !== 'string') return false;
  const m = TAG_REGEX.exec(s);
  if (!m) return false;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && t >= 1 && t <= tageImMonat(j, mo);
}

export function zuDate(tag: Tag): Date {
  const m = TAG_REGEX.exec(tag);
  if (!m) throw new Error(`Ungültiger Tag: ${tag}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

export function ausDate(d: Date): Tag {
  return baueTag(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function baueTag(jahr: number, monat: number, tag: number): Tag {
  return `${String(jahr).padStart(4, '0')}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
}

export function teile(tag: Tag): { jahr: number; monat: number; tag: number } {
  const m = TAG_REGEX.exec(tag);
  if (!m) throw new Error(`Ungültiger Tag: ${tag}`);
  return { jahr: Number(m[1]), monat: Number(m[2]), tag: Number(m[3]) };
}

/** Heutiger lokaler Kalendertag. */
export function heute(jetzt: Date = new Date()): Tag {
  return ausDate(jetzt);
}

export function tageImMonat(jahr: number, monat: number): number {
  return getDaysInMonth(new Date(jahr, monat - 1, 1, 12));
}

export function plusTage(tag: Tag, n: number): Tag {
  return ausDate(addDays(zuDate(tag), n));
}

/** Monate addieren; der 31. wird in kürzeren Monaten zum letzten Tag (date-fns-Verhalten). */
export function plusMonate(tag: Tag, n: number): Tag {
  return ausDate(addMonths(zuDate(tag), n));
}

export function tageZwischen(von: Tag, bis: Tag): number {
  return differenceInCalendarDays(zuDate(bis), zuDate(von));
}

/** 0 = Sonntag … 6 = Samstag */
export function wochentag(tag: Tag): number {
  return zuDate(tag).getDay();
}

/** Monatsschlüssel "YYYY-MM". */
export function monatVon(tag: Tag): string {
  return tag.slice(0, 7);
}

export function ersterDesMonats(jahr: number, monat: number): Tag {
  return baueTag(jahr, monat, 1);
}

export function letzterDesMonats(jahr: number, monat: number): Tag {
  return baueTag(jahr, monat, tageImMonat(jahr, monat));
}

/** Tag im Monat, der in kürzeren Monaten auf den letzten Tag begrenzt wird (31. → 30./28./29.). */
export function tagImMonatBegrenzt(jahr: number, monat: number, tag: number): Tag {
  return baueTag(jahr, monat, Math.min(Math.max(1, tag), tageImMonat(jahr, monat)));
}

/** Monat (jahr, monat) um n Monate verschieben. */
export function monatPlus(jahr: number, monat: number, n: number): { jahr: number; monat: number } {
  const idx = jahr * 12 + (monat - 1) + n;
  return { jahr: Math.floor(idx / 12), monat: (((idx % 12) + 12) % 12) + 1 };
}

export function minTag(a: Tag, b: Tag): Tag {
  return a < b ? a : b;
}

export function maxTag(a: Tag, b: Tag): Tag {
  return a > b ? a : b;
}

const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const MONATSNAMEN_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WOCHENTAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function monatsname(monat: number, kurz = false): string {
  return (kurz ? MONATSNAMEN_KURZ : MONATSNAMEN)[monat - 1] ?? '';
}

export function wochentagKurz(tag: Tag): string {
  return WOCHENTAGE_KURZ[wochentag(tag)]!;
}

/** "2026-10-31" → "31.10.2026" */
export function formatTag(tag: Tag): string {
  const { jahr, monat, tag: t } = teile(tag);
  return `${String(t).padStart(2, '0')}.${String(monat).padStart(2, '0')}.${jahr}`;
}

/** "2026-10-31" → "31.10." */
export function formatTagKurz(tag: Tag): string {
  const { monat, tag: t } = teile(tag);
  return `${String(t).padStart(2, '0')}.${String(monat).padStart(2, '0')}.`;
}

/** "2026-10" → "Oktober 2026" */
export function formatMonat(monatsSchluessel: string, kurz = false): string {
  const [j, m] = monatsSchluessel.split('-').map(Number) as [number, number];
  return `${monatsname(m, kurz)} ${j}`;
}

/** Deutsche Datumseingabe "31.10.2026" oder "31.10.26" in Tag umwandeln. */
export function parseTagDeutsch(s: string): Tag | null {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\s*$/.exec(s);
  if (!m) return istTag(s.trim()) ? s.trim() : null;
  let jahr = Number(m[3]);
  if (jahr < 100) jahr += 2000;
  const t = baueTag(jahr, Number(m[2]), Number(m[1]));
  return istTag(t) ? t : null;
}
