import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db, speicherDauerhaft, speichere, uebernehmeAlteDaten, type Eintrag, type Spartopf } from './db';
import { betragFuerEingabe, formatBetrag, formatMonat, parseBetrag, type Cent } from './geld';

type Seite = 'konto' | 'toepfe';
type Tabelle = 'unterkonten' | 'spartoepfe';

/** Was ein Formular speichert. Ziel und Datum gibt es nur bei Spartöpfen. */
interface Werte {
  id?: string;
  name: string;
  stand: Cent;
  ziel: Cent | null;
  bis: string | null;
}

/** Letzte Änderung zum Rückgängigmachen: der Eintrag, wie er vorher war. */
interface Rueckgaengig {
  text: string;
  tabelle: Tabelle;
  vorher: Eintrag;
}

const TEXTE = {
  konto: { titel: 'Trade Republic', liste: 'Unterkonten', leer: 'Noch keine Unterkonten. Lege mit + dein erstes an.', neu: 'Unterkonto hinzufügen' },
  toepfe: { titel: 'Spartöpfe', liste: 'Spartöpfe', leer: 'Noch keine Spartöpfe. Lege mit + deinen ersten an.', neu: 'Spartopf hinzufügen' },
};

const lade = <T extends Eintrag>(tabelle: Tabelle) => db.table<T, string>(tabelle).orderBy('reihenfolge').toArray();

const fokussiere = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

export function App() {
  const [bereit, setBereit] = useState(false);
  const [seite, setSeite] = useState<Seite>('konto');
  const konten = useLiveQuery(async () => (bereit ? await lade<Eintrag>('unterkonten') : undefined), [bereit]);
  const toepfe = useLiveQuery(async () => (bereit ? await lade<Spartopf>('spartoepfe') : undefined), [bereit]);
  // Offen ist höchstens ein Formular: die ID eines Eintrags oder "neu".
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

  if (!konten || !toepfe) return <main className="seite" aria-busy="true" />;

  const tabelle: Tabelle = seite === 'konto' ? 'unterkonten' : 'spartoepfe';
  const eintraege: (Eintrag | Spartopf)[] = seite === 'konto' ? konten : toepfe;
  const texte = TEXTE[seite];
  const gesamt = eintraege.reduce((s, e) => s + e.stand, 0);

  const wechsle = (s: Seite) => {
    setOffen(null);
    setSeite(s);
  };
  // Ein offenes Formular soll weder vom Hinweis noch vom Plus-Knopf verdeckt werden.
  const oeffne = (id: string) => {
    setLetzte(null);
    setOffen(id);
  };
  const schliesse = (fokusId: string) => {
    setOffen(null);
    fokussiere(fokusId);
  };
  const sichere = async (w: Werte) => {
    const id = seite === 'konto' ? await speichere(db.unterkonten, { id: w.id, name: w.name, stand: w.stand }) : await speichere(db.spartoepfe, w);
    schliesse(`zeile-${id}`);
  };
  const verbuche = async (e: Eintrag, betrag: Cent) => {
    await db.table(tabelle).update(e.id, { stand: e.stand + betrag });
    setLetzte({ text: `${betrag > 0 ? '+' : ''}${formatBetrag(betrag)} bei „${e.name}“`, tabelle, vorher: e });
    schliesse(`zeile-${e.id}`);
  };
  const loesche = async (e: Eintrag) => {
    await db.table(tabelle).delete(e.id);
    setLetzte({ text: `„${e.name}“ gelöscht`, tabelle, vorher: e });
    schliesse('neu');
  };
  const machRueckgaengig = async () => {
    if (!letzte) return;
    await db.table(letzte.tabelle).put(letzte.vorher);
    setLetzte(null);
    fokussiere(`zeile-${letzte.vorher.id}`);
  };

  return (
    <main className="seite">
      <nav className="umschalter" aria-label="Seiten">
        <button type="button" aria-current={seite === 'konto' ? 'page' : undefined} onClick={() => wechsle('konto')}>
          Konto
        </button>
        <button type="button" aria-current={seite === 'toepfe' ? 'page' : undefined} onClick={() => wechsle('toepfe')}>
          Spartöpfe
        </button>
      </nav>

      <header className="kopf">
        <h1>{texte.titel}</h1>
        <p className="summe">{formatBetrag(gesamt)}</p>
        <p className="klein">{seite === 'konto' ? 'Gesamtsumme' : zieleText(toepfe)}</p>
      </header>

      {eintraege.length === 0 && offen !== 'neu' && <p className="leer">{texte.leer}</p>}

      {eintraege.length > 0 && (
        <ul className="liste" aria-label={texte.liste}>
          {eintraege.map((e) => (
            <li key={e.id}>
              {offen === e.id ? (
                <Formular topf={seite === 'toepfe'} eintrag={e} onSichern={sichere} onVerbuchen={(b) => verbuche(e, b)} onAbbrechen={() => schliesse(`zeile-${e.id}`)} onLoeschen={() => loesche(e)} />
              ) : (
                <button type="button" id={`zeile-${e.id}`} className="zeile" onClick={() => oeffne(e.id)}>
                  <span className="zeile-name">{e.name}</span>
                  <span className="zeile-betrag">{formatBetrag(e.stand)}</span>
                  {'ziel' in e && <TopfFortschritt topf={e} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {offen === 'neu' && (
        <div className="liste">
          <Formular topf={seite === 'toepfe'} onSichern={sichere} onAbbrechen={() => schliesse('neu')} />
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
          <button type="button" id="neu" className="plus" aria-label={texte.neu} onClick={() => oeffne('neu')}>
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </main>
  );
}

/** Unter der Summe der Spartöpfe: wie weit alle Ziele zusammen erreicht sind. */
function zieleText(toepfe: Spartopf[]): string {
  const mitZiel = toepfe.filter((t) => t.ziel);
  const ziele = mitZiel.reduce((s, t) => s + t.ziel!, 0);
  if (!ziele) return 'Gesamtsumme';
  const erreicht = mitZiel.reduce((s, t) => s + Math.min(Math.max(t.stand, 0), t.ziel!), 0);
  return `Ziele zusammen ${formatBetrag(ziele, true)} · ${Math.floor((erreicht / ziele) * 100)} % erreicht`;
}

function TopfFortschritt({ topf: t }: { topf: Spartopf }) {
  const bis = t.bis ? `bis ${formatMonat(t.bis)}` : '';
  if (!t.ziel) return bis ? <span className="zeile-details klein">{bis}</span> : null;
  const fertig = t.stand >= t.ziel;
  const anteil = Math.min(1, Math.max(0, t.stand / t.ziel));
  return (
    <span className="zeile-details">
      <span className={`balken${fertig ? ' voll' : ''}`} aria-hidden="true">
        <span style={{ width: `${Math.floor(anteil * 100)}%` }} />
      </span>
      {fertig ? (
        <span className="erreicht">✓ Ziel von {formatBetrag(t.ziel, true)} erreicht</span>
      ) : (
        <span className="klein">
          von {formatBetrag(t.ziel, true)} · noch {formatBetrag(t.ziel - t.stand, true)} <span className="am-stueck">{bis}</span>
        </span>
      )}
    </span>
  );
}

function Formular({ topf, eintrag, onSichern, onVerbuchen, onAbbrechen, onLoeschen }: {
  topf: boolean;
  eintrag?: Eintrag | Spartopf;
  onSichern: (w: Werte) => Promise<void>;
  onVerbuchen?: (betrag: Cent) => Promise<void>;
  onAbbrechen: () => void;
  onLoeschen?: () => Promise<void>;
}) {
  const alt = eintrag && 'ziel' in eintrag ? eintrag : undefined;
  const [aenderung, setAenderung] = useState('');
  const [name, setName] = useState(eintrag?.name ?? '');
  const [betrag, setBetrag] = useState(eintrag ? betragFuerEingabe(eintrag.stand) : '');
  const [ziel, setZiel] = useState(alt?.ziel ? betragFuerEingabe(alt.ziel) : '');
  const [bis, setBis] = useState(alt?.bis ?? '');
  const [fehler, setFehler] = useState<{ aenderung?: string; name?: boolean; betrag?: boolean; ziel?: boolean }>({});
  const aenderungRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const betragRef = useRef<HTMLInputElement>(null);
  const zielRef = useRef<HTMLInputElement>(null);
  const s = eintrag?.id ?? 'neu';

  useEffect(() => {
    if (eintrag) aenderungRef.current?.focus();
    else nameRef.current?.focus();
  }, []); // Nur beim Öffnen.

  const verbuche = (vorzeichen: 1 | -1) => {
    const b = parseBetrag(aenderung);
    if (b === null || b <= 0) {
      setFehler({ aenderung: 'Bitte einen Betrag wie 100 oder 25,50 eingeben.' });
    } else if (vorzeichen < 0 && b > eintrag!.stand) {
      setFehler({ aenderung: `So viel ist nicht da. Stand: ${formatBetrag(eintrag!.stand)}.` });
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
    const zielWert = ziel.trim() ? parseBetrag(ziel) : null;
    const f = { name: !name.trim(), betrag: stand === null || stand < 0, ziel: !!ziel.trim() && (zielWert === null || zielWert <= 0) };
    setFehler(f);
    if (f.name) nameRef.current?.focus();
    else if (f.betrag) betragRef.current?.focus();
    else if (f.ziel) zielRef.current?.focus();
    else void onSichern({ id: eintrag?.id, name: name.trim(), stand: stand!, ziel: zielWert, bis: bis || null });
  };

  const feld = (id: string, fehlt: boolean | undefined) => ({ id: `${id}-${s}`, 'aria-invalid': !!fehlt, 'aria-describedby': fehlt ? `${id}-fehler-${s}` : undefined });

  return (
    <form className="formular" onSubmit={absenden} noValidate>
      {onVerbuchen && (
        <>
          <label htmlFor={`aenderung-${s}`}>Betrag dazu oder weg</label>
          <div className="plusminus">
            <button type="button" aria-label="Abziehen" onClick={() => verbuche(-1)}>
              −
            </button>
            <input
              {...feld('aenderung', !!fehler.aenderung)}
              ref={aenderungRef}
              value={aenderung}
              onChange={(e) => setAenderung(e.target.value)}
              // Enter allein sagt nicht, ob dazu oder weg.
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              inputMode="decimal"
              placeholder="0,00"
              autoComplete="off"
            />
            <button type="button" aria-label="Dazurechnen" onClick={() => verbuche(1)}>
              +
            </button>
          </div>
          {fehler.aenderung && <p className="fehler" id={`aenderung-fehler-${s}`}>{fehler.aenderung}</p>}
          <hr />
        </>
      )}

      <label htmlFor={`name-${s}`}>Name</label>
      <input {...feld('name', fehler.name)} ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
      {fehler.name && <p className="fehler" id={`name-fehler-${s}`}>Bitte einen Namen eingeben.</p>}

      <label htmlFor={`betrag-${s}`}>{topf ? 'Gespart in Euro' : 'Stand in Euro'}</label>
      <input {...feld('betrag', fehler.betrag)} ref={betragRef} value={betrag} onChange={(e) => setBetrag(e.target.value)} inputMode="decimal" placeholder="0,00" autoComplete="off" />
      {fehler.betrag && <p className="fehler" id={`betrag-fehler-${s}`}>Bitte einen Betrag wie 1.234,56 eingeben.</p>}

      {topf && (
        <>
          <label htmlFor={`ziel-${s}`}>Ziel in Euro (freiwillig)</label>
          <input {...feld('ziel', fehler.ziel)} ref={zielRef} value={ziel} onChange={(e) => setZiel(e.target.value)} inputMode="decimal" placeholder="z. B. 1.500" autoComplete="off" />
          {fehler.ziel && <p className="fehler" id={`ziel-fehler-${s}`}>Bitte ein Ziel über 0 wie 1.500 eingeben oder das Feld leer lassen.</p>}

          <label htmlFor={`bis-${s}`}>Bis wann (freiwillig)</label>
          <input id={`bis-${s}`} type="month" value={bis} onChange={(e) => setBis(e.target.value)} />
        </>
      )}

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
