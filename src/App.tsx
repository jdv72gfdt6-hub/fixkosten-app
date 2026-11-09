import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db, speicherDauerhaft, speichereUnterkonto, uebernehmeAlteDaten, type Unterkonto } from './db';
import { betragFuerEingabe, formatBetrag, parseBetrag, type Cent } from './geld';

const ladeUnterkonten = () => db.unterkonten.orderBy('reihenfolge').toArray();

const fokussiere = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

/** Letzte Änderung zum Rückgängigmachen: das Unterkonto, wie es vorher war. */
interface Rueckgaengig {
  text: string;
  vorher: Unterkonto;
}

export function App() {
  const [bereit, setBereit] = useState(false);
  const konten = useLiveQuery(async () => (bereit ? await ladeUnterkonten() : undefined), [bereit]);
  // Offen ist höchstens ein Formular: die ID eines Unterkontos oder "neu".
  const [offen, setOffen] = useState<string | null>(null);
  const [letzte, setLetzte] = useState<Rueckgaengig | null>(null);

  useEffect(() => {
    void speicherDauerhaft();
    uebernehmeAlteDaten()
      .catch((e: unknown) => console.error('Übernahme fehlgeschlagen', e))
      .finally(() => setBereit(true));
  }, []);

  useEffect(() => {
    if (!letzte) return;
    const t = setTimeout(() => setLetzte(null), 6000);
    return () => clearTimeout(t);
  }, [letzte]);

  if (!konten) return <main className="seite" aria-busy="true" />;

  const gesamt = konten.reduce((s, k) => s + k.stand, 0);

  // Ein offenes Formular soll weder vom Hinweis noch vom Plus-Knopf verdeckt werden.
  const oeffne = (id: string) => {
    setLetzte(null);
    setOffen(id);
  };
  const schliesse = (fokusId: string) => {
    setOffen(null);
    fokussiere(fokusId);
  };
  const sichere = async (k: { id?: string; name: string; stand: Cent }) => {
    const id = await speichereUnterkonto(k);
    schliesse(`zeile-${id}`);
  };
  const verbuche = async (k: Unterkonto, betrag: Cent) => {
    await db.unterkonten.update(k.id, { stand: k.stand + betrag });
    setLetzte({ text: `${betrag > 0 ? '+' : ''}${formatBetrag(betrag)} bei „${k.name}“`, vorher: k });
    schliesse(`zeile-${k.id}`);
  };
  const loesche = async (k: Unterkonto) => {
    await db.unterkonten.delete(k.id);
    setLetzte({ text: `„${k.name}“ gelöscht`, vorher: k });
    schliesse('neu');
  };
  const machRueckgaengig = async () => {
    if (!letzte) return;
    await db.unterkonten.put(letzte.vorher);
    setLetzte(null);
    fokussiere(`zeile-${letzte.vorher.id}`);
  };

  return (
    <main className="seite">
      <header className="kopf">
        <h1>Trade Republic</h1>
        <p className="summe">{formatBetrag(gesamt)}</p>
        <p className="klein">Gesamtsumme</p>
      </header>

      {konten.length === 0 && offen !== 'neu' && <p className="leer">Noch keine Unterkonten. Lege mit + dein erstes an.</p>}

      {konten.length > 0 && (
        <ul className="liste" aria-label="Unterkonten">
          {konten.map((k) => (
            <li key={k.id}>
              {offen === k.id ? (
                <Formular konto={k} onSichern={sichere} onVerbuchen={(b) => verbuche(k, b)} onAbbrechen={() => schliesse(`zeile-${k.id}`)} onLoeschen={() => loesche(k)} />
              ) : (
                <button type="button" id={`zeile-${k.id}`} className="zeile" onClick={() => oeffne(k.id)}>
                  <span className="zeile-name">{k.name}</span>
                  <span className="zeile-betrag">{formatBetrag(k.stand)}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {offen === 'neu' && (
        <div className="liste">
          <Formular onSichern={sichere} onAbbrechen={() => schliesse('neu')} />
        </div>
      )}

      <div className="unten">
        {letzte && (
          <div className="hinweis" role="status">
            <span>{letzte.text}</span>
            <button type="button" onClick={() => void machRueckgaengig()}>
              Rückgängig
            </button>
          </div>
        )}
        <UpdateHinweis />
        {offen === null && (
          <button type="button" id="neu" className="plus" aria-label="Unterkonto hinzufügen" onClick={() => oeffne('neu')}>
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </main>
  );
}

function Formular({ konto, onSichern, onVerbuchen, onAbbrechen, onLoeschen }: {
  konto?: Unterkonto;
  onSichern: (k: { id?: string; name: string; stand: Cent }) => Promise<void>;
  onVerbuchen?: (betrag: Cent) => Promise<void>;
  onAbbrechen: () => void;
  onLoeschen?: () => Promise<void>;
}) {
  const [aenderung, setAenderung] = useState('');
  const [name, setName] = useState(konto?.name ?? '');
  const [betrag, setBetrag] = useState(konto ? betragFuerEingabe(konto.stand) : '');
  const [fehler, setFehler] = useState<{ aenderung?: string; name?: boolean; betrag?: boolean }>({});
  const aenderungRef = useRef<HTMLInputElement>(null);
  const betragRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const schluessel = konto?.id ?? 'neu';

  useEffect(() => {
    if (konto) aenderungRef.current?.focus();
    else nameRef.current?.focus();
  }, []); // Nur beim Öffnen.

  const verbuche = (vorzeichen: 1 | -1) => {
    const b = parseBetrag(aenderung);
    if (b === null || b <= 0) {
      setFehler({ aenderung: 'Bitte einen Betrag wie 100 oder 25,50 eingeben.' });
    } else if (vorzeichen < 0 && b > konto!.stand) {
      setFehler({ aenderung: `So viel ist nicht da. Stand: ${formatBetrag(konto!.stand)}.` });
    } else {
      void onVerbuchen!(vorzeichen * b);
      return;
    }
    aenderungRef.current?.focus();
  };

  const absenden = (e: FormEvent) => {
    e.preventDefault();
    if (aenderung.trim()) {
      setFehler({ aenderung: 'Tippe auf + oder −, um den Betrag dazuzurechnen oder abzuziehen.' });
      aenderungRef.current?.focus();
      return;
    }
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
      {onVerbuchen && (
        <>
          <label htmlFor={`aenderung-${schluessel}`}>Betrag dazu oder weg</label>
          <div className="plusminus">
            <button type="button" aria-label="Abziehen" onClick={() => verbuche(-1)}>
              −
            </button>
            <input
              id={`aenderung-${schluessel}`}
              ref={aenderungRef}
              value={aenderung}
              onChange={(e) => setAenderung(e.target.value)}
              // Enter allein sagt nicht, ob dazu oder weg.
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              inputMode="decimal"
              placeholder="0,00"
              autoComplete="off"
              aria-invalid={!!fehler.aenderung}
              aria-describedby={fehler.aenderung ? `aenderung-fehler-${schluessel}` : undefined}
            />
            <button type="button" aria-label="Dazurechnen" onClick={() => verbuche(1)}>
              +
            </button>
          </div>
          {fehler.aenderung && <p className="fehler" id={`aenderung-fehler-${schluessel}`}>{fehler.aenderung}</p>}
          <hr />
        </>
      )}

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
