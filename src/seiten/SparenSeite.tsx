import { PiggyBank } from 'lucide-react';
import { useMemo } from 'react';
import { formatTag } from '../domain/datum';
import { sparKonto, spartoepfe } from '../domain/ruecklagen';
import { heute, useDaten } from '../state/daten';
import { useNav } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { Gruppe, Leer } from '../ui/Liste';
import { Seite } from '../ui/Seite';

/** Tab 3: Sparkonto (z. B. Trade Republic) – eine Summe je Geldeingang und die Gesamtsumme. */
export function SparenSeite() {
  const { daten, roh, einstellungen } = useDaten();
  const zeige = useNav((s) => s.zeigeSheet);
  const oeffne = useNav((s) => s.oeffne);
  const h = heute();
  const konto = sparKonto(daten, einstellungen.sparKontoId, h);
  const toepfe = useMemo(() => (konto ? spartoepfe(roh, konto.id, h) : []), [roh, konto, h]);

  if (!konto) {
    return (
      <Seite titel="Sparen">
        <Leer symbol={<PiggyBank size={36} aria-hidden="true" />} titel="Kein Sparkonto" text="Wähle in den Einstellungen das Konto, auf dem du sparst." aktion={{ text: 'Einstellungen', onClick: () => oeffne({ typ: 'einstellungen' }) }} />
      </Seite>
    );
  }

  const bekannt = toepfe.filter((t) => t.aktuell !== null);
  const gesamt = bekannt.reduce((s, t) => s + t.aktuell!, 0);
  const proMonat = toepfe.reduce((s, t) => s + t.monatlich, 0);
  const fehlt = toepfe.length - bekannt.length;

  return (
    <Seite titel={konto.name}>
      <div className="karte">
        <span className="karte-titel">Gesamt</span>
        <span className="karte-zahl">{bekannt.length ? <Betrag wert={gesamt} /> : '–'}</span>
        <span className="karte-unter">
          + <Betrag wert={proMonat} /> pro Monat
          {fehlt > 0 && bekannt.length > 0 && ` · ${fehlt === 1 ? 'eine Summe' : `${fehlt} Summen`} noch ohne Stand`}
        </span>
      </div>

      {toepfe.length === 0 ? (
        <Leer titel="Keine regelmäßigen Eingänge" text={`Lege ein Einkommen oder eine Umbuchung mit Ziel „${konto.name}“ an. Jeder Eingang bekommt hier seine eigene Summe.`} aktion={{ text: 'Neu anlegen', onClick: () => zeige({ typ: 'neu' }) }} />
      ) : (
        <Gruppe titel="Summen" fuss="Jeder Geldeingang wird automatisch dazugerechnet. Nach einer Entnahme einfach den neuen Stand eintragen. Hier wird nichts gebucht.">
          {toepfe.map((t) => (
            <button key={t.schluessel} type="button" className="zeile topf-zeile" onClick={() => zeige({ typ: 'topf', kontoId: konto.id, schluessel: t.schluessel })}>
              <span className="zeile-inhalt">
                <span className="zeile-titel">{t.name}</span>
                <span className="text-zeile">
                  + <Betrag wert={t.monatlich} /> pro Monat
                </span>
                {t.eintrag?.standAm && <span className="text-zeile">Stand vom {formatTag(t.eintrag.standAm)}</span>}
              </span>
              <span className="zeile-wert">{t.aktuell !== null ? <Betrag wert={t.aktuell} /> : <span className="link">Stand eintragen</span>}</span>
            </button>
          ))}
        </Gruppe>
      )}
    </Seite>
  );
}
