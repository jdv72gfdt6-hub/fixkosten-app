import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, CircleAlert, Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { db } from '../db/db';
import { speichere } from '../db/aktionen';
import { baueTag, ersterDesMonats, formatMonat, formatTag, formatTagKurz, letzterDesMonats, monatPlus, plusTage, tageImMonat, teile, wochentag } from '../domain/datum';
import { formatEuro } from '../domain/geld';
import { istBankarbeitstag } from '../domain/kalender';
import { ereignisse, type Ereignis } from '../domain/prognose';
import { abgleich, erwarteteBuchungen } from '../domain/termine';
import { neueId } from '../domain/standard';
import type { AbschlussEintrag, Cent, Daten } from '../domain/typen';
import { useBerechnung, useDaten } from '../state/daten';
import { useAnsicht } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { BetragFeld, KontoFeld } from '../ui/Felder';
import { farbe } from '../ui/Symbol';
import { kontoVon } from '../ui/hilfen';
import { Gruppe, Segment, Zeile } from '../ui/Liste';
import { Seite } from '../ui/Seite';

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function istGegenbuchung(e: Ereignis) {
  return /^(umbuchung-ein|sparen-ein|probe|karte-ein)\|/.test(e.schluessel);
}

export function KalenderSeite() {
  const ansicht = useAnsicht((s) => s.kalender);
  const setze = useAnsicht((s) => s.setze);
  const b = useBerechnung();
  const [monat, setMonat] = useState(b.heute.slice(0, 7));
  const [j, m] = monat.split('-').map(Number) as [number, number];
  const verschiebe = (n: number) => {
    const x = monatPlus(j, m, n);
    setMonat(`${x.jahr}-${String(x.monat).padStart(2, '0')}`);
  };
  return (
    <Seite titel={ansicht === 'kalender' ? 'Kalender' : 'Abschluss'}>
      <Segment
        label="Ansicht"
        wert={ansicht}
        onChange={(v) => setze({ kalender: v })}
        werte={[
          { id: 'kalender', text: 'Kalender' },
          { id: 'abschluss', text: 'Monatsabschluss' },
        ]}
      />
      <div className="kal-kopf">
        <button type="button" aria-label="Vorheriger Monat" onClick={() => verschiebe(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h2 aria-live="polite">{formatMonat(monat)}</h2>
        <button type="button" aria-label="Nächster Monat" onClick={() => verschiebe(1)}>
          <ChevronRight size={24} />
        </button>
      </div>
      {ansicht === 'kalender' ? <Monatsansicht monat={monat} /> : <Monatsabschluss monat={monat} />}
    </Seite>
  );
}

function hinweise(d: Daten, liste: Ereignis[], monat: string): string[] {
  const ergebnis: string[] = [];
  const [j, m] = monat.split('-').map(Number) as [number, number];
  const abfluesse = liste.filter((e) => e.betrag < 0 && !istGegenbuchung(e));
  // Ballung: viele oder große Abbuchungen innerhalb von 3 Tagen auf einem Konto.
  for (const k of d.konten) {
    const eigene = abfluesse.filter((e) => e.kontoId === k.id);
    let gemeldet = '';
    for (const e of eigene) {
      if (e.datum <= gemeldet) continue;
      const bis = plusTage(e.datum, 2);
      const fenster = eigene.filter((x) => x.datum >= e.datum && x.datum <= bis);
      const summe = -fenster.reduce((s, x) => s + x.betrag, 0);
      if (fenster.length >= 4 || summe >= 50000) {
        const letzter = fenster.at(-1)!.datum;
        const zeitraum = letzter === e.datum ? `Am ${formatTagKurz(e.datum)}` : `Vom ${formatTagKurz(e.datum)} bis ${formatTagKurz(letzter)}`;
        const angenommen = fenster.some((x) => x.angenommen) ? ' Teilweise mit angenommenem Tag – trage die echten Tage nach.' : '';
        ergebnis.push(`${k.name}: ${zeitraum} gehen ${fenster.length} Abbuchungen über ${formatEuro(summe)} ab.${angenommen}`);
        gemeldet = letzter;
      }
    }
  }
  // Abbuchungen vor dem Haupteinkommen eines Kontos (Gehalt am Monatsende finanziert den Folgemonat und zählt nicht).
  const haupteinkommen = new Map<string, Ereignis>();
  for (const e of liste.filter((x) => x.art === 'einkommen')) {
    const alt = haupteinkommen.get(e.kontoId);
    if (!alt || e.betrag > alt.betrag) haupteinkommen.set(e.kontoId, e);
  }
  for (const ein of haupteinkommen.values()) {
    const tag = teile(ein.datum).tag;
    if (tag > tageImMonat(j, m) - 5 || tag <= 3) continue;
    const vorher = abfluesse.filter((e) => e.kontoId === ein.kontoId && e.datum < ein.datum && e.betrag <= -5000);
    if (vorher.length) {
      ergebnis.push(`${vorher.length} größere Abbuchungen auf ${kontoVon(d, ein.kontoId)?.name} liegen vor dem Eingang „${ein.name}“ am ${formatTagKurz(ein.datum)}.`);
    }
  }
  return ergebnis;
}

function Monatsansicht({ monat }: { monat: string }) {
  const { daten, roh } = useDaten();
  const b = useBerechnung();
  const [filter, setFilter] = useState('');
  const [j, m] = monat.split('-').map(Number) as [number, number];
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  const alle = useMemo(() => ereignisse(roh, ersterDesMonats(j, m), letzterDesMonats(j, m)), [roh, j, m]);
  const liste = filter ? alle.filter((e) => e.kontoId === filter) : alle.filter((e) => !istGegenbuchung(e));
  const proTag = new Map<string, Ereignis[]>();
  for (const e of liste) proTag.set(e.datum, [...(proTag.get(e.datum) ?? []), e]);

  const erster = ersterDesMonats(j, m);
  const versatz = (wochentag(erster) + 6) % 7;
  const tage = tageImMonat(j, m);
  const zellen: (string | null)[] = [...Array(versatz).fill(null), ...Array.from({ length: tage }, (_, i) => baueTag(j, m, i + 1))];
  while (zellen.length % 7) zellen.push(null);

  const tagListe = gewaehlt && gewaehlt.startsWith(monat) ? (proTag.get(gewaehlt) ?? []) : liste;
  const tipps = hinweise(daten, alle, monat);

  return (
    <>
      <div className="chips" role="group" aria-label="Nach Konto filtern">
        <button type="button" className="chip" aria-pressed={!filter} onClick={() => setFilter('')}>
          Alle
        </button>
        {daten.konten.map((k) => (
          <button key={k.id} type="button" className="chip" aria-pressed={filter === k.id} onClick={() => setFilter(k.id)}>
            <i style={{ width: 8, height: 8, borderRadius: 4, background: farbe(k.farbe), display: 'inline-block' }} aria-hidden="true" />
            {k.name}
          </button>
        ))}
      </div>
      <div className="kal-raster" role="grid" aria-label={`Abbuchungen ${formatMonat(monat)}`}>
        {WOCHENTAGE.map((w) => (
          <div key={w} className="kal-wt" role="columnheader">
            {w}
          </div>
        ))}
        {zellen.map((t, i) => {
          if (!t) return <span key={`l${i}`} />;
          const ev = proTag.get(t) ?? [];
          const summe = ev.reduce((s, e) => s + e.betrag, 0);
          const label = `${formatTag(t)}: ${ev.length ? `${ev.length} Buchungen, Saldo ${formatEuro(summe)}` : 'keine Buchungen'}${istBankarbeitstag(t) ? '' : ', kein Bankarbeitstag'}`;
          return (
            <button
              key={t}
              type="button"
              role="gridcell"
              className={`kal-tag${t === b.heute ? ' heute' : ''}${istBankarbeitstag(t) ? '' : ' geschlossen'}`}
              aria-pressed={gewaehlt === t}
              aria-label={label}
              onClick={() => setGewaehlt(gewaehlt === t ? null : t)}
            >
              <span className="kal-zahl">{teile(t).tag}</span>
              <span className="kal-punkte" aria-hidden="true">
                {[...new Set(ev.map((e) => e.kontoId))].slice(0, 3).map((k) => (
                  <i key={k} style={{ background: farbe(kontoVon(daten, k)?.farbe) }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {tipps.map((t) => (
        <div key={t} className="hinweis gelb" style={{ marginTop: 8 }}>
          <CircleAlert size={20} aria-hidden="true" />
          <span>{t}</span>
        </div>
      ))}
      <Gruppe titel={gewaehlt && gewaehlt.startsWith(monat) ? formatTag(gewaehlt) : 'Alle Buchungen im Monat'} fuss="Graue Tage sind keine Bankarbeitstage (TARGET2). Buchungen werden dann verschoben.">
        {tagListe.length === 0 && <Zeile titel={<span className="text-2">Keine Buchungen.</span>} />}
        {tagListe.map((e) => (
          <Zeile
            key={e.schluessel}
            symbol={<i className="symbol-kreis klein" style={{ background: farbe(kontoVon(daten, e.kontoId)?.farbe) }} aria-hidden="true" />}
            titel={e.name}
            unter={
              <>
                {formatTagKurz(e.datum)} · {kontoVon(daten, e.kontoId)?.name}
                {e.gegenkontoId && e.art === 'umbuchung' && ` → ${kontoVon(daten, e.gegenkontoId)?.name}`}
                {e.angenommen && <span className="abzeichen gelb">Tag angenommen</span>}
                {e.sollDatum !== e.datum && !e.angenommen && <span className="abzeichen grau">verschoben vom {formatTagKurz(e.sollDatum)}</span>}
              </>
            }
            wert={<Betrag wert={e.betrag} vorzeichen={e.betrag > 0} />}
          />
        ))}
      </Gruppe>
    </>
  );
}

function Monatsabschluss({ monat }: { monat: string }) {
  const { daten, roh } = useDaten();
  const b = useBerechnung();
  const eintraege = useLiveQuery(() => db.abschluss.where('monat').equals(monat).toArray(), [monat]) ?? [];
  const status = new Map(eintraege.map((e) => [e.schluessel, e]));
  const erwartet = useMemo(() => erwarteteBuchungen(roh, monat), [roh, monat]);
  const erledigt = erwartet.filter((e) => status.get(e.schluessel)?.erledigt).length;

  const setzeStatus = (e: Ereignis, teil: Partial<AbschlussEintrag>) => {
    const alt = status.get(e.schluessel);
    const neu: AbschlussEintrag = { id: `${monat}|${e.schluessel}`, monat, schluessel: e.schluessel, erledigt: false, istBetrag: null, ...alt, ...teil };
    void db.abschluss.put(neu);
  };

  return (
    <>
      <div className="karte" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          <strong>{erledigt}</strong> von {erwartet.length} Buchungen abgehakt
        </span>
        <span className="abzeichen blau">{erwartet.length ? Math.round((erledigt / erwartet.length) * 100) : 0} %</span>
      </div>
      {daten.konten.map((k) => {
        const liste = erwartet.filter((e) => e.kontoId === k.id);
        if (!liste.length) return null;
        return (
          <Gruppe key={k.id} titel={k.name}>
            {liste.map((e) => (
              <AbschlussZeile key={e.schluessel} e={e} eintrag={status.get(e.schluessel)} onChange={(t) => setzeStatus(e, t)} />
            ))}
          </Gruppe>
        );
      })}
      <KontostandAbgleich heute={b.heute} />
    </>
  );
}

function AbschlussZeile({ e, eintrag, onChange }: { e: Ereignis; eintrag?: AbschlussEintrag; onChange: (t: Partial<AbschlussEintrag>) => void }) {
  const { daten } = useDaten();
  const fertig = !!eintrag?.erledigt;
  const ist = eintrag?.istBetrag ?? null;
  const abweichung = fertig && ist !== null && ist !== Math.abs(e.betrag);
  const posten = e.art === 'fixkosten' ? daten.fixkosten.find((f) => f.id === e.refId) : undefined;
  const [offen, setOffen] = useState(false);

  return (
    <div className="zeile" style={{ flexWrap: 'wrap' }}>
      <button
        type="button"
        role="checkbox"
        aria-checked={fertig}
        aria-label={`${e.name} am ${formatTag(e.datum)} als erfolgt markieren`}
        onClick={() => onChange({ erledigt: !fertig })}
        style={{ background: 'none', border: 0, padding: 0, minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', marginLeft: -10, color: fertig ? 'var(--akzent-flaeche)' : 'var(--text-3)' }}
      >
        {fertig ? <CheckCircle2 size={24} /> : <Circle size={24} />}
      </button>
      <span className="zeile-inhalt">
        <span className="zeile-titel" style={{ display: 'block', textDecoration: fertig ? 'line-through' : undefined, opacity: fertig ? 0.6 : 1 }}>
          {e.name}
        </span>
        <span className="zeile-unter">
          {formatTagKurz(e.datum)}
          {abweichung && <span className="abzeichen gelb">abweichend</span>}
        </span>
      </span>
      <button type="button" className="link-knopf zahl" style={{ fontWeight: 400, color: 'var(--text)' }} onClick={() => setOffen(!offen)} aria-label="Tatsächlichen Betrag eintragen">
        <Betrag wert={abweichung ? -ist! : e.betrag} />
      </button>
      {offen && (
        <div style={{ width: '100%' }}>
          <BetragFeld label="Tatsächlich" wert={ist ?? Math.abs(e.betrag)} onChange={(v) => onChange({ istBetrag: v, erledigt: true })} />
          {posten && ist !== null && ist !== Math.abs(e.betrag) && (
            <div className="hinweis gelb" style={{ marginTop: 6 }}>
              <CircleAlert size={20} aria-hidden="true" />
              <div>
                {ist > Math.abs(e.betrag) ? 'Mögliche Preiserhöhung' : 'Betrag gesunken'}: <Betrag wert={ist - Math.abs(e.betrag)} vorzeichen />
                <div className="hinweis-aktionen">
                  <button
                    type="button"
                    className="link-knopf"
                    onClick={() => {
                      void speichere('fixkosten', { ...posten, preise: [...posten.preise.filter((p) => p.gueltigAb !== e.sollDatum), { gueltigAb: e.sollDatum, betrag: ist }] }, 'Neuer Preis gespeichert');
                      setOffen(false);
                    }}
                  >
                    Als neuen Preis ab {formatTagKurz(e.sollDatum)} übernehmen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KontostandAbgleich({ heute }: { heute: string }) {
  const { daten, roh } = useDaten();
  const [kontoId, setKontoId] = useState(daten.konten[0]?.id ?? '');
  const [ist, setIst] = useState<Cent | null>(null);
  const ergebnis = useMemo(() => (kontoId && ist !== null ? abgleich(roh, kontoId, heute, ist) : null), [roh, kontoId, ist, heute]);
  return (
    <Gruppe titel="Kontostand-Abgleich" fuss="Trage den echten Kontostand von heute ein. Die App vergleicht mit dem erwarteten Stand und sucht passende Buchungen.">
      <KontoFeld label="Konto" wert={kontoId} onChange={setKontoId} konten={daten.konten} />
      <BetragFeld key={kontoId} label="Echter Stand" wert={ist} onChange={setIst} erlaubeLeer negativErlaubt />
      {ergebnis && (
        <>
          <Zeile titel="Erwartet" wert={ergebnis.ohneStand ? <span className="text-2">kein Vergleich möglich</span> : <Betrag wert={ergebnis.erwartet} />} />
          {!ergebnis.ohneStand && (
            <Zeile
              symbol={<Scale size={22} aria-hidden="true" />}
              titel={ergebnis.differenz === 0 ? 'Stimmt genau' : 'Differenz'}
              wert={<strong><Betrag wert={ergebnis.differenz} vorzeichen faerben /></strong>}
            />
          )}
          {ergebnis.differenz !== 0 &&
            ergebnis.kandidaten.slice(0, 4).map(({ ereignis, exakt }) => (
              <Zeile
                key={ereignis.schluessel}
                titel={ereignis.name}
                unter={
                  <>
                    {formatTag(ereignis.datum)} {exakt && <span className="abzeichen blau">passt genau</span>}
                  </>
                }
                wert={<Betrag wert={ereignis.betrag} />}
              />
            ))}
          <div className="zeile">
            <button
              type="button"
              className="knopf"
              onClick={() => {
                void speichere('kontostaende', { id: neueId('s'), kontoId, datum: heute, betrag: ist!, quelle: 'abgleich', erfasst: Date.now() }, 'Kontostand gespeichert');
                setIst(null);
              }}
            >
              Als Kontostand vom {formatTagKurz(heute)} speichern
            </button>
          </div>
        </>
      )}
    </Gruppe>
  );
}
