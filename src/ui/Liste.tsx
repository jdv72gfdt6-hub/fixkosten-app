import { ChevronRight } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

export function Gruppe({ titel, aktion, fuss, gross, children, id }: {
  titel?: ReactNode;
  aktion?: { text: string; onClick: () => void };
  fuss?: ReactNode;
  gross?: boolean;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section aria-labelledby={id}>
      {(titel || aktion) && (
        <h2 className={`gruppe-kopf${gross ? ' gross' : ''}`} id={id}>
          <span>{titel}</span>
          {aktion && (
            <button type="button" onClick={aktion.onClick}>
              {aktion.text}
            </button>
          )}
        </h2>
      )}
      <div className="gruppe">{children}</div>
      {fuss && <p className="gruppe-fuss">{fuss}</p>}
    </section>
  );
}

interface ZeileProps {
  symbol?: ReactNode;
  titel: ReactNode;
  unter?: ReactNode;
  wert?: ReactNode;
  wertUnter?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  label?: string;
}

export function Zeile({ symbol, titel, unter, wert, wertUnter, onClick, chevron, label }: ZeileProps) {
  const inhalt = (
    <>
      {symbol}
      <span className="zeile-inhalt">
        <span className="zeile-titel" style={{ display: 'block' }}>{titel}</span>
        {unter && <span className="zeile-unter">{unter}</span>}
      </span>
      {(wert !== undefined || wertUnter) && (
        <span className="zeile-wert">
          {wert}
          {wertUnter && <span className="zeile-unter">{wertUnter}</span>}
        </span>
      )}
      {(chevron ?? !!onClick) && <ChevronRight className="chevron" size={18} aria-hidden="true" />}
    </>
  );
  const klasse = `zeile${symbol ? ' mit-symbol' : ''}`;
  return onClick ? (
    <button type="button" className={klasse} onClick={onClick} aria-label={label}>
      {inhalt}
    </button>
  ) : (
    <div className={klasse}>{inhalt}</div>
  );
}

/**
 * Zeile mit Swipe-Aktionen: nach rechts wischen = links "Bearbeiten", nach links wischen = rechts "Pausieren".
 * Für Tastatur und VoiceOver sind die Aktionen zusätzlich über die Detailansicht erreichbar.
 */
export function SwipeZeile({ links, rechts, ...zeile }: ZeileProps & {
  links: { text: string; onClick: () => void };
  rechts: { text: string; onClick: () => void };
}) {
  const [x, setX] = useState(0);
  const [zieht, setZieht] = useState(false);
  const start = useRef<{ x: number; y: number; basis: number; aktiv: boolean | null } | null>(null);
  const BREITE = 96;

  const unten = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, basis: x, aktiv: null };
  };
  const bewegt = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.aktiv === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s.aktiv = Math.abs(dx) > Math.abs(dy);
    if (!s.aktiv) return;
    setZieht(true);
    setX(Math.max(-BREITE * 1.4, Math.min(BREITE * 1.4, s.basis + dx)));
  };
  const los = () => {
    const s = start.current;
    start.current = null;
    setZieht(false);
    if (!s?.aktiv) return;
    setX((v) => (v > BREITE / 2 ? BREITE : v < -BREITE / 2 ? -BREITE : 0));
  };

  const ausfuehren = (f: () => void) => {
    setX(0);
    f();
  };

  return (
    <div className={`swipe${zeile.symbol ? ' mit-symbol' : ''}`}>
      <div className="swipe-aktionen" aria-hidden={x === 0}>
        <button type="button" className="links" tabIndex={x > 0 ? 0 : -1} onClick={() => ausfuehren(links.onClick)}>
          {links.text}
        </button>
        <button type="button" className="rechts" tabIndex={x < 0 ? 0 : -1} onClick={() => ausfuehren(rechts.onClick)}>
          {rechts.text}
        </button>
      </div>
      <div
        className={`swipe-inhalt${zieht ? ' zieht' : ''}`}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={unten}
        onPointerMove={bewegt}
        onPointerUp={los}
        onPointerCancel={los}
        onClickCapture={(e) => {
          if (x !== 0) {
            e.stopPropagation();
            e.preventDefault();
            setX(0);
          }
        }}
      >
        <Zeile {...zeile} />
      </div>
    </div>
  );
}

export function Segment<T extends string>({ werte, wert, onChange, label }: {
  werte: { id: T; text: string }[];
  wert: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segment" role="group" aria-label={label}>
      {werte.map((w) => (
        <button key={w.id} type="button" aria-pressed={w.id === wert} onClick={() => onChange(w.id)}>
          {w.text}
        </button>
      ))}
    </div>
  );
}

export function Leer({ symbol, titel, text, aktion }: { symbol?: ReactNode; titel: string; text: string; aktion?: { text: string; onClick: () => void } }) {
  return (
    <div className="leer">
      {symbol}
      <h3>{titel}</h3>
      <p>{text}</p>
      {aktion && (
        <button type="button" className="knopf klein" onClick={aktion.onClick}>
          {aktion.text}
        </button>
      )}
    </div>
  );
}
