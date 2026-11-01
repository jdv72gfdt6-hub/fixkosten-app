import { Receipt } from 'lucide-react';
import { formatProzent, monatlich, prozent } from '../domain/geld';
import { aktuellerBetrag, fixkostenAktivAm } from '../domain/posten';
import type { Fixkosten } from '../domain/typen';
import { useBerechnung, useDaten } from '../state/daten';
import { useNav } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { KreisDiagramm } from '../ui/Diagramme';
import { istNichtMonatlich, kategorieVon, kontoVon, zeitplanText } from '../ui/hilfen';
import { Gruppe, Leer, Zeile } from '../ui/Liste';
import { Seite } from '../ui/Seite';
import { farbe } from '../ui/Symbol';

/** Tab 1: alle Fixkosten mit Kreisdiagramm nach Kategorien. */
export function FixkostenSeite() {
  const { daten } = useDaten();
  const b = useBerechnung();
  const zeige = useNav((s) => s.zeigeSheet);
  const neu = () => zeige({ typ: 'fixkosten' });

  if (daten.fixkosten.length === 0) {
    return (
      <Seite titel="Fixkosten" plus={{ label: 'Neuer Fixkosten-Posten', onClick: neu }}>
        <Leer symbol={<Receipt size={36} aria-hidden="true" />} titel="Noch keine Fixkosten" text="Hier erscheinen alle regelmäßigen Abbuchungen wie Miete, Versicherungen und Abos." aktion={{ text: 'Ersten Posten anlegen', onClick: neu }} />
      </Seite>
    );
  }

  const ue = b.uebersicht;
  const kategorien = ue.proKategorie.map((s) => ({ ...s, farbe: kategorieVon(daten, s.id)?.farbe ?? 'gray' }));
  const summeJc = kategorien.reduce((s, k) => s + k.jahresCent, 0);
  const mehrereKonten = new Set(daten.fixkosten.map((f) => f.kontoId)).size > 1;

  return (
    <Seite titel="Fixkosten" plus={{ label: 'Neuer Fixkosten-Posten', onClick: neu }}>
      <div className="karte">
        <KreisDiagramm werte={kategorien.map((k) => ({ id: k.id, name: k.name, farbe: k.farbe, wert: k.monatlich }))} mitte={ue.fixkosten} unterMitte="pro Monat" />
        <ul className="legende" aria-label="Kategorien">
          {kategorien.map((k) => (
            <li key={k.id}>
              <span className="punkt" style={{ background: farbe(k.farbe) }} aria-hidden="true" />
              <span className="legende-name">{k.name}</span>
              <span className="legende-wert">
                <Betrag wert={k.monatlich} />
                <span className="text-2"> · {formatProzent(prozent(k.jahresCent, summeJc), 0)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="karte-fuss">
          Pro Jahr <Betrag wert={Math.round(summeJc)} /> · Jahreszahlungen anteilig pro Monat gerechnet
        </p>
      </div>

      {[...daten.kategorien]
        .sort((a, c) => a.reihenfolge - c.reihenfolge)
        .map((kat) => {
          const posten = daten.fixkosten.filter((f) => f.kategorieId === kat.id).sort((a, c) => aktuellerBetrag(c.preise) - aktuellerBetrag(a.preise));
          if (!posten.length) return null;
          return (
            <Gruppe key={kat.id} titel={kat.name}>
              {posten.map((f) => (
                <PostenZeile key={f.id} f={f} mitKonto={mehrereKonten} />
              ))}
            </Gruppe>
          );
        })}
      <p className="beratung">Alle Berechnungen sind Orientierungshilfen und keine Finanz- oder Anlageberatung.</p>
    </Seite>
  );
}

function PostenZeile({ f, mitKonto }: { f: Fixkosten; mitKonto: boolean }) {
  const { daten } = useDaten();
  const b = useBerechnung();
  const zeige = useNav((s) => s.zeigeSheet);
  const betrag = aktuellerBetrag(f.preise);
  const aktiv = fixkostenAktivAm(f, b.heute);
  return (
    <Zeile
      titel={<span style={{ opacity: aktiv ? 1 : 0.55 }}>{f.name}</span>}
      unter={
        <>
          <span>{zeitplanText(f.zeitplan)}</span>
          {mitKonto && <span>· {kontoVon(daten, f.kontoId)?.name}</span>}
          {f.status === 'pausiert' && <span className="abzeichen grau">pausiert</span>}
          {f.status === 'gekuendigt' && <span className="abzeichen grau">gekündigt</span>}
        </>
      }
      wert={<Betrag wert={betrag} />}
      wertUnter={istNichtMonatlich(f) ? <>≈ <Betrag wert={monatlich(betrag, f.zeitplan.rhythmus)} /> / Monat</> : undefined}
      onClick={() => zeige({ typ: 'fixkosten', id: f.id })}
    />
  );
}
