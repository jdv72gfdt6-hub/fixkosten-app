import { describe, expect, it } from 'vitest';
import { betragFuerEingabe, formatBetrag, parseBetrag } from './geld';

describe('Beträge', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234,5', 123450],
    ['12', 1200],
    ['12,-', 1200],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['12.50', 1250],
    ['250 €', 25000],
    ['0', 0],
    ['0,07', 7],
    ['-5,00', -500],
  ])('liest "%s"', (eingabe, cent) => {
    expect(parseBetrag(eingabe)).toBe(cent);
  });

  it.each(['', 'abc', '1,2,3', '12,345', '1.23.4', '12.345,6.7', '99999999999999999999'])('lehnt "%s" ab', (eingabe) => {
    expect(parseBetrag(eingabe)).toBeNull();
  });

  it('rechnet ohne Rundungsfehler', () => {
    expect(parseBetrag('0,29')).toBe(29);
    expect(parseBetrag('1,15')).toBe(115);
    expect(parseBetrag('4,35')).toBe(435);
  });

  it('zeigt deutsche Beträge', () => {
    expect(formatBetrag(123456789)).toBe('1.234.567,89 €');
    expect(formatBetrag(5)).toBe('0,05 €');
    expect(formatBetrag(0)).toBe('0,00 €');
    expect(formatBetrag(-2550)).toBe('−25,50 €');
  });

  it('Eingabewert lässt sich wieder einlesen', () => {
    expect(betragFuerEingabe(123456)).toBe('1234,56');
    expect(parseBetrag(betragFuerEingabe(123456))).toBe(123456);
  });
});
