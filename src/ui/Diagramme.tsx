/* Ruhiges Kreisdiagramm ohne 3D-Effekte und Verläufe, mit Textzusammenfassung für VoiceOver. */
import { formatEuro } from '../domain/geld';
import type { Cent } from '../domain/typen';
import { useDatenOptional } from '../state/daten';
import { farbe } from './Symbol';

export interface KreisWert {
  id: string;
  name: string;
  farbe: string;
  wert: Cent;
}

/** Ring-Diagramm; die Mitte zeigt die Summe. Legende steht separat darunter (kein Text im Diagramm). */
export function KreisDiagramm({ werte, mitte, unterMitte }: { werte: KreisWert[]; mitte: Cent; unterMitte: string }) {
  const ausblenden = useDatenOptional()?.einstellungen.betraegeAusblenden;
  const summe = werte.reduce((s, w) => s + w.wert, 0);
  const r = 70;
  const umfang = 2 * Math.PI * r;
  const luecke = werte.length > 1 ? 2.5 : 0;
  let start = 0;
  const zusammenfassung = `Fixkosten ${formatEuro(mitte)} pro Monat. ${werte.map((w) => `${w.name} ${formatEuro(w.wert)}`).join(', ')}.`;
  return (
    <figure className="kreis" role="img" aria-label={zusammenfassung}>
      <svg viewBox="0 0 180 180" aria-hidden="true">
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--trenner)" strokeWidth="22" />
        {summe > 0 &&
          werte.map((w) => {
            const laenge = (w.wert / summe) * umfang;
            const kreis = (
              <circle
                key={w.id}
                cx="90"
                cy="90"
                r={r}
                fill="none"
                stroke={farbe(w.farbe)}
                strokeWidth="22"
                strokeDasharray={`${Math.max(0, laenge - luecke)} ${umfang}`}
                strokeDashoffset={-start}
                transform="rotate(-90 90 90)"
              />
            );
            start += laenge;
            return kreis;
          })}
      </svg>
      <div className="kreis-mitte" aria-hidden="true">
        <strong className="zahl">{ausblenden ? '••• €' : formatEuro(mitte)}</strong>
        <span>{unterMitte}</span>
      </div>
    </figure>
  );
}
