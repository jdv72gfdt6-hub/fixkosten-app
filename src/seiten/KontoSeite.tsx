import { Landmark } from 'lucide-react';
import { useMemo } from 'react';
import { formatMonat, formatTag, monatVon } from '../domain/datum';
import { fixkostenKonto, kontoRuecklage, monatsAbbuchungen, type Jahreszahlung } from '../domain/ruecklagen';
import { MONATSABSTAND } from '../domain/geld';
import { heute, useDaten } from '../state/daten';
import { useNav } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { Gruppe, Leer, Zeile } from '../ui/Liste';
import { Seite } from '../ui/Seite';

const ABSTAND_TEXT: Record<number, string> = { 2: 'alle 2 Monate', 3: 'vierteljährlich', 6: 'halbjährlich', 12: 'jährlich' };

/** Tab 2: das Fixkostenkonto (z. B. C24) – Kontostand, Rücklagen für Jahreszahlungen, monatliche Abbuchungen. */
export function KontoSeite() {
  const { daten, roh, einstellungen } = useDaten();
  const zeige = useNav((s) => s.zeigeSheet);
  const konto = fixkostenKonto(daten, einstellungen.fixKontoId);
  const h = heute();
  const r = useMemo(() => (konto ? kontoRuecklage(roh, konto.id, h) : null), [roh, konto, h]);

  if (!konto || !r) {
    return (
      <Seite titel="Konto">
        <Leer symbol={<Landmark size={36} aria-hidden="true" />} titel="Kein Fixkostenkonto" text="Lege ein Konto mit der Rolle „Fixkosten“ an oder wähle es in den Einstellungen." aktion={{ text: 'Konto anlegen', onClick: () => zeige({ typ: 'konto' }) }} />
      </Seite>
    );
  }

  const abbuchungen = monatsAbbuchungen(roh, konto.id, h);
  const summeMonatlich = abbuchungen.reduce((s, a) => s + a.betrag, 0);
  const ohneTag = abbuchungen.filter((a) => a.tagFehlt).length + r.zahlungen.filter((z) => z.naechster?.angenommen).length;

  return (
    <Seite titel={konto.name}>
      <button type="button" className="karte konto-karte" onClick={() => zeige({ typ: 'kontostand', kontoId: konto.id })}>
        <span className="karte-titel">Kontostand heute</span>
        {r.stand && r.saldoHeute !== null ? (
          <>
            <span className="karte-zahl">
              <Betrag wert={r.saldoHeute} />
            </span>
            {r.stand.datum < h ? (
              <span className="karte-unter">
                Dein Stand vom {formatTag(r.stand.datum)}: <Betrag wert={r.stand.betrag} />
                {r.seitStand.ein || r.seitStand.aus ? (
                  <>
                    , seitdem{r.seitStand.ein > 0 && <> {'+ '}<Betrag wert={r.seitStand.ein} /> Eingang</>}
                    {r.seitStand.aus > 0 && <> {'− '}<Betrag wert={r.seitStand.aus} /> Abbuchungen</>}.
                  </>
                ) : (
                  ', seitdem keine Buchungen.'
                )}{' '}
                Antippen, um den echten Stand einzutragen.
              </span>
            ) : (
              <span className="karte-unter">Eingetragen am {formatTag(r.stand.datum)} · antippen zum Ändern</span>
            )}
          </>
        ) : (
          <span className="karte-unter">Noch nicht eingetragen · antippen zum Eintragen</span>
        )}
      </button>

      {ohneTag > 0 && (
        <p className="hinweis gelb">
          Bei {ohneTag} {ohneTag === 1 ? 'Abbuchung fehlt' : 'Abbuchungen fehlt'} noch der Tag. Bis dahin rechnet die App mit dem 1. des Monats. Zum Eintragen unten antippen.
        </p>
      )}
      <div className="karte">
        <span className="karte-titel">Rücklage für Jahreszahlungen</span>
        <div className="kennzahlen">
          <div>
            <span className="kennzahl-titel">Sollte da sein</span>
            <span className="kennzahl-wert">
              <Betrag wert={r.soll} />
            </span>
          </div>
          <div>
            <span className="kennzahl-titel">Monatlich zurücklegen</span>
            <span className="kennzahl-wert">
              <Betrag wert={r.rateMonatlich} />
            </span>
          </div>
        </div>
        {r.spielraum !== null && (
          <p className={`status ${r.spielraum >= 0 ? 'gruen' : 'rot'}`}>
            {r.spielraum >= 0 ? (
              <>
                Alles gedeckt. <Betrag wert={r.spielraum} /> mehr da als nötig.
              </>
            ) : (
              <>
                Es fehlen <Betrag wert={-r.spielraum} />.
              </>
            )}
          </p>
        )}
        {r.stand && (
          <p className="karte-fuss">
            Kontostand heute minus Abbuchungen, die bis zum nächsten Geldeingang noch kommen (<Betrag wert={r.offenBisEingang} />), minus Rücklage (<Betrag wert={r.soll} />).
          </p>
        )}
      </div>

      <Gruppe titel="Jahreszahlungen" fuss="„Angespart“ = seit der letzten Abbuchung jeden Monat eine Rate. Nur eine Anzeige – hier wird nichts gebucht.">
        {r.zahlungen.length === 0 && <Zeile titel={<span className="text-2">Keine Jahres- oder Halbjahreszahlungen auf diesem Konto.</span>} />}
        {r.zahlungen.map((z) => (
          <JahresZeile key={z.posten.id} z={z} />
        ))}
      </Gruppe>

      <Gruppe titel={`Jeden Monat · ${formatMonat(monatVon(h))}`} fuss={<>Zusammen <Betrag wert={summeMonatlich} /> pro Monat. Zum Ändern des Tages antippen.</>}>
        {abbuchungen.map((a) => (
          <Zeile
            key={a.posten.id}
            titel={a.posten.name}
            unter={
              a.tagFehlt ? (
                <span className="abzeichen gelb">Tag fehlt</span>
              ) : a.abgebucht ? (
                <span>abgebucht am {formatTag(a.datum!)}</span>
              ) : (
                <span>wird am {formatTag(a.datum!)} abgebucht</span>
              )
            }
            wert={<span className={a.abgebucht && !a.tagFehlt ? 'text-2' : undefined}><Betrag wert={a.betrag} /></span>}
            onClick={() => zeige({ typ: 'abbuchungstag', id: a.posten.id })}
          />
        ))}
      </Gruppe>    </Seite>
  );
}

function JahresZeile({ z }: { z: Jahreszahlung }) {
  const zeige = useNav((s) => s.zeigeSheet);
  const anteil = z.betrag > 0 ? Math.min(1, z.angespart / z.betrag) : 0;
  const abstand = MONATSABSTAND[z.posten.zeitplan.rhythmus as keyof typeof MONATSABSTAND];
  return (
    <button type="button" className="zeile jahres-zeile" onClick={() => zeige(z.monatFehlt ? { typ: 'fixkosten', id: z.posten.id } : { typ: 'abbuchungstag', id: z.posten.id })}>
      <span className="jahres-kopf">
        <span className="zeile-titel">{z.posten.name}</span>
        <span className="zahl">
          <Betrag wert={z.betrag} />
        </span>
      </span>
      {z.monatFehlt ? (
        <span className="zeile-unter">
          <span className="abzeichen gelb">Monat fehlt – antippen und eintragen</span>
        </span>
      ) : (
        <>
          <span className="text-zeile">
            {z.naechster ? (z.naechster.angenommen ? `Abbuchung im ${formatMonat(monatVon(z.naechster.ist))}` : `Abbuchung am ${formatTag(z.naechster.ist)}`) : 'Abbuchung –'} ({ABSTAND_TEXT[abstand] ?? ''})
          </span>
          <span className="balken" aria-hidden="true">
            <span style={{ width: `${Math.round(anteil * 100)}%` }} />
          </span>
          <span className="text-zeile">
            <Betrag wert={z.angespart} /> von <Betrag wert={z.betrag} /> angespart, <Betrag wert={z.rate} /> pro Monat
          </span>
        </>
      )}
    </button>
  );
}
