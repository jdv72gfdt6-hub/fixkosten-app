import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  titel: string;
  onSchliessen: () => void;
  links?: { text: string; onClick: () => void };
  rechts?: { text: string; onClick: () => void; deaktiviert?: boolean };
  children: ReactNode;
}

/** Bottom Sheet aus Glas, mit Escape und Fokus-Verwaltung. */
export function Sheet({ titel, onSchliessen, links, rechts, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const zuletzt = useRef<Element | null>(null);

  useEffect(() => {
    zuletzt.current = document.activeElement;
    const el = ref.current;
    const erstes = el?.querySelector<HTMLElement>('input, select, textarea, button:not(.links-knopf)');
    erstes?.focus({ preventScroll: true });
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSchliessen();
      if (e.key === 'Tab' && el) {
        const fokusierbar = [...el.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')].filter((x) => !x.hasAttribute('disabled') && x.tabIndex !== -1);
        const a = fokusierbar[0];
        const z = fokusierbar.at(-1);
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z?.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a?.focus();
        }
      }
    };
    document.addEventListener('keydown', taste);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', taste);
      document.body.style.overflow = '';
      (zuletzt.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="schleier" onClick={onSchliessen} aria-hidden="true" />
      <div className="sheet glas" role="dialog" aria-modal="true" aria-label={titel} ref={ref}>
        <div className="sheet-griff" aria-hidden="true" />
        <div className="sheet-kopf">
          <button type="button" className="links-knopf" onClick={links?.onClick ?? onSchliessen}>
            {links?.text ?? 'Abbrechen'}
          </button>
          <h2>{titel}</h2>
          {rechts ? (
            <button type="button" className="rechts-knopf" onClick={rechts.onClick} disabled={rechts.deaktiviert}>
              {rechts.text}
            </button>
          ) : (
            <span />
          )}
        </div>
        <div className="sheet-inhalt">{children}</div>
      </div>
    </>
  );
}
