/* Farben und Symbole der Spartöpfe. Die Farbwerte selbst stehen in app.css (--f-…). */
import { Car, Gift, GraduationCap, Heart, House, PawPrint, PiggyBank, Plane, ShoppingBag, Smartphone, Stethoscope, Umbrella, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Spartopf } from './db';

export const FARBEN = [
  { id: 'blau', name: 'Blau' },
  { id: 'gelb', name: 'Gelb' },
  { id: 'tuerkis', name: 'Türkis' },
  { id: 'orange', name: 'Orange' },
  { id: 'lila', name: 'Lila' },
  { id: 'gruen', name: 'Grün' },
  { id: 'pink', name: 'Pink' },
  { id: 'grau', name: 'Grau' },
] as const;

export const SYMBOLE: { id: string; name: string; Icon: LucideIcon }[] = [
  { id: 'sparschwein', name: 'Sparschwein', Icon: PiggyBank },
  { id: 'haus', name: 'Haus', Icon: House },
  { id: 'auto', name: 'Auto', Icon: Car },
  { id: 'reise', name: 'Reise', Icon: Plane },
  { id: 'einkauf', name: 'Einkauf', Icon: ShoppingBag },
  { id: 'geschenk', name: 'Geschenk', Icon: Gift },
  { id: 'herz', name: 'Herz', Icon: Heart },
  { id: 'gesundheit', name: 'Gesundheit', Icon: Stethoscope },
  { id: 'handy', name: 'Handy', Icon: Smartphone },
  { id: 'ausbildung', name: 'Ausbildung', Icon: GraduationCap },
  { id: 'tier', name: 'Haustier', Icon: PawPrint },
  { id: 'notgroschen', name: 'Notgroschen', Icon: Umbrella },
];

/** Farbe für einen neuen Topf: reihum, damit nebeneinanderliegende Töpfe sich unterscheiden. */
export const vorgabeFarbe = (anzahl: number) => FARBEN[anzahl % FARBEN.length]!.id;

export const farbeVon = (t: Pick<Spartopf, 'farbe' | 'reihenfolge'>) => (FARBEN.some((f) => f.id === t.farbe) ? t.farbe! : vorgabeFarbe(t.reihenfolge));

export const symbolVon = (t: Pick<Spartopf, 'symbol'>) => SYMBOLE.find((s) => s.id === t.symbol) ?? SYMBOLE[0]!;

/** Setzt --farbe (Balken) und --farbe-text (Schrift, Symbol) für ein Element. */
export const farbStil = (farbe: string) => ({ '--farbe': `var(--f-${farbe})`, '--farbe-text': `var(--f-${farbe}-text)` }) as CSSProperties;
