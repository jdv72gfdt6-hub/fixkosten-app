import { ChevronLeft, MoreHorizontal, Plus, Search } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNav } from '../state/navigation';

interface Props {
  titel: string;
  zurueck?: string;
  children: ReactNode;
  /** Zusätzliche Knöpfe in der Glas-Kapsel oben rechts. */
  kapsel?: ReactNode;
  mitKapsel?: boolean;
}

/**
 * Seite mit großem Titel, der beim Scrollen in die Navigationsleiste wandert,
 * und schwebender Glas-Kapsel oben rechts (Suche, Hinzufügen, Mehr).
 */
export function Seite({ titel, zurueck, children, kapsel, mitKapsel = true }: Props) {
  const titelRef = useRef<HTMLHeadingElement>(null);
  const [eingeklappt, setEingeklappt] = useState(false);
  const { zurueck: geheZurueck, zeigeSheet, wechsleTab } = useNav();

  useEffect(() => {
    window.scrollTo(0, 0);
    const el = titelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setEingeklappt(!e!.isIntersecting), { rootMargin: '-56px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [titel]);

  return (
    <>
      <header className={`navleiste${eingeklappt ? ' eingeklappt' : ''}`}>
        <div className="navleiste-hintergrund glas" style={{ boxShadow: 'none', borderLeft: 0, borderRight: 0, borderTop: 0 }} />
        {zurueck && (
          <button type="button" className="zurueck glas tippbar" onClick={geheZurueck}>
            <ChevronLeft size={22} aria-hidden="true" /> {zurueck}
          </button>
        )}
        <span className="navleiste-titel" aria-hidden="true">
          {titel}
        </span>
        <span className="abstand" />
        {mitKapsel && (
          <div className="kapsel glas" role="toolbar" aria-label="Aktionen">
            {kapsel}
            <button type="button" aria-label="Suchen" onClick={() => zeigeSheet({ typ: 'suche' })}>
              <Search size={20} />
            </button>
            <button type="button" aria-label="Hinzufügen" onClick={() => zeigeSheet({ typ: 'neu' })}>
              <Plus size={22} />
            </button>
            <button type="button" aria-label="Mehr: Einstellungen" onClick={() => wechsleTab('einstellungen')}>
              <MoreHorizontal size={22} />
            </button>
          </div>
        )}
      </header>
      <main className="seite">
        <h1 className="seite-titel" ref={titelRef}>
          {titel}
        </h1>
        {children}
      </main>
    </>
  );
}
