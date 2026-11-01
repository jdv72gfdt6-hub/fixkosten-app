import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarArrowDown, Database, FileDown, FileUp, FlaskConical, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db, ersetzeAlles, ladeDaten, ladeEinstellungen } from '../db/db';
import { erstelleBackup } from '../domain/backup';
import { formatTag } from '../domain/datum';
import { erzeugeIcs } from '../domain/ics';
import { kalenderTermine } from '../domain/termine';
import { testdaten } from '../domain/testdaten';
import { LEERE_DATEN } from '../domain/typen';
import { aendereEinstellungen, heute, useDaten } from '../state/daten';
import { useNav } from '../state/navigation';
import { AuswahlFeld, SchalterFeld, ZahlFeld } from '../ui/Felder';
import { speichereDatei } from '../ui/hilfen';
import { Gruppe, Zeile } from '../ui/Liste';
import { Seite } from '../ui/Seite';

export async function backupHerunterladen() {
  const b =erstelleBackup(await ladeDaten(), await ladeEinstellungen(), await db.abschluss.toArray());
  speichereDatei(`fixkosten-backup-${heute()}.json`, JSON.stringify(b, null, 2), 'application/json');
  await aendereEinstellungen({ letztesBackup: heute() });
}

export function EinstellungenSeite() {
  const { einstellungen, roh } = useDaten();
  const { oeffne, zeigeSheet } = useNav();
  const [dauerhaft, setDauerhaft] = useState<boolean | null>(null);
  const sicherungen = useLiveQuery(() => db.sicherungen.count()) ?? 0;
  const papierkorb = Object.values(roh).flat().filter((x) => (x as { geloeschtAm?: string }).geloeschtAm).length;

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setDauerhaft);
  }, []);

  const kalenderExport = () => {
    const termine = kalenderTermine(roh, heute());
    speichereDatei('fixkosten-fristen.ics', erzeugeIcs(termine), 'text/calendar');
  };

  return (
    <Seite titel="Einstellungen">
      <Gruppe titel="Darstellung">
        <AuswahlFeld
          label="Design"
          wert={einstellungen.design}
          onChange={(design) => void aendereEinstellungen({ design })}
          optionen={[
            { wert: 'auto', text: 'Automatisch' },
            { wert: 'hell', text: 'Hell' },
            { wert: 'dunkel', text: 'Dunkel' },
          ]}
        />
        <SchalterFeld label="Beträge ausblenden" unter="Zeigt ••• € statt Beträgen, z. B. in der Öffentlichkeit." wert={einstellungen.betraegeAusblenden} onChange={(v) => void aendereEinstellungen({ betraegeAusblenden: v })} />
      </Gruppe>

      <Gruppe titel="Fixkostenquote" fuss="Ampel: grün unter Gelb-Grenze, gelb dazwischen, rot über Rot-Grenze.">
        <ZahlFeld label="Gelb ab" einheit="%" max={100} wert={einstellungen.ampelGelb} onChange={(v) => v !== null && void aendereEinstellungen({ ampelGelb: v })} />
        <ZahlFeld label="Rot über" einheit="%" max={100} wert={einstellungen.ampelRot} onChange={(v) => v !== null && void aendereEinstellungen({ ampelRot: v })} />
      </Gruppe>

      <Gruppe titel="Einordnung">
        <Zeile titel="Kategorien und Lebensbereiche" onClick={() => oeffne({ typ: 'kategorien-verwalten' })} />
      </Gruppe>

      <Gruppe titel="Kalender" fuss="Erinnerungen ohne Server funktionieren am zuverlässigsten über Apple Kalender. Nach Änderungen die Datei neu exportieren und importieren – feste IDs verhindern doppelte Termine.">
        <Zeile symbol={<CalendarArrowDown size={22} aria-hidden="true" />} titel="Fristen als Kalenderdatei (.ics)" unter="Kündigungsfristen, Jahreszahlungen, letzte Raten" onClick={kalenderExport} />
      </Gruppe>

      <Gruppe
        titel="Daten & Backup"
        fuss={
          <>
            Alle Daten liegen nur auf diesem Gerät (IndexedDB). Letztes Backup: {einstellungen.letztesBackup ? formatTag(einstellungen.letztesBackup) : 'noch keins'}.
            {dauerhaft === false && ' Der Browser hat dauerhaften Speicher noch nicht bestätigt – füge die App zum Home-Bildschirm hinzu.'}
          </>
        }
      >
        <Zeile symbol={<FileDown size={22} aria-hidden="true" />} titel="Backup exportieren" unter="JSON-Datei, z. B. in iCloud Drive sichern" onClick={() => void backupHerunterladen()} />
        <Zeile symbol={<FileUp size={22} aria-hidden="true" />} titel="Backup importieren" unter="Mit Vorschau und Bestätigung" onClick={() => zeigeSheet({ typ: 'import' })} />
        <Zeile symbol={<Trash2 size={22} aria-hidden="true" />} titel="Papierkorb" wert={<span className="text-2">{papierkorb}</span>} onClick={() => oeffne({ typ: 'papierkorb' })} />
        <Zeile symbol={<Database size={22} aria-hidden="true" />} titel="Interne Sicherungen" unter="Vor jedem Import und jeder Migration" wert={<span className="text-2">{sicherungen}</span>} />
        <Zeile symbol={<ShieldCheck size={22} aria-hidden="true" />} titel="Dauerhafter Speicher" wert={<span className="text-2">{dauerhaft === null ? 'unbekannt' : dauerhaft ? 'aktiv' : 'nicht bestätigt'}</span>} />
      </Gruppe>

      <Gruppe titel="Ausprobieren" fuss="Testdaten ersetzen deine Daten. Vorher wird automatisch eine interne Sicherung angelegt – trotzdem lieber erst ein Backup exportieren.">
        <Zeile
          symbol={<FlaskConical size={22} aria-hidden="true" />}
          titel="Testdaten laden"
          unter="3 Konten, Gehalt, Umbuchungen, 15 Fixkosten"
          onClick={() => {
            if (confirm('Testdaten laden? Deine aktuellen Daten werden ersetzt (eine interne Sicherung wird angelegt).')) {
              void ersetzeAlles(testdaten(heute()), 'Vor Testdaten').then(() => aendereEinstellungen({ onboardingFertig: true }));
            }
          }}
        />
        <Zeile
          symbol={<Trash2 size={22} color="var(--rot)" aria-hidden="true" />}
          titel={<span className="text-rot">Alle Daten löschen</span>}
          onClick={() => {
            if (confirm('Wirklich alle Daten löschen? Eine interne Sicherung wird angelegt, aber nur ein exportiertes Backup ist wirklich sicher.')) {
              void ersetzeAlles(LEERE_DATEN, 'Vor dem Löschen aller Daten').then(() => aendereEinstellungen({ onboardingFertig: false }));
            }
          }}
        />
      </Gruppe>

      <Gruppe titel="Über">
        <Zeile titel="Version" wert={<span className="text-2">{__APP_VERSION__}</span>} />
        <Zeile titel="Datenschutz" unter="Kein Server, kein Tracking, keine externen Schriften. Keine Bankzugangsdaten, keine volle IBAN." />
      </Gruppe>
      <p className="beratung">Alle Berechnungen sind Orientierungshilfen und keine Finanz- oder Anlageberatung.</p>
    </Seite>
  );
}
