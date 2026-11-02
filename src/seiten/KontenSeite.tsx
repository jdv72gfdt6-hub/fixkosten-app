import { Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { formatTag } from '../domain/datum';
import { kontenUebersicht } from '../domain/ruecklagen';
import { heute, useDaten } from '../state/daten';
import { useNav } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { Gruppe, Leer, Zeile } from '../ui/Liste';
import { Seite } from '../ui/Seite';
import { SymbolKreis } from '../ui/Symbol';

/** Tab 4: alle Konten mit ihrem heutigen Stand und der Gesamtsumme. */
export function KontenSeite() {
  const { roh } = useDaten();
  const zeige = useNav((s) => s.zeigeSheet);
  const h = heute();
  const u = useMemo(() => kontenUebersicht(roh, h), [roh, h]);
  const neu = { label: 'Neues Konto', onClick: () => zeige({ typ: 'konto' }) };

  if (u.zeilen.length === 0) {
    return (
      <Seite titel="Konten" plus={neu}>
        <Leer symbol={<Wallet size={36} aria-hidden="true" />} titel="Noch keine Konten" text="Lege deine Konten an, um ihre Stände hier zu sehen." aktion={{ text: 'Konto anlegen', onClick: neu.onClick }} />
      </Seite>
    );
  }

  const mitStand = u.zeilen.length - u.ohneStand;

  return (
    <Seite titel="Konten" plus={neu}>
      <div className="karte">
        <span className="karte-titel">Alle Konten zusammen</span>
        <span className="karte-zahl">{mitStand ? <Betrag wert={u.gesamt} /> : '–'}</span>
        {u.ohneStand > 0 && <span className="karte-unter">{u.ohneStand === 1 ? 'Ein Konto hat' : `${u.ohneStand} Konten haben`} noch keinen Stand.</span>}
      </div>

      <Gruppe titel="Konten" fuss="Die Stände laufen mit den Eingängen und Abbuchungen an ihren Tagen weiter. Antippen, um den echten Stand einzutragen. Hier wird nichts gebucht.">
        {u.zeilen.map((z) => (
          <Zeile
            key={z.konto.id}
            symbol={<SymbolKreis symbol={z.konto.symbol} farbe={z.konto.farbe} />}
            titel={z.konto.name}
            unter={
              z.herkunft === null ? (
                <span className="abzeichen gelb">Stand fehlt</span>
              ) : z.herkunft === 'spartoepfe' ? (
                <span>Summe der Spartöpfe</span>
              ) : (
                <span>Stand vom {formatTag(z.standAm!)}</span>
              )
            }
            wert={z.saldo !== null ? <Betrag wert={z.saldo} /> : '–'}
            onClick={() => zeige({ typ: 'kontostand', kontoId: z.konto.id })}
          />
        ))}
      </Gruppe>
    </Seite>
  );
}
