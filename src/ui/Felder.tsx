/* Formularfelder im iOS-Stil (Beschriftung links, Wert rechts). */
import { useId, useState, type ReactNode } from 'react';
import { betragFuerEingabe, parseBetrag } from '../domain/geld';
import { monatsname } from '../domain/datum';
import { RHYTHMUS_NAMEN } from '../domain/standard';
import type { Cent, Konto, Rhythmus, Zeitplan } from '../domain/typen';

export function TextFeld({ label, wert, onChange, platzhalter, typ = 'text', autoFocus }: {
  label: string;
  wert: string;
  onChange: (v: string) => void;
  platzhalter?: string;
  typ?: 'text' | 'url';
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="feld">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={typ} value={wert} placeholder={platzhalter} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} autoComplete="off" />
    </div>
  );
}

export function NotizFeld({ label, wert, onChange }: { label: string; wert: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="feld hoch">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} value={wert} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/**
 * Betragsfeld mit deutscher Eingabe ("1.234,56"). Speichert Cent.
 * Ungültige Eingaben werden markiert, aber nicht verworfen.
 */
export function BetragFeld({ label, wert, onChange, gross, erlaubeLeer, negativErlaubt }: {
  label: string;
  wert: Cent | null;
  onChange: (v: Cent | null) => void;
  gross?: boolean;
  erlaubeLeer?: boolean;
  negativErlaubt?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(wert === null || (wert === 0 && gross) ? '' : betragFuerEingabe(wert));
  const geparst = text.trim() === '' ? null : parseBetrag(text);
  const fehler = (text.trim() !== '' && geparst === null) || (!negativErlaubt && geparst !== null && geparst < 0);
  return (
    <>
      <div className={`feld${gross ? ' hoch' : ''}`}>
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          className={gross ? 'betrag-gross' : 'zahl'}
          inputMode="decimal"
          placeholder={erlaubeLeer && !gross ? 'optional' : '0,00'}
          value={text}
          aria-invalid={fehler}
          onChange={(e) => {
            setText(e.target.value);
            const p = e.target.value.trim() === '' ? null : parseBetrag(e.target.value);
            if (e.target.value.trim() === '') onChange(erlaubeLeer ? null : 0);
            else if (p !== null && (negativErlaubt || p >= 0)) onChange(p);
          }}
        />
        {!gross && <span aria-hidden="true">€</span>}
      </div>
      {fehler && <p className="fehler-text">Bitte einen Betrag wie 1.234,56 eingeben.</p>}
    </>
  );
}

export function AuswahlFeld<T extends string>({ label, wert, onChange, optionen }: {
  label: string;
  wert: T;
  onChange: (v: T) => void;
  optionen: { wert: T; text: string }[];
}) {
  const id = useId();
  return (
    <div className="feld">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={wert} onChange={(e) => onChange(e.target.value as T)}>
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>
            {o.text}
          </option>
        ))}
      </select>
    </div>
  );
}

export function KontoFeld({ label, wert, onChange, konten, leerText }: {
  label: string;
  wert: string;
  onChange: (v: string) => void;
  konten: Konto[];
  leerText?: string;
}) {
  return (
    <AuswahlFeld
      label={label}
      wert={wert}
      onChange={onChange}
      optionen={[...(leerText !== undefined ? [{ wert: '', text: leerText }] : []), ...konten.map((k) => ({ wert: k.id, text: k.name }))]}
    />
  );
}

export function SchalterFeld({ label, wert, onChange, unter }: { label: string; wert: boolean; onChange: (v: boolean) => void; unter?: ReactNode }) {
  const id = useId();
  return (
    <div className="feld">
      <label htmlFor={id} style={{ maxWidth: 'none', flex: 1 }}>
        {label}
        {unter && <span className="zeile-unter" style={{ display: 'block' }}>{unter}</span>}
      </label>
      <input id={id} type="checkbox" role="switch" className="schalter" checked={wert} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

export function DatumFeld({ label, wert, onChange, optional }: { label: string; wert: string | null | undefined; onChange: (v: string | null) => void; optional?: boolean }) {
  const id = useId();
  return (
    <div className="feld">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="date" value={wert ?? ''} required={!optional} onChange={(e) => onChange(e.target.value || null)} />
    </div>
  );
}

export function ZahlFeld({ label, wert, onChange, einheit, min = 0, max }: {
  label: string;
  wert: number | null | undefined;
  onChange: (v: number | null) => void;
  einheit?: string;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div className="feld">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="zahl"
        inputMode="numeric"
        value={wert ?? ''}
        placeholder="–"
        onChange={(e) => {
          const s = e.target.value.replace(/\D/g, '');
          if (s === '') return onChange(null);
          let n = Number(s);
          if (max !== undefined) n = Math.min(max, n);
          onChange(Math.max(min, n));
        }}
      />
      {einheit && <span className="text-2">{einheit}</span>}
    </div>
  );
}

const RHYTHMEN = Object.entries(RHYTHMUS_NAMEN).map(([wert, text]) => ({ wert: wert as Rhythmus, text }));

/** Ankerdatum auflösen, ohne den Fälligkeitsmonat zu verlieren. */
function ohneAnkerDatum(z: Zeitplan): Zeitplan {
  if (!z.ankerDatum) return z;
  return { ...z, ankerMonat: z.ankerMonat ?? Number(z.ankerDatum.slice(5, 7)), tag: z.tag ?? Number(z.ankerDatum.slice(8, 10)), ankerDatum: null };
}

/** Rhythmus, Tag, Fälligkeitsmonat und Verschiebung in einem Block. */
export function ZeitplanFelder({ wert, onChange, mitLetztemBankarbeitstag }: {
  wert: Zeitplan;
  onChange: (z: Zeitplan) => void;
  mitLetztemBankarbeitstag?: boolean;
}) {
  const tag = wert.tag ?? (wert.ankerDatum ? Number(wert.ankerDatum.slice(8, 10)) : null);
  const tagWert = tag === null ? 'fehlt' : String(tag);
  const monatsbasiert = wert.rhythmus !== 'woechentlich';
  return (
    <>
      <AuswahlFeld label="Rhythmus" wert={wert.rhythmus} optionen={RHYTHMEN} onChange={(rhythmus) => onChange({ ...wert, rhythmus })} />
      {monatsbasiert ? (
        <AuswahlFeld
          label="Tag"
          wert={tagWert}
          onChange={(v) => onChange({ ...ohneAnkerDatum(wert), tag: v === 'fehlt' ? null : v === 'letzter-bankarbeitstag' ? v : Number(v) })}
          optionen={[
            { wert: 'fehlt', text: 'Tag fehlt' },
            ...(mitLetztemBankarbeitstag ? [{ wert: 'letzter-bankarbeitstag', text: 'Letzter Bankarbeitstag' }] : []),
            ...Array.from({ length: 31 }, (_, i) => ({ wert: String(i + 1), text: `${i + 1}.` })),
          ]}
        />
      ) : (
        <DatumFeld label="Erste Fälligkeit" wert={wert.ankerDatum} onChange={(ankerDatum) => onChange({ ...wert, ankerDatum })} />
      )}
      {monatsbasiert && wert.rhythmus !== 'monatlich' && (
        <AuswahlFeld
          label="Fällig im"
          wert={String(wert.ankerMonat ?? (wert.ankerDatum ? Number(wert.ankerDatum.slice(5, 7)) : ''))}
          onChange={(v) => onChange({ ...ohneAnkerDatum(wert), ankerMonat: v ? Number(v) : null })}
          optionen={[{ wert: '', text: 'Monat fehlt' }, ...Array.from({ length: 12 }, (_, i) => ({ wert: String(i + 1), text: monatsname(i + 1) }))]}
        />
      )}
      {wert.tag !== 'letzter-bankarbeitstag' && (
        <AuswahlFeld
          label="Kein Bankarbeitstag"
          wert={wert.verschiebung}
          onChange={(verschiebung) => onChange({ ...wert, verschiebung })}
          optionen={[
            { wert: 'nachher', text: 'Danach buchen' },
            { wert: 'vorher', text: 'Vorher buchen' },
          ]}
        />
      )}
    </>
  );
}
