import { describe, expect, it } from 'vitest';
import { formatEuro, formatProzent, jahresCent, monatlich, monatAusJahresCent, parseBetrag, prozent, rundeKaufmaennisch } from './geld';

describe('parseBetrag – deutsche Eingaben', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234,5', 123450],
    ['12', 1200],
    ['0,99', 99],
    [',5', 50],
    ['-5,00', -500],
    ['−5,00', -500],
    ['12,-', 1200],
    ['1.234', 123400],
    ['1.234.567,89', 123456789],
    ['12.50', 1250],
    ['91,70 €', 9170],
    [' 2 600,00 ', 260000],
  ])('%s → %i Cent', (eingabe, cent) => {
    expect(parseBetrag(eingabe)).toBe(cent);
  });

  it.each(['', 'abc', '1,2,3', '1,234', '12.345,6.7', '1.23.4'])('ungültig: "%s"', (eingabe) => {
    expect(parseBetrag(eingabe)).toBeNull();
  });
});

describe('formatEuro', () => {
  it('deutsches Format mit Tausenderpunkt und geschütztem Leerzeichen', () => {
    expect(formatEuro(123456)).toBe('1.234,56 €');
    expect(formatEuro(5)).toBe('0,05 €');
    expect(formatEuro(0)).toBe('0,00 €');
  });
  it('negative Beträge mit echtem Minuszeichen', () => {
    expect(formatEuro(-8400)).toBe('−84,00 €');
  });
  it('Vorzeichen und Kurzform', () => {
    expect(formatEuro(2300, { vorzeichen: true })).toBe('+23,00 €');
    expect(formatEuro(40000, { kurz: true })).toBe('400 €');
    expect(formatEuro(40050, { kurz: true })).toBe('400,50 €');
  });
});

describe('Rundung und Umrechnung', () => {
  it('kaufmännisch: halbe Cent vom Nullpunkt weg', () => {
    expect(rundeKaufmaennisch(2.5)).toBe(3);
    expect(rundeKaufmaennisch(-2.5)).toBe(-3);
    expect(rundeKaufmaennisch(2.4999)).toBe(2);
    expect(Object.is(rundeKaufmaennisch(-0.2), 0)).toBe(true);
  });
  it('wöchentlich → monatlich = × 52 / 12', () => {
    expect(monatlich(1000, 'woechentlich')).toBe(4333); // 4333,33…
    expect(monatlich(1500, 'woechentlich')).toBe(6500);
  });
  it('vierteljährlich / 3, halbjährlich / 6, jährlich / 12', () => {
    expect(monatlich(5508, 'vierteljaehrlich')).toBe(1836);
    expect(monatlich(26514, 'halbjaehrlich')).toBe(4419);
    expect(monatlich(25200, 'jaehrlich')).toBe(2100);
    expect(monatlich(1000, 'zweimonatlich')).toBe(500);
  });
  it('Summe aus ungerundeten Werten: Differenz zur Zeilensumme höchstens 1 Cent pro Zeile', () => {
    const zeilen = [1000, 1000, 1000].map((b) => jahresCent(b, 'jaehrlich')); // je 83,333… Cent
    const gesamt = monatAusJahresCent(zeilen.reduce((a, b) => a + b, 0));
    const zeilensumme = zeilen.map(monatAusJahresCent).reduce((a, b) => a + b, 0);
    expect(gesamt).toBe(250);
    expect(zeilensumme).toBe(249);
    expect(Math.abs(gesamt - zeilensumme)).toBeLessThanOrEqual(zeilen.length);
  });
  it('Prozent: keine Division durch null', () => {
    expect(prozent(100, 0)).toBeNull();
    expect(formatProzent(null)).toBe('–');
    expect(formatProzent(51.937)).toBe('51,9 %');
  });
});
