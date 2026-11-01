import { CheckCircle2, CircleAlert, FileUp, FlaskConical, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { speichereMehrere } from '../db/aktionen';
import { ersetzeAlles } from '../db/db';
import { formatTag } from '../domain/datum';
import { aktuellerBetrag } from '../domain/posten';
import { neueId, STANDARD_KATEGORIEN, STANDARD_LEBENSBEREICHE } from '../domain/standard';
import { ruecklagenCheck } from '../domain/termine';
import { testdaten } from '../domain/testdaten';
import type { Cent, Fixkosten } from '../domain/typen';
import { aendereEinstellungen, heute, useDaten } from '../state/daten';
import { useNav } from '../state/navigation';
import { ImportSheet } from '../sheets/ImportSheet';
import { Betrag } from '../ui/Betrag';
import { BetragFeld, DatumFeld } from '../ui/Felder';
import { zeitplanText } from '../ui/hilfen';
import { Gruppe, Zeile } from '../ui/Liste';
import { SymbolKreis } from '../ui/Symbol';

type Schritt = 'start' | 'konten' | 'einkommen' | 'umbuchungen' | 'fixkosten' | 'kontostaende' | 'ergebnis';
const SCHRITTE: Schritt[] = ['konten', 'einkommen', 'umbuchungen', 'fixkosten', 'kontostaende', 'ergebnis'];

/** Geführter erster Start: Konten → Einkommen → Umbuchungen → Fixkosten → Kontostände → Rücklagen-Check. */
export function Onboarding() {
  const { daten } = useDaten();
  const [schritt, setSchritt] = useState<Schritt>(daten.konten.length ? 'kontostaende' : 'start');
  const [import_, setImport] = useState(false);
  const zeige = useNav((s) => s.zeigeSheet);
  const idx = SCHRITTE.indexOf(schritt);
  const weiter = () => setSchritt(SCHRITTE[idx + 1] ?? 'ergebnis');
  const fertig = () => void aendereEinstellungen({ onboardingFertig: true });

  const kopf = (titel: string, text: string) => (
    <>
      {idx >= 0 && (
        <div className="schritte" aria-label={`Schritt ${idx + 1} von ${SCHRITTE.length}`} style={{ justifyContent: 'flex-start' }}>
          {SCHRITTE.map((s, i) => (
            <span key={s} className={i <= idx ? 'aktiv' : ''} />
          ))}
        </div>
      )}
      <h1>{titel}</h1>
      <p className="unterzeile">{text}</p>
    </>
  );
  const unten = (weiterText = 'Weiter', deaktiviert = false) => (
    <div className="unten">
      <button type="button" className="knopf" onClick={weiter} disabled={deaktiviert}>
        {weiterText}
      </button>
      {idx > 0 && (
        <button type="button" className="knopf zweit" onClick={() => setSchritt(SCHRITTE[idx - 1]!)}>
          Zurück
        </button>
      )}
    </div>
  );

  if (schritt === 'start') {
    return (
      <div className="onboarding">
        <h1>Fixkosten</h1>
        <p className="unterzeile">Behalte Fixkosten und Konten im Blick: Reicht das Geld auf jedem Konto für alles, was dort abgebucht wird? Alle Daten bleiben auf diesem Gerät.</p>
        <Gruppe>
          <Zeile symbol={<FileUp size={24} aria-hidden="true" />} titel="Startdaten oder Backup importieren" unter="JSON-Datei, z. B. startdaten.json" onClick={() => setImport(true)} />
          <Zeile
            symbol={<ListChecks size={24} aria-hidden="true" />}
            titel="Selbst einrichten"
            unter="Konten → Einkommen → Umbuchungen → Fixkosten"
            onClick={() =>
              void speichereMehrere(
                [...STANDARD_KATEGORIEN.map((wert) => ({ tabelle: 'kategorien' as const, wert })), ...STANDARD_LEBENSBEREICHE.map((wert) => ({ tabelle: 'lebensbereiche' as const, wert }))],
                'Kategorien angelegt',
              ).then(() => setSchritt('konten'))
            }
          />
          <Zeile
            symbol={<FlaskConical size={24} aria-hidden="true" />}
            titel="Mit Testdaten ausprobieren"
            unter="Anonymes Beispiel, jederzeit ersetzbar"
            onClick={() => void ersetzeAlles(testdaten(heute()), 'Testdaten').then(fertig)}
          />
        </Gruppe>
        <p className="beratung">Orientierungshilfe, keine Finanz- oder Anlageberatung.</p>
        {import_ && <ImportSheet onSchliessen={() => setImport(false)} nachImport={() => setSchritt('kontostaende')} alsOnboarding />}
      </div>
    );
  }

  if (schritt === 'konten') {
    return (
      <div className="onboarding">
        {kopf('Deine Konten', 'Lege jedes Konto an, auf das du Geld umschichtest: z. B. Girokonto, Fixkostenkonto, Tagesgeld, Depot.')}
        <Gruppe aktion={{ text: 'Hinzufügen', onClick: () => zeige({ typ: 'konto' }) }} titel="Konten">
          {daten.konten.length === 0 && <Zeile titel={<span className="text-2">Noch keine Konten.</span>} />}
          {daten.konten.map((k) => (
            <Zeile key={k.id} symbol={<SymbolKreis symbol={k.symbol} farbe={k.farbe} />} titel={k.name} unter={k.bank} onClick={() => zeige({ typ: 'konto', id: k.id })} />
          ))}
        </Gruppe>
        {unten('Weiter', daten.konten.length === 0)}
      </div>
    );
  }

  if (schritt === 'einkommen') {
    return (
      <div className="onboarding">
        {kopf('Einkommen', 'Nettoeinkommen und auf welches Konto es eingeht.')}
        <Gruppe aktion={{ text: 'Hinzufügen', onClick: () => zeige({ typ: 'einkommen' }) }} titel="Einkommen">
          {daten.einkommen.length === 0 && <Zeile titel={<span className="text-2">Noch kein Einkommen.</span>} />}
          {daten.einkommen.map((e) => (
            <Zeile key={e.id} titel={e.name} unter={zeitplanText(e.zeitplan)} wert={<Betrag wert={aktuellerBetrag(e.historie)} />} onClick={() => zeige({ typ: 'einkommen', id: e.id })} />
          ))}
        </Gruppe>
        {unten()}
      </div>
    );
  }

  if (schritt === 'umbuchungen') {
    return (
      <div className="onboarding">
        {kopf('Umbuchungen', 'Daueraufträge zwischen deinen Konten. Sie sind keine Kosten.')}
        <Gruppe aktion={{ text: 'Hinzufügen', onClick: () => zeige({ typ: 'umbuchung' }) }} titel="Umbuchungen">
          {daten.umbuchungen.length === 0 && <Zeile titel={<span className="text-2">Noch keine Umbuchungen.</span>} />}
          {daten.umbuchungen.map((u) => (
            <Zeile key={u.id} titel={`${daten.konten.find((k) => k.id === u.vonKontoId)?.name} → ${daten.konten.find((k) => k.id === u.nachKontoId)?.name}`} wert={<Betrag wert={u.betrag} />} onClick={() => zeige({ typ: 'umbuchung', id: u.id })} />
          ))}
        </Gruppe>
        {unten()}
      </div>
    );
  }

  if (schritt === 'fixkosten') {
    return (
      <div className="onboarding">
        {kopf('Erste Fixkosten', 'Miete, Versicherungen, Abos – den Rest kannst du später ergänzen.')}
        <Gruppe aktion={{ text: 'Hinzufügen', onClick: () => zeige({ typ: 'fixkosten' }) }} titel="Fixkosten">
          {daten.fixkosten.length === 0 && <Zeile titel={<span className="text-2">Noch keine Fixkosten.</span>} />}
          {daten.fixkosten.map((f) => (
            <Zeile key={f.id} titel={f.name} unter={zeitplanText(f.zeitplan)} wert={<Betrag wert={aktuellerBetrag(f.preise)} />} onClick={() => zeige({ typ: 'fixkosten', id: f.id })} />
          ))}
        </Gruppe>
        {unten()}
      </div>
    );
  }

  if (schritt === 'kontostaende') return <Kontostaende weiter={() => setSchritt('ergebnis')} />;
  return <Ergebnis fertig={fertig} />;
}

function Kontostaende({ weiter }: { weiter: () => void }) {
  const { daten } = useDaten();
  const [werte, setWerte] = useState<Record<string, Cent | null>>({});
  const offeneRaten = daten.fixkosten.filter((f) => f.finanzierung && !f.finanzierung.letzteRate);
  const [raten, setRaten] = useState<Record<string, string | null>>({});
  const sichern = async () => {
    const t = heute();
    await speichereMehrere(
      [
        ...Object.entries(werte)
          .filter(([, v]) => v !== null)
          .map(([kontoId, betrag]) => ({ tabelle: 'kontostaende' as const, wert: { id: neueId('s'), kontoId, datum: t, betrag: betrag!, quelle: 'manuell' as const, erfasst: Date.now() } })),
        ...offeneRaten
          .filter((f) => raten[f.id])
          .map((f) => ({ tabelle: 'fixkosten' as const, wert: { ...f, finanzierung: { ...f.finanzierung, letzteRate: raten[f.id]! } } as Fixkosten })),
      ],
      'Kontostände gespeichert',
    );
    weiter();
  };
  return (
    <div className="onboarding">
      <h1>Kontostände</h1>
      <p className="unterzeile">Trage die heutigen Stände ein. Damit prüft die App, ob jedes Konto bis zur nächsten Jahreszahlung reicht. Leer lassen geht auch.</p>
      <Gruppe titel={`Stand vom ${formatTag(heute())}`}>
        {daten.konten.map((k) => (
          <BetragFeld key={k.id} label={k.name} wert={werte[k.id] ?? null} onChange={(v) => setWerte({ ...werte, [k.id]: v })} erlaubeLeer negativErlaubt />
        ))}
      </Gruppe>
      {offeneRaten.length > 0 && (
        <Gruppe titel="Ratenzahlungen" fuss="Wann ist die letzte Rate? Danach fällt der Betrag automatisch aus der Prognose. Optional.">
          {offeneRaten.map((f) => (
            <DatumFeld key={f.id} label={`${f.name}: letzte Rate`} wert={raten[f.id] ?? null} onChange={(v) => setRaten({ ...raten, [f.id]: v })} optional />
          ))}
        </Gruppe>
      )}
      <div className="unten">
        <button type="button" className="knopf" onClick={() => void sichern()}>
          Weiter
        </button>
      </div>
    </div>
  );
}

function Ergebnis({ fertig }: { fertig: () => void }) {
  const { roh, daten } = useDaten();
  const h = heute();
  const fixkonten = daten.konten.filter((k) => k.rolle === 'fixkosten');
  return (
    <div className="onboarding">
      <h1>Rücklagen-Check</h1>
      <p className="unterzeile">Reicht das Geld auf deinen Fixkostenkonten für die nächsten Jahres- und Halbjahreszahlungen?</p>
      {fixkonten.map((k) => {
        const r = ruecklagenCheck(roh, k.id, h, 4);
        return (
          <Gruppe key={k.id} titel={`${k.name} bis ${formatTag(r.bis)}`}>
            {r.ohneStand ? (
              <Zeile titel={<span className="text-2">Ohne Kontostand nicht prüfbar. Trage ihn im Konto nach.</span>} />
            ) : (
              <>
                {r.faellig.map((e) => (
                  <Zeile key={e.schluessel} titel={e.name} unter={`${formatTag(e.datum)}${e.angenommen ? ' · Tag angenommen' : ''}`} wert={<Betrag wert={e.betrag} />} />
                ))}
                <Zeile titel="Tiefster Stand" unter={formatTag(r.tiefsterTag)} wert={<Betrag wert={r.tiefsterSaldo} faerben={r.tiefsterSaldo < 0} />} />
                <div className="zeile">
                  {r.fehlbetrag === 0 ? (
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <CheckCircle2 size={22} color="var(--gruen)" aria-hidden="true" /> Die Rücklagen reichen – der Mindestpuffer wird nie unterschritten.
                    </span>
                  ) : (
                    <span style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <CircleAlert size={22} color="var(--rot)" aria-hidden="true" />
                      <span>
                        Es fehlen <strong><Betrag wert={r.fehlbetrag} /></strong>, damit der Puffer von <Betrag wert={k.mindestpuffer} kurz /> hält. Überweise den Betrag einmalig auf {k.name}.
                      </span>
                    </span>
                  )}
                </div>
              </>
            )}
          </Gruppe>
        );
      })}
      <p className="gruppe-fuss" style={{ marginTop: 12 }}>Fehlende Abbuchungstage werden vorsichtshalber am 1. des Monats angenommen. Trage sie nach, dann wird der Check genauer.</p>
      <div className="unten">
        <button type="button" className="knopf" onClick={fertig}>
          Zur App
        </button>
      </div>
    </div>
  );
}
