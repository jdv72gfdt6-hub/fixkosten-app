import { CircleAlert, FileText } from 'lucide-react';
import { useState } from 'react';
import { speichere } from '../db/aktionen';
import { formatMonat, formatTag } from '../domain/datum';
import { formatProzent, monatlich } from '../domain/geld';
import { aktuellerBetrag, fixkostenAktivAm } from '../domain/posten';
import { finanzierungsenden, kuendigungsinfo } from '../domain/vertraege';
import { vertragUnvollstaendig } from '../domain/vollstaendigkeit';
import type { Fixkosten } from '../domain/typen';
import { useBerechnung, useDaten } from '../state/daten';
import { useAnsicht, useNav } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { istNichtMonatlich, kategorieVon, kontoVon, zeitplanText } from '../ui/hilfen';
import { Gruppe, Leer, Segment, SwipeZeile, Zeile } from '../ui/Liste';
import { Seite } from '../ui/Seite';
import { SymbolKreis } from '../ui/Symbol';
import { LueckenAbzeichen } from './Unterseiten';

/** Listenzeile eines Fixkosten-Postens mit Swipe-Aktionen (Bearbeiten / Pausieren). */
export function FixkostenZeile({ f, mitKonto }: { f: Fixkosten; mitKonto?: boolean }) {
  const { daten } = useDaten();
  const b = useBerechnung();
  const zeige = useNav((s) => s.zeigeSheet);
  const kat = kategorieVon(daten, f.kategorieId);
  const betrag = aktuellerBetrag(f.preise);
  const aktiv = fixkostenAktivAm(f, b.heute);
  const pausieren = () =>
    void speichere('fixkosten', { ...f, status: f.status === 'pausiert' ? 'aktiv' : 'pausiert' }, f.status === 'pausiert' ? `${f.name} fortgesetzt` : `${f.name} pausiert`);
  return (
    <SwipeZeile
      symbol={<SymbolKreis symbol={kat?.symbol ?? ''} farbe={kat?.farbe ?? 'gray'} />}
      titel={<span style={{ opacity: aktiv ? 1 : 0.55 }}>{f.name}</span>}
      unter={
        <>
          <span>{zeitplanText(f.zeitplan)}</span>
          {mitKonto && <span>· {kontoVon(daten, f.kontoId)?.name}</span>}
          {f.status === 'pausiert' && <span className="abzeichen grau">pausiert</span>}
          {f.status === 'gekuendigt' && <span className="abzeichen grau">gekündigt{f.endeAm ? ` zum ${formatTag(f.endeAm)}` : ''}</span>}
          {f.zielKontoId && <span className="abzeichen blau">Probe-Rate</span>}
          {f.anteil !== 100 && <span className="abzeichen grau">{f.anteil} % Anteil</span>}
          <LueckenAbzeichen refId={f.id} />
        </>
      }
      wert={<Betrag wert={betrag} />}
      wertUnter={istNichtMonatlich(f) ? <>≈ <Betrag wert={monatlich(betrag, f.zeitplan.rhythmus)} /> / Monat</> : undefined}
      onClick={() => zeige({ typ: 'fixkosten', id: f.id })}
      links={{ text: 'Bearbeiten', onClick: () => zeige({ typ: 'fixkosten', id: f.id }) }}
      rechts={{ text: f.status === 'pausiert' ? 'Fortsetzen' : 'Pausieren', onClick: pausieren }}
    />
  );
}

export function VertraegeSeite() {
  const ansicht = useAnsicht((s) => s.vertraege);
  const setze = useAnsicht((s) => s.setze);
  return (
    <Seite titel="Verträge">
      <Segment
        label="Ansicht"
        wert={ansicht}
        onChange={(v) => setze({ vertraege: v })}
        werte={[
          { id: 'alle', text: 'Alle' },
          { id: 'kuendbar', text: 'Bald kündbar' },
          { id: 'preise', text: 'Preise' },
        ]}
      />
      {ansicht === 'alle' && <Alle />}
      {ansicht === 'kuendbar' && <Kuendbar />}
      {ansicht === 'preise' && <Preise />}
    </Seite>
  );
}

function Alle() {
  const { daten } = useDaten();
  const b = useBerechnung();
  const zeige = useNav((s) => s.zeigeSheet);
  const [konto, setKonto] = useState<string>('');
  if (daten.fixkosten.length === 0) {
    return (
      <Leer
        symbol={<FileText size={36} aria-hidden="true" />}
        titel="Noch keine Fixkosten"
        text="Hier erscheinen alle regelmäßigen Abbuchungen wie Miete, Versicherungen und Abos."
        aktion={{ text: 'Ersten Posten anlegen', onClick: () => zeige({ typ: 'fixkosten' }) }}
      />
    );
  }
  const liste = daten.fixkosten.filter((f) => !konto || f.kontoId === konto);
  const kontenMitPosten = daten.konten.filter((k) => daten.fixkosten.some((f) => f.kontoId === k.id));
  return (
    <>
      <div className="chips" role="group" aria-label="Nach Konto filtern">
        <button type="button" className="chip" aria-pressed={!konto} onClick={() => setKonto('')}>
          Alle Konten
        </button>
        {kontenMitPosten.map((k) => (
          <button key={k.id} type="button" className="chip" aria-pressed={konto === k.id} onClick={() => setKonto(k.id)}>
            {k.name}
          </button>
        ))}
      </div>
      <p className="gruppe-fuss" style={{ margin: '0 4px 4px' }}>
        Tipp: Zeile nach rechts wischen zum Bearbeiten, nach links zum Pausieren.
      </p>
      {[...daten.kategorien]
        .sort((a, c) => a.reihenfolge - c.reihenfolge)
        .map((kat) => {
          const posten = liste.filter((f) => f.kategorieId === kat.id);
          if (!posten.length) return null;
          const summe = b.uebersicht.proKategorie.find((x) => x.id === kat.id);
          return (
            <Gruppe
              key={kat.id}
              titel={
                <>
                  {kat.name}
                  {!konto && summe && (
                    <span style={{ textTransform: 'none', marginLeft: 6 }}>
                      · <Betrag wert={summe.monatlich} /> / Monat
                    </span>
                  )}
                </>
              }
            >
              {posten.map((f) => (
                <FixkostenZeile key={f.id} f={f} mitKonto={!konto} />
              ))}
            </Gruppe>
          );
        })}
    </>
  );
}

function Kuendbar() {
  const { daten, roh } = useDaten();
  const b = useBerechnung();
  const zeige = useNav((s) => s.zeigeSheet);
  const offen = vertragUnvollstaendig(daten);
  const enden = finanzierungsenden(roh, b.heute);
  const jederzeit = daten.fixkosten.filter((f) => f.status === 'aktiv' && kuendigungsinfo(f, b.heute).jederzeit);
  return (
    <>
      {offen > 0 && (
        <div className="hinweis gelb">
          <CircleAlert size={20} aria-hidden="true" />
          <div>
            Bei {offen} Verträgen fehlen Beginn, Mindestlaufzeit oder Kündigungsfrist. Trage sie im Posten unter „Vertrag“ nach, dann erscheinen die Fristen hier.
          </div>
        </div>
      )}
      <Gruppe titel="Kündigungsfrist endet in 90 Tagen" fuss="Sortiert nach dem letzten Tag, an dem die Kündigung beim Anbieter eingehen muss. Als Kalenderdatei exportierbar unter Einstellungen.">
        {b.baldKuendbar.length === 0 && <Zeile titel={<span className="text-2">Keine Fristen in den nächsten 90 Tagen.</span>} />}
        {b.baldKuendbar.map(({ posten, info }) => (
          <Zeile
            key={posten.id}
            titel={posten.name}
            unter={
              <>
                Kündigen bis <strong>{formatTag(info.kuendigenBis!)}</strong> · endet {formatTag(info.laufzeitEnde!)}
                <span className={`abzeichen ${info.tageBisKuendigung! <= 14 ? 'rot' : 'gelb'}`}>noch {info.tageBisKuendigung} Tage</span>
              </>
            }
            wert={<Betrag wert={aktuellerBetrag(posten.preise)} />}
            onClick={() => zeige({ typ: 'fixkosten', id: posten.id })}
          />
        ))}
      </Gruppe>
      {jederzeit.length > 0 && (
        <Gruppe titel="Jederzeit mit Frist kündbar">
          {jederzeit.map((f) => {
            const i = kuendigungsinfo(f, b.heute);
            return <Zeile key={f.id} titel={f.name} unter={`Heute gekündigt endet er am ${formatTag(i.laufzeitEnde!)}`} wert={<Betrag wert={aktuellerBetrag(f.preise)} />} onClick={() => zeige({ typ: 'fixkosten', id: f.id })} />;
          })}
        </Gruppe>
      )}
      <Gruppe titel="Kredite und Finanzierungen">
        {enden.length === 0 && <Zeile titel={<span className="text-2">Kein Laufzeitende hinterlegt.</span>} />}
        {enden.map((e) => (
          <Zeile
            key={e.posten.id}
            titel={e.posten.name}
            unter={`Letzte Rate ${formatTag(e.letzteRate)}`}
            wert={<span className="text-gruen">Ab {formatMonat(e.freiAbMonat)}</span>}
            wertUnter={<><Betrag wert={e.mehrFreiMonatlich} /> mehr frei</>}
            onClick={() => zeige({ typ: 'fixkosten', id: e.posten.id })}
          />
        ))}
      </Gruppe>
    </>
  );
}

function Preise() {
  const b = useBerechnung();
  const zeige = useNav((s) => s.zeigeSheet);
  const liste = b.preisaenderungen;
  const summe = liste.reduce((s, p) => s + p.jahreswirkung, 0);
  return (
    <>
      <div className="kacheln">
        <div className="kachel">
          <span className="kachel-titel">Änderungen</span>
          <span className="kachel-wert">{liste.length}</span>
          <span className="kachel-unter">in den letzten 12 Monaten</span>
        </div>
        <div className="kachel">
          <span className="kachel-titel">Auswirkung</span>
          <span className="kachel-wert">
            <Betrag wert={summe} vorzeichen />
          </span>
          <span className="kachel-unter">pro Jahr</span>
        </div>
      </div>
      <Gruppe titel="Preisänderungen" fuss="Eine Änderung trägst du im Posten über „Neuer Preis ab …“ ein, oder beim Monatsabschluss mit abweichendem Betrag.">
        {liste.length === 0 && <Zeile titel={<span className="text-2">Keine Preisänderungen in den letzten 12 Monaten.</span>} />}
        {liste.map((p) => (
          <Zeile
            key={`${p.posten.id}-${p.datum}`}
            titel={p.posten.name}
            unter={
              <>
                ab {formatTag(p.datum)}: <Betrag wert={p.alt} /> → <Betrag wert={p.neu} />
              </>
            }
            wert={
              <span className={p.differenz > 0 ? 'text-rot' : 'text-gruen'}>
                <Betrag wert={p.differenz} vorzeichen /> ({formatProzent(p.prozent)})
              </span>
            }
            wertUnter={<><Betrag wert={p.jahreswirkung} vorzeichen /> / Jahr</>}
            onClick={() => zeige({ typ: 'fixkosten', id: p.posten.id })}
          />
        ))}
      </Gruppe>
    </>
  );
}
