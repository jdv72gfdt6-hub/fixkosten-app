import { euroSprechtext, formatEuro, type FormatOptionen } from '../domain/geld';
import type { Cent } from '../domain/typen';
import { useDatenOptional } from '../state/daten';

interface Props extends FormatOptionen {
  wert: Cent;
  /** Farbe nach Vorzeichen (grün/rot) – das Minuszeichen bleibt immer sichtbar. */
  faerben?: boolean;
  className?: string;
}

/** Betrag mit Tabellenziffern; respektiert "Beträge ausblenden". */
export function Betrag({ wert, faerben, className = '', ...opt }: Props) {
  const ausblenden = useDatenOptional()?.einstellungen.betraegeAusblenden;
  const farbe = faerben ? (wert < 0 ? 'text-rot' : wert > 0 ? 'text-gruen' : '') : '';
  if (ausblenden) {
    return (
      <span className={`zahl ${className}`} aria-label="Betrag ausgeblendet">
        •••&nbsp;€
      </span>
    );
  }
  return (
    <span className={`zahl ${farbe} ${className}`} aria-label={euroSprechtext(wert)}>
      {formatEuro(wert, opt)}
    </span>
  );
}
