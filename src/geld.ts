/** Alle Beträge sind ganze Cent, damit beim Summieren keine Rundungsfehler entstehen. */
export type Cent = number;

const MINUS = '−';
const NBSP = ' ';

/**
 * Deutsche Betragseingabe in Cent umwandeln.
 * Akzeptiert: "1.234,56", "1234,56", "1234,5", "12", "-5,00", "12,-", "1.234", "12.50", mit oder ohne "€".
 * Gibt null zurück, wenn die Eingabe kein gültiger Betrag ist.
 */
export function parseBetrag(eingabe: string): Cent | null {
  let s = eingabe.trim().replace(/€|EUR/gi, '').replace(/\s/g, '');
  if (s === '') return null;
  const negativ = /^[-−]/.test(s);
  if (negativ) s = s.slice(1);
  s = s.replace(/,-$/, ',00');

  let euro: string;
  let cent = '';
  if (s.includes(',')) {
    const teile = s.split(',');
    if (teile.length !== 2) return null;
    euro = teile[0]!;
    cent = teile[1]!;
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(euro || '0')) return null;
    euro = euro.replace(/\./g, '');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    euro = s.replace(/\./g, '');
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    [euro, cent] = s.split('.') as [string, string];
  } else {
    euro = s;
  }
  if (euro === '') euro = '0';
  if (!/^\d+$/.test(euro) || !/^\d{0,2}$/.test(cent)) return null;
  const betrag = Number(euro) * 100 + Number(cent.padEnd(2, '0'));
  if (!Number.isSafeInteger(betrag)) return null;
  return negativ && betrag !== 0 ? -betrag : betrag;
}

function teile(wert: Cent): { euro: string; cent: string } {
  const abs = Math.abs(wert);
  return { euro: String(Math.floor(abs / 100)), cent: String(abs % 100).padStart(2, '0') };
}

/** Anzeige: "1.234,56 €" mit geschütztem Leerzeichen. */
export function formatBetrag(wert: Cent): string {
  const { euro, cent } = teile(wert);
  return `${wert < 0 ? MINUS : ''}${euro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cent}${NBSP}€`;
}

/** Vorbelegung eines Eingabefelds: "1234,56". */
export function betragFuerEingabe(wert: Cent): string {
  const { euro, cent } = teile(wert);
  return `${wert < 0 ? '-' : ''}${euro},${cent}`;
}
