import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db, speicherDauerhaft, speichereUnterkonto, uebernehmeAlteDaten, type Unterkonto } from './db';
import { betragFuerEingabe, formatBetrag, parseBetrag, type Cent } from './geld';

const ladeUnterkonten = () => db.unterkonten.orderBy('reihenfolge').toArray();

const fokussiere = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

export function App() {
  const [bereit, setBereit] = useState(false);
  const konten = useLiveQuery(async () => (bereit ? await ladeUnterkonten() : undefined), [bereit]);
  // Offen ist höchstens ein Formular: die ID eines Unterkontos oder "neu".
  const [offen, setOffen] = useState<string | null>(null);
  const [geloescht, setGeloescht] = useState<Unterkonto | null>(null);

  useEffect(() => {
    void speicherDauerhaft();
    uebernehmeAlteDaten()
      .catch((e: unknown) => console.error('Übernahme fehlgeschlagen', e))
      .finally(() => setBereit(true));
  }, []);

  useEffect(() => {
    if (!geloescht) return;
    const t = setTimeout(() => setGeloescht(null), 6000);
    return () => clearTimeout(t);
  }, [geloescht]);

  if (!konten) return <main className="seite" aria-busy="true" />;

  const gesamt = konten.reduce((s, k) => s + k.stand, 0);

  const schliesse = (fokusId: string) => {
    setOffen(null);
    fokussiere(fokusId);
  };
  const sichere = async (k: { id?: string; name: string; stand: Cent }) => {
    const id = await speichereUnterkonto(k);
    schliesse(`zeile-${id}`);
  };
  const loesche = async (k: Unterkonto) => {
    await db.unterkonten.delete(k.id);
    setGeloescht(k);
    schliesse('neu');
  };
  const stelleWiederHer = async () => {
    if (!geloescht) return;
    await db.unterkonten.put(geloescht);
    setGeloescht(null);
    fokussiere(`zeile-${geloescht.id}`);
  };

  return (
    <main className="seite">
      <header className="kopf">
        <h1>Trade Republic</h1>
        <p className="summe">{formatBetrag(gesamt)}</p>
        <p className="klein">Gesamtsumme</p>
      </header>

      {konten.length === 0 && offen !== 'neu' && <p className="leer">Noch keine Unterkonten. Lege dein erstes an.</p>}

      {konten.length > 0 && (
        <ul className="liste" aria-label="Unterkonten">
          {konten.map((k) => (
            <li key={k.id}>
              {offen === k.id ? (
                <Formular konto={k} onSichern={sichere} onAbbrechen={() => schliesse(`zeile-${k.id}`)} onLoeschen={() => loesche(k)} />
              ) : (
                <button type="button" id={`zeile-${k.id}`} className="zeile" onClick={() => setOffen(k.id)}>
                  <span className="zeile-name">{k.name}</span>
                  <span className="zeile-betrag">{formatBetrag(k.stand)}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {offen === 'neu' ? (
        <div className="liste">
          <Formular onSichern={sichere} onAbbrechen={() => schliesse('neu')} />
        </div>
      ) : (
        <button type="button" id="neu" className="hinzufuegen" onClick={() => setOffen('neu')}>
          Unterkonto hinzufügen
        </button>
      )}

      <p className="klein fuss">Nur deine eigenen Eingaben, ohne Verbindung zu Trade Republic. Es wird nichts gebucht. Alle Daten bleiben auf diesem Gerät.</p>

      <div className="hinweise">
        {geloescht && (
          <div className="hinweis" role="status">
            <span>„{geloescht.name}“ gelöscht</span>
            <button type="button" onClick={() => void stelleWiederHer()}>
              Rückgängig
            </button>
          </div>
        )}
        <UpdateHinweis />
      </div>
    </main>
  );
}

function Formular({ konto, onSichern, onAbbrechen, onLoeschen }: {
  konto?: Unterkonto;
  onSichern: (k: { id?: string; name: string; stand: Cent }) => Promise<void>;
  onAbbrechen: () => void;
  onLoeschen?: () => Promise<void>;
}) {
  const [name, setName] = useState(konto?.name ?? '');
  const [betrag, setBetrag] = useState(konto ? betragFuerEingabe(konto.stand) : '');
  const [fehler, setFehler] = useState<{ name?: boolean; betrag?: boolean }>({});
  const betragRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const schluessel = konto?.id ?? 'neu';

  useEffect(() => {
    if (konto) betragRef.current?.select();
    else nameRef.current?.focus();
  }, []); // Nur beim Öffnen.

  const absenden = (e: FormEvent) => {
    e.preventDefault();
    const stand = parseBetrag(betrag);
    const nameFehlt = !name.trim();
    const betragFalsch = stand === null || stand < 0;
    setFehler({ name: nameFehlt, betrag: betragFalsch });
    if (nameFehlt) nameRef.current?.focus();
    else if (betragFalsch) betragRef.current?.focus();
    else void onSichern({ id: konto?.id, name: name.trim(), stand: stand! });
  };

  return (
    <form className="formular" onSubmit={absenden} noValidate>
      <label htmlFor={`name-${schluessel}`}>Name</label>
      <input id={`name-${schluessel}`} ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" aria-invalid={!!fehler.name} aria-describedby={fehler.name ? `name-fehler-${schluessel}` : undefined} />
      {fehler.name && <p className="fehler" id={`name-fehler-${schluessel}`}>Bitte einen Namen eingeben.</p>}

      <label htmlFor={`betrag-${schluessel}`}>Stand in Euro</label>
      <input id={`betrag-${schluessel}`} ref={betragRef} value={betrag} onChange={(e) => setBetrag(e.target.value)} inputMode="decimal" placeholder="0,00" autoComplete="off" aria-invalid={!!fehler.betrag} aria-describedby={fehler.betrag ? `betrag-fehler-${schluessel}` : undefined} />
      {fehler.betrag && <p className="fehler" id={`betrag-fehler-${schluessel}`}>Bitte einen Betrag wie 1.234,56 eingeben.</p>}

      <div className="knoepfe">
        {onLoeschen && (
          <button type="button" className="loeschen" onClick={() => void onLoeschen()}>
            Löschen
          </button>
        )}
        <span className="abstand" />
        <button type="button" onClick={onAbbrechen}>
          Abbrechen
        </button>
        <button type="submit" className="sichern">
          Sichern
        </button>
      </div>
    </form>
  );
}

/** Hinweis, wenn eine neue Version der App bereitliegt. */
function UpdateHinweis() {
  const [verworfen, setVerworfen] = useState(false);
  const {
    needRefresh: [neu],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  if (!neu || verworfen) return null;
  return (
    <div className="hinweis" role="status">
      <span>Neue Version verfügbar</span>
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        Aktualisieren
      </button>
      <button type="button" onClick={() => setVerworfen(true)}>
        Später
      </button>
    </div>
  );
}
