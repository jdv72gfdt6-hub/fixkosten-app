/* Icons im SF-Symbols-Stil (Lucide). Symbol-Namen werden in den Daten als Text gespeichert. */
import {
  Banknote, Car, CircleEllipsis, CreditCard, HeartPulse, House, HousePlus, Landmark, PiggyBank, Plane, Play,
  Receipt, Shield, Smartphone, TrendingUp, Wallet, Wrench, Zap, type LucideIcon,
} from 'lucide-react';

const SYMBOLE: Record<string, LucideIcon> = {
  house: House,
  'house-plus': HousePlus,
  zap: Zap,
  shield: Shield,
  car: Car,
  smartphone: Smartphone,
  play: Play,
  landmark: Landmark,
  'heart-pulse': HeartPulse,
  'piggy-bank': PiggyBank,
  'circle-ellipsis': CircleEllipsis,
  receipt: Receipt,
  plane: Plane,
  wrench: Wrench,
  'trending-up': TrendingUp,
  banknote: Banknote,
  'credit-card': CreditCard,
  wallet: Wallet,
};

export const SYMBOL_NAMEN = Object.keys(SYMBOLE);
export const FARBEN = ['blue', 'green', 'indigo', 'orange', 'pink', 'purple', 'red', 'teal', 'yellow', 'mint', 'cyan', 'gray', 'brown'];

export function farbe(name: string | undefined): string {
  return `var(--f-${name && FARBEN.includes(name) ? name : 'gray'})`;
}

export function SymbolKreis({ symbol, farbe: f, klein }: { symbol: string; farbe: string; klein?: boolean }) {
  const Icon = SYMBOLE[symbol] ?? CircleEllipsis;
  return (
    <span className={`symbol-kreis${klein ? ' klein' : ''}`} style={{ background: farbe(f) }} aria-hidden="true">
      <Icon size={klein ? 15 : 18} strokeWidth={2.2} />
    </span>
  );
}
