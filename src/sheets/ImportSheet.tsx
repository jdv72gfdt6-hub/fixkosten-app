import { FileUp } from 'lucide-react';
import { useState } from 'react';
import { ersetzeAlles } from '../db/db';
import { pruefeBackup, type PruefErgebnis } from '../domain/backup';
import { aendereEinstellungen } from '../state/daten';
import { Gruppe, Zeile } from '../ui/Liste';
import { Sheet } from '../ui/Sheet';

const NAMEN: Record<string, string> = {
  konten: 'Konten',
  kontostaende: 'Kontostände',
  einkommen: 'Einkommen',
  umbuchungen: 'Umbuchungen',
  fixkosten: 'Fixkosten',
  sparplaene: 'Sparpläne',
  ruecklagen: 'Rücklagen',
  budgets: 'Budgets',
  einmalig: 'Einmalige',
  kategorien: 'Kategorien',
  lebensbereiche: 'Lebensbereiche',
};

/** Backup einlesen: Datei prüfen, Vorschau zeigen, erst nach Bestätigung ersetzen. */
export function ImportSheet({ onSchliessen, nachImport, alsOnboarding }: { onSchliessen: () => void; nachImport?: () => void; alsOnboarding?: boolean }) {
  const [ergebnis, setErgebnis] = useState<PruefErgebnis | null>(null);
  const [datei, setDatei] = useState('');
  const [laeuft, setLaeuft] = useState(false);

  const lesen = async (f: File) => {
    setDatei(f.name);
    try {
      setErgebnis(pruefeBackup(JSON.parse(await f.text())));
    } catch {
      setErgebnis({ ok: false, fehler: ['Die Datei ist kein gültiges JSON.'] });
    }
  };

  const einspielen = async () => {
    if (!ergebnis?.ok) return;
    setLaeuft(true);
    const { daten, einstellungen, abschluss } = ergebnis.backup;
    // Im Onboarding geht es danach mit den Kontoständen weiter, sonst direkt zur App.
    await ersetzeAlles(daten, `Vor Import von ${datei}`, undefined, { ...(einstellungen ?? {}), onboardingFertig: !alsOnboarding }, abschluss);
    await aendereEinstellungen({ onboardingFertig: !alsOnboarding });
    onSchliessen();
    nachImport?.();
  };

  return (
    <Sheet titel="Backup importieren" onSchliessen={onSchliessen}>
      <label className="knopf zweit" style={{ cursor: 'pointer' }}>
        <FileUp size={20} aria-hidden="true" /> Datei auswählen
        <input type="file" accept="application/json,.json" className="nur-screenreader" onChange={(e) => e.target.files?.[0] && void lesen(e.target.files[0])} />
      </label>
      {ergebnis && !ergebnis.ok && (
        <div className="hinweis rot" style={{ marginTop: 12 }}>
          <div>
            <strong>Import nicht möglich</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {ergebnis.fehler.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {ergebnis?.ok && (
        <>
          <Gruppe titel={`Vorschau: ${datei}`} fuss="Beim Einspielen werden ALLE aktuellen Daten ersetzt. Vorher legt die App automatisch eine interne Sicherung an.">
            {Object.entries(ergebnis.vorschau.anzahl)
              .filter(([, n]) => n > 0)
              .map(([t, n]) => (
                <Zeile key={t} titel={NAMEN[t] ?? t} wert={<span className="zahl">{n}</span>} />
              ))}
          </Gruppe>
          <div style={{ marginTop: 16 }}>
            <button type="button" className="knopf" disabled={laeuft} onClick={() => confirm('Alle aktuellen Daten durch das Backup ersetzen?') && void einspielen()}>
              Backup einspielen
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
