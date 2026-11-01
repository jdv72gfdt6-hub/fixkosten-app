import { useState } from 'react';
import { inPapierkorb, speichere } from '../db/aktionen';
import { formatTag } from '../domain/datum';
import { formatProzent } from '../domain/geld';
import { aktuellerBetrag } from '../domain/posten';
import { neueId, neuerFixkostenPosten, VORLAGEN, zeitplan } from '../domain/standard';
import { kuendigungsinfo } from '../domain/vertraege';
import type { Fixkosten, Fristeinheit, Zahlungsart } from '../domain/typen';
import { aendereEinstellungen, heute, useDaten } from '../state/daten';
import { useNav } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { AuswahlFeld, BetragFeld, DatumFeld, KontoFeld, NotizFeld, SchalterFeld, TextFeld, ZahlFeld, ZeitplanFelder } from '../ui/Felder';
import { Gruppe, Zeile } from '../ui/Liste';
import { Sheet } from '../ui/Sheet';

const ZAHLUNGSARTEN: { wert: Zahlungsart; text: string }[] = [
  { wert: 'lastschrift', text: 'Lastschrift' },
  { wert: 'dauerauftrag', text: 'Dauerauftrag' },
  { wert: 'kreditkarte', text: 'Kreditkarte' },
  { wert: 'paypal', text: 'PayPal' },
  { wert: 'ueberweisung', text: 'Überweisung' },
];

export function FixkostenSheet({ id, vorlageKontoId, onSchliessen }: { id?: string; vorlageKontoId?: string; onSchliessen: () => void }) {
  const { daten, einstellungen } = useDaten();
  const vorhanden = id ? daten.fixkosten.find((f) => f.id === id) : undefined;
  const standardKonto = vorlageKontoId ?? einstellungen.zuletztGenutztesKontoId ?? daten.konten.find((k) => k.rolle === 'fixkosten')?.id ?? daten.konten[0]?.id ?? '';
  const [f, setF] = useState<Fixkosten>(
    () => vorhanden ?? neuerFixkostenPosten({ name: '', kontoId: standardKonto, lebensbereichId: undefined }, heute()),
  );
  const [schritt, setSchritt] = useState(0);
  const neu = !vorhanden;

  const betrag = aktuellerBetrag(f.preise);
  const setzeBetrag = (b: number | null) => {
    const preise = [...f.preise].sort((a, c) => (a.gueltigAb < c.gueltigAb ? -1 : 1));
    preise[preise.length - 1] = { ...preise.at(-1)!, betrag: b ?? 0 };
    setF({ ...f, preise });
  };
  const gueltig = f.name.trim() !== '' && !!f.kontoId;

  const sichern = async () => {
    if (!gueltig) return;
    const konto = daten.konten.find((k) => k.id === f.kontoId);
    const wert: Fixkosten = { ...f, name: f.name.trim(), zahlungsart: konto?.typ === 'kreditkarte' ? 'kreditkarte' : f.zahlungsart };
    await speichere('fixkosten', wert, neu ? `${wert.name} angelegt` : `${wert.name} gespeichert`);
    await aendereEinstellungen({ zuletztGenutztesKontoId: f.kontoId });
    onSchliessen();
  };

  if (neu) {
    return (
      <Sheet titel="Neuer Posten" onSchliessen={onSchliessen} rechts={{ text: 'Sichern', onClick: () => void sichern(), deaktiviert: !gueltig }}>
        <div className="schritte" aria-label={`Schritt ${schritt + 1} von 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i === schritt ? 'aktiv' : ''} />
          ))}
        </div>
        {schritt === 0 && (
          <>
            <div className="chips" role="group" aria-label="Vorlagen">
              {VORLAGEN.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  className="chip"
                  onClick={() =>
                    setF({
                      ...f,
                      name: v.name,
                      kategorieId: v.kategorieId,
                      lebensbereichId: v.lebensbereichId,
                      steuerlich: !!v.steuerlich,
                      zeitplan: { ...zeitplan(v.rhythmus, v.tag ?? 1), ankerMonat: v.rhythmus === 'monatlich' ? null : f.zeitplan.ankerMonat },
                      preise: v.betrag ? [{ gueltigAb: f.preise[0]!.gueltigAb, betrag: v.betrag }] : f.preise,
                    })
                  }
                >
                  {v.name}
                </button>
              ))}
            </div>
            <div className="gruppe">
              <TextFeld label="Name" wert={f.name} onChange={(name) => setF({ ...f, name })} platzhalter="z. B. Strom" autoFocus />
              <BetragFeld key={f.name} label="Betrag pro Zahlung" wert={betrag} onChange={setzeBetrag} gross />
            </div>
          </>
        )}
        {schritt === 1 && (
          <div className="gruppe">
            <ZeitplanFelder wert={f.zeitplan} onChange={(z) => setF({ ...f, zeitplan: z })} />
          </div>
        )}
        {schritt === 2 && (
          <div className="gruppe">
            <KontoFeld label="Konto" wert={f.kontoId} onChange={(kontoId) => setF({ ...f, kontoId })} konten={daten.konten} />
            <AuswahlFeld label="Kategorie" wert={f.kategorieId} onChange={(kategorieId) => setF({ ...f, kategorieId })} optionen={daten.kategorien.map((k) => ({ wert: k.id, text: k.name }))} />
            <AuswahlFeld label="Lebensbereich" wert={f.lebensbereichId ?? ''} onChange={(v) => setF({ ...f, lebensbereichId: v || undefined })} optionen={[{ wert: '', text: 'Keiner' }, ...daten.lebensbereiche.map((l) => ({ wert: l.id, text: l.name }))]} />
            <AuswahlFeld label="Zahlungsart" wert={f.zahlungsart} onChange={(zahlungsart) => setF({ ...f, zahlungsart })} optionen={ZAHLUNGSARTEN} />
          </div>
        )}
        <div className="knopf-reihe" style={{ marginTop: 16 }}>
          {schritt > 0 && (
            <button type="button" className="knopf zweit" onClick={() => setSchritt(schritt - 1)}>
              Zurück
            </button>
          )}
          {schritt < 2 ? (
            <button type="button" className="knopf" onClick={() => setSchritt(schritt + 1)} disabled={schritt === 0 && !f.name.trim()}>
              Weiter
            </button>
          ) : (
            <button type="button" className="knopf" onClick={() => void sichern()} disabled={!gueltig}>
              Sichern
            </button>
          )}
        </div>
        <p className="gruppe-fuss">Standard: monatlich am 1., zuletzt genutztes Konto. „Sichern“ geht jederzeit.</p>
      </Sheet>
    );
  }
  return <FixkostenBearbeiten f={f} setF={setF} onSchliessen={onSchliessen} sichern={sichern} />;
}

function FixkostenBearbeiten({ f, setF, onSchliessen, sichern }: { f: Fixkosten; setF: (f: Fixkosten) => void; onSchliessen: () => void; sichern: () => Promise<void> }) {
  const { daten } = useDaten();
  const zeigeSheet = useNav((s) => s.zeigeSheet);
  const [neuerPreis, setNeuerPreis] = useState<{ ab: string | null; betrag: number | null }>({ ab: heute(), betrag: null });
  const betrag = aktuellerBetrag(f.preise);
  const preise = [...f.preise].sort((a, c) => (a.gueltigAb < c.gueltigAb ? -1 : 1));
  const v = f.vertrag ?? {};
  const info = kuendigungsinfo(f, heute());
  const setzeBetrag = (b: number | null) => {
    const p = [...preise];
    p[p.length - 1] = { ...p.at(-1)!, betrag: b ?? 0 };
    setF({ ...f, preise: p });
  };

  return (
    <Sheet titel={f.name || 'Posten'} onSchliessen={onSchliessen} rechts={{ text: 'Sichern', onClick: () => void sichern(), deaktiviert: !f.name.trim() }}>
      <div className="gruppe">
        <TextFeld label="Name" wert={f.name} onChange={(name) => setF({ ...f, name })} />
        <TextFeld label="Anbieter" wert={f.anbieter ?? ''} onChange={(anbieter) => setF({ ...f, anbieter })} platzhalter="optional" />
        <BetragFeld label="Betrag" wert={betrag} onChange={setzeBetrag} />
      </div>
      <p className="gruppe-fuss">„Betrag“ korrigiert den aktuellen Preis. Für eine Preisänderung unten „Neuer Preis ab“ nutzen – so bleibt die Historie erhalten.</p>

      <Gruppe titel="Zahlung">
        <ZeitplanFelder wert={f.zeitplan} onChange={(z) => setF({ ...f, zeitplan: z })} />
        <KontoFeld label="Konto" wert={f.kontoId} onChange={(kontoId) => setF({ ...f, kontoId })} konten={daten.konten} />
        <AuswahlFeld label="Zahlungsart" wert={f.zahlungsart} onChange={(zahlungsart) => setF({ ...f, zahlungsart })} optionen={ZAHLUNGSARTEN} />
      </Gruppe>

      <Gruppe titel="Einordnung">
        <AuswahlFeld label="Kategorie" wert={f.kategorieId} onChange={(kategorieId) => setF({ ...f, kategorieId })} optionen={daten.kategorien.map((k) => ({ wert: k.id, text: k.name }))} />
        <AuswahlFeld label="Lebensbereich" wert={f.lebensbereichId ?? ''} onChange={(x) => setF({ ...f, lebensbereichId: x || undefined })} optionen={[{ wert: '', text: 'Keiner' }, ...daten.lebensbereiche.map((l) => ({ wert: l.id, text: l.name }))]} />
        <ZahlFeld label="Mein Anteil" einheit="%" min={0} max={100} wert={f.anteil} onChange={(a) => setF({ ...f, anteil: a ?? 100 })} />
        <SchalterFeld label="Steuerlich relevant" wert={f.steuerlich} onChange={(steuerlich) => setF({ ...f, steuerlich })} />
      </Gruppe>
      {f.anteil !== 100 && <p className="gruppe-fuss">Für die Fixkostenquote zählt nur dein Anteil, für die Kontoprognose der volle Betrag.</p>}

      <Gruppe titel="Status">
        <AuswahlFeld
          label="Status"
          wert={f.status}
          onChange={(status) => setF({ ...f, status })}
          optionen={[
            { wert: 'aktiv', text: 'Aktiv' },
            { wert: 'pausiert', text: 'Pausiert' },
            { wert: 'gekuendigt', text: 'Gekündigt' },
          ]}
        />
        {f.status === 'gekuendigt' && <DatumFeld label="Letzte Abbuchung" wert={f.endeAm} onChange={(endeAm) => setF({ ...f, endeAm })} optional />}
      </Gruppe>

      <Gruppe
        titel="Vertrag"
        fuss={
          info.status === 'ok'
            ? info.jederzeit
              ? `Jederzeit kündbar – heute gekündigt endet er am ${formatTag(info.laufzeitEnde!)}.`
              : `Kündigen bis ${formatTag(info.kuendigenBis!)}, damit er am ${formatTag(info.laufzeitEnde!)} endet.`
            : info.status === 'unvollstaendig'
              ? `Für die Fristberechnung fehlt: ${info.fehlt.join(', ')}.`
              : undefined
        }
      >
        <DatumFeld label="Beginn" wert={v.beginn} onChange={(beginn) => setF({ ...f, vertrag: { ...v, beginn } })} optional />
        <ZahlFeld label="Mindestlaufzeit" einheit="Monate" wert={v.mindestlaufzeitMonate} onChange={(n) => setF({ ...f, vertrag: { ...v, mindestlaufzeitMonate: n } })} />
        <ZahlFeld label="Kündigungsfrist" wert={v.kuendigungsfrist?.wert} onChange={(n) => setF({ ...f, vertrag: { ...v, kuendigungsfrist: n === null ? null : { wert: n, einheit: v.kuendigungsfrist?.einheit ?? 'monate' } } })} />
        {v.kuendigungsfrist && (
          <AuswahlFeld<Fristeinheit>
            label="Einheit"
            wert={v.kuendigungsfrist.einheit}
            onChange={(einheit) => setF({ ...f, vertrag: { ...v, kuendigungsfrist: { wert: v.kuendigungsfrist!.wert, einheit } } })}
            optionen={[
              { wert: 'tage', text: 'Tage' },
              { wert: 'wochen', text: 'Wochen' },
              { wert: 'monate', text: 'Monate' },
            ]}
          />
        )}
        <ZahlFeld label="Verlängerung" einheit="Monate" wert={v.verlaengerungMonate} onChange={(n) => setF({ ...f, vertrag: { ...v, verlaengerungMonate: n } })} />
      </Gruppe>

      <Gruppe titel="Preis ändern">
        <DatumFeld label="Neuer Preis ab" wert={neuerPreis.ab} onChange={(ab) => setNeuerPreis({ ...neuerPreis, ab })} />
        <BetragFeld label="Neuer Betrag" wert={neuerPreis.betrag} onChange={(b) => setNeuerPreis({ ...neuerPreis, betrag: b })} erlaubeLeer />
        {neuerPreis.ab && neuerPreis.betrag !== null && neuerPreis.betrag !== betrag && (
          <Zeile
            titel={<span style={{ color: 'var(--akzent)', fontWeight: 600 }}>Preisänderung übernehmen</span>}
            unter={<><Betrag wert={neuerPreis.betrag - betrag} vorzeichen /> ({formatProzent(betrag ? ((neuerPreis.betrag - betrag) / betrag) * 100 : null)})</>}
            onClick={() => {
              setF({ ...f, preise: [...f.preise.filter((p) => p.gueltigAb !== neuerPreis.ab), { gueltigAb: neuerPreis.ab!, betrag: neuerPreis.betrag! }] });
              setNeuerPreis({ ab: heute(), betrag: null });
            }}
          />
        )}
        {preise.length > 1 &&
          [...preise].reverse().map((p) => <Zeile key={p.gueltigAb} titel={`ab ${formatTag(p.gueltigAb)}`} wert={<Betrag wert={p.betrag} />} />)}
      </Gruppe>

      <Gruppe titel="Kredit / Finanzierung" fuss={f.finanzierung ? 'Nach der letzten Rate fällt der Posten automatisch aus der Prognose.' : undefined}>
        <SchalterFeld label="Ist eine Finanzierung" wert={!!f.finanzierung} onChange={(an) => setF({ ...f, finanzierung: an ? (f.finanzierung ?? { restschuld: null, zinsPromille: null, letzteRate: null }) : undefined })} />
        {f.finanzierung && (
          <>
            <BetragFeld label="Restschuld" wert={f.finanzierung.restschuld ?? null} onChange={(restschuld) => setF({ ...f, finanzierung: { ...f.finanzierung, restschuld } })} erlaubeLeer />
            <TextFeld
              label="Zinssatz % p. a."
              wert={f.finanzierung.zinsPromille != null ? String(f.finanzierung.zinsPromille / 10).replace('.', ',') : ''}
              platzhalter="z. B. 4,9"
              onChange={(s) => {
                const n = Number(s.replace(',', '.'));
                setF({ ...f, finanzierung: { ...f.finanzierung, zinsPromille: s.trim() === '' || Number.isNaN(n) ? null : Math.round(n * 10) } });
              }}
            />
            <DatumFeld label="Letzte Rate" wert={f.finanzierung.letzteRate} onChange={(letzteRate) => setF({ ...f, finanzierung: { ...f.finanzierung, letzteRate } })} optional />
          </>
        )}
        <KontoFeld label="Probe-Rate: Geld geht auf" wert={f.zielKontoId ?? ''} onChange={(z) => setF({ ...f, zielKontoId: z || undefined })} konten={daten.konten.filter((k) => k.id !== f.kontoId)} leerText="– (echte Ausgabe)" />
      </Gruppe>

      <Gruppe titel="Notizen">
        <NotizFeld label="Notiz" wert={f.notiz ?? ''} onChange={(notiz) => setF({ ...f, notiz })} />
        <TextFeld label="Kundenportal" typ="url" wert={f.portalUrl ?? ''} onChange={(portalUrl) => setF({ ...f, portalUrl })} platzhalter="https://" />
        <Zeile titel="Zuletzt geprüft" wert={<span className="text-2">{f.geprueftAm ? formatTag(f.geprueftAm) : 'nie'}</span>} />
        <Zeile titel={<span style={{ color: 'var(--akzent)' }}>Heute geprüft</span>} onClick={() => setF({ ...f, geprueftAm: heute() })} chevron={false} />
        {f.portalUrl && /^https?:\/\//.test(f.portalUrl) && (
          <a className="zeile" href={f.portalUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--akzent)', textDecoration: 'none' }}>
            Kundenportal öffnen
          </a>
        )}
      </Gruppe>

      <div className="knopf-reihe" style={{ marginTop: 20 }}>
        <button
          type="button"
          className="knopf zweit"
          onClick={() => {
            const kopie = { ...f, id: neueId('f'), name: `${f.name} (Kopie)` };
            void speichere('fixkosten', kopie, 'Posten dupliziert').then(() => {
              onSchliessen();
              zeigeSheet({ typ: 'fixkosten', id: kopie.id });
            });
          }}
        >
          Duplizieren
        </button>
        <button
          type="button"
          className="knopf gefahr"
          onClick={() => {
            void inPapierkorb('fixkosten', f.id, `${f.name} gelöscht`);
            onSchliessen();
          }}
        >
          Löschen
        </button>
      </div>
    </Sheet>
  );
}
