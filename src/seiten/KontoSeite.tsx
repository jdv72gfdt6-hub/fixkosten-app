import { Landmark } from 'lucide-react';
import { useMemo } from 'react';
import { formatMonat, formatTag, monatVon } from '../domain/datum';
import { aktuellerBetrag } from '../domain/posten';
import { fixkostenKonto, kontoRuecklage, type Jahreszahlung } from '../domain/ruecklagen';
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

  const monatlicheKosten = daten.fixkosten
    .filter((f) => f.kontoId === konto.id && f.status === 'aktiv' && (f.zeitplan.rhythmus === 'monatlich' || f.zeitplan.rhythmus === 'woechentlich'))
    .sort((a, c) => aktuellerBetrag(c.preise) - aktuellerBetrag(a.preise));
  const summeMonatlich = monatlicheKosten.reduce((s, f) => s + aktuellerBetrag(f.preise), 0);

  return (
    <Seite titel={konto.name}>
      <button type="button" className="karte konto-karte" onClick={() => zeige({ typ: 'kontostand', kontoId: konto.id })}>
        <span className="karte-titel">Kontostand</span>
        {r.stand ? (
          <>
            <span className="karte-zahl">
              <Betrag wert={r.stand.betrag} />
            </span>
            <span className="karte-unter">Stand vom {formatTag(r.stand.datum)} · antippen zum Ändern</span>
          </>
        ) : (
          <span className="karte-unter">Noch nicht eingetragen · antippen zum Eintragen</span>
        )}
      </button>

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
            Kontostand vom {formatTag(r.stand.datum)} minus noch offene Monatsabbuchungen bis zum nächsten Geldeingang (<Betrag wert={r.offenBisEingang} />) minus Rücklage (<Betrag wert={r.sollAmStand} />).
          </p>
        )}
      </div>

      <Gruppe titel="Jahreszahlungen" fuss="„Angespart“ = seit der letzten Abbuchung jeden Monat eine Rate. Nur eine Anzeige – hier wird nichts gebucht.">
        {r.zahlungen.length === 0 && <Zeile titel={<span className="text-2">Keine Jahres- oder Halbjahreszahlungen auf diesem Konto.</span>} />}
        {r.zahlungen.map((z) => (
          <JahresZeile key={z.posten.id} z={z} />
        ))}
      </Gruppe>

      <Gruppe titel="Jeden Monat" fuss={<>Zusammen <Betrag wert={summeMonatlich} /> pro Monat.</>}>
        {monatlicheKosten.map((f) => (
          <Zeile key={f.id} titel={f.name} wert={<Betrag wert={aktuellerBetrag(f.preise)} />} onClick={() => zeige({ typ: 'fixkosten', id: f.id })} />
        ))}
      </Gruppe>
    </Seite>
  );
}

function JahresZeile({ z }: { z: Jahreszahlung }) {
  const zeige = useNav((s) => s.zeigeSheet);
  const anteil = z.betrag > 0 ? Math.min(1, z.angespart / z.betrag) : 0;
  const abstand = MONATSABSTAND[z.posten.zeitplan.rhythmus as keyof typeof MONATSABSTAND];
  return (
    <button type="button" className="zeile jahres-zeile" onClick={() => zeige({ typ: 'fixkosten', id: z.posten.id })}>
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
