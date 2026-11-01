import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { rueckgaengig, useRueckgaengig } from '../db/aktionen';

/** Nach jeder Änderung kurz "Rückgängig" anbieten. */
export function RueckgaengigToast() {
  const letzter = useRueckgaengig((s) => s.letzter);
  const setze = useRueckgaengig((s) => s.setze);
  useEffect(() => {
    if (!letzter) return;
    const t = setTimeout(() => setze(null), 6000);
    return () => clearTimeout(t);
  }, [letzter, setze]);
  if (!letzter) return null;
  return (
    <div className="toast glas" role="status">
      <span>{letzter.text}</span>
      <button type="button" onClick={() => void rueckgaengig()}>
        Rückgängig
      </button>
    </div>
  );
}

/** Hinweis, wenn eine neue Version der App bereitliegt. */
export function UpdateHinweis() {
  const [verworfen, setVerworfen] = useState(false);
  const {
    needRefresh: [neu],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  if (!neu || verworfen) return null;
  return (
    <div className="toast glas" role="status" style={{ bottom: 'calc(var(--tabbar-hoehe) + var(--sicher-unten) + 150px)' }}>
      <span>Neue Version verfügbar</span>
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        Aktualisieren
      </button>
      <button type="button" aria-label="Später" onClick={() => setVerworfen(true)}>
        Später
      </button>
    </div>
  );
}
