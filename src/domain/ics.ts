/*
 * Kalenderdatei (.ics, RFC 5545) für Apple Kalender.
 * Jeder Termin hat eine feste UID, damit ein erneuter Import vorhandene Termine
 * aktualisiert statt sie doppelt anzulegen.
 */
import { plusTage } from './datum';
import type { Tag } from './typen';

export interface KalenderTermin {
  uid: string;
  datum: Tag;
  titel: string;
  beschreibung?: string;
  /** Erinnerung so viele Tage vorher (Standard: keine). */
  erinnerungTageVorher?: number;
}

function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Zeilen nach 75 Oktetts falten (UTF-8-sicher). */
function falte(zeile: string): string {
  const enc = new TextEncoder();
  if (enc.encode(zeile).length <= 75) return zeile;
  const teile: string[] = [];
  let aktuell = '';
  for (const zeichen of zeile) {
    const grenze = teile.length === 0 ? 75 : 74; // Folgezeilen beginnen mit einem Leerzeichen
    if (enc.encode(aktuell + zeichen).length > grenze) {
      teile.push(aktuell);
      aktuell = zeichen;
    } else {
      aktuell += zeichen;
    }
  }
  teile.push(aktuell);
  return teile.join('\r\n ');
}

const kompakt = (t: Tag) => t.replace(/-/g, '');

/** Zeitstempel im UTC-Format, wie es RFC 5545 für DTSTAMP verlangt. */
function dtstamp(jetzt: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${jetzt.getUTCFullYear()}${p(jetzt.getUTCMonth() + 1)}${p(jetzt.getUTCDate())}T${p(jetzt.getUTCHours())}${p(jetzt.getUTCMinutes())}${p(jetzt.getUTCSeconds())}Z`;
}

export function erzeugeIcs(termine: KalenderTermin[], jetzt: Date = new Date()): string {
  const z: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fixkosten-App//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Fixkosten',
  ];
  const stamp = dtstamp(jetzt);
  for (const t of termine) {
    z.push(
      'BEGIN:VEVENT',
      `UID:${t.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${kompakt(t.datum)}`,
      `DTEND;VALUE=DATE:${kompakt(plusTage(t.datum, 1))}`,
      `SUMMARY:${icsText(t.titel)}`,
      'TRANSP:TRANSPARENT',
    );
    if (t.beschreibung) z.push(`DESCRIPTION:${icsText(t.beschreibung)}`);
    if (t.erinnerungTageVorher !== undefined) {
      z.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(t.titel)}`, `TRIGGER:-P${t.erinnerungTageVorher}DT0H0M0S`, 'END:VALARM');
    }
    z.push('END:VEVENT');
  }
  z.push('END:VCALENDAR');
  return z.map(falte).join('\r\n') + '\r\n';
}
