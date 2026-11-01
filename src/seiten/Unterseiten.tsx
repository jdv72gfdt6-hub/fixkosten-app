import { RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { endgueltigLoeschen, speichereMehrere, wiederherstellen, type Tabelle } from '../db/aktionen';
import { neueId } from '../domain/standard';
import { TextFeld } from '../ui/Felder';
import { formatTag } from '../domain/datum';
import { aktuellerBetrag } from '../domain/posten';
import { TABELLEN } from '../domain/backup';
import { useDaten } from '../state/daten';
import type { Route } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { Gruppe, Zeile } from '../ui/Liste';
import { Seite } from '../ui/Seite';
import { EinstellungenSeite } from './Einstellungen';

export function Unterseite({ route, zurueck }: { route: Route; zurueck: string }) {
  switch (route.typ) {
    case 'einstellungen':
      return <EinstellungenSeite zurueck={zurueck} />;
    case 'papierkorb':
      return <Papierkorb zurueck="Einstellungen" />;
    case 'kategorien-verwalten':
      return <KategorienVerwalten zurueck="Einstellungen" />;
  }
}
/** Kategorien und Lebensbereiche umbenennen oder ergänzen. */
function KategorienVerwalten({ zurueck }: { zurueck: string }) {
  const { daten } = useDaten();
  const [kat, setKat] = useState(() => daten.kategorien.map((k) => ({ ...k })));
  const [lb, setLb] = useState(() => daten.lebensbereiche.map((l) => ({ ...l })));
  const sichern = () =>
    void speichereMehrere(
      [
        ...kat.filter((k) => k.name.trim()).map((wert) => ({ tabelle: 'kategorien' as const, wert: { ...wert, name: wert.name.trim() } })),
        ...lb.filter((l) => l.name.trim()).map((wert) => ({ tabelle: 'lebensbereiche' as const, wert: { ...wert, name: wert.name.trim() } })),
      ],
      'Kategorien gespeichert',
    );
  return (
    <Seite titel="Kategorien" zurueck={zurueck}>
      <Gruppe titel="Kategorien" aktion={{ text: 'Hinzufügen', onClick: () => setKat([...kat, { id: neueId('kat'), name: '', farbe: 'gray', symbol: 'circle-ellipsis', reihenfolge: kat.length + 1 }]) }}>
        {kat.map((k, i) => (
          <TextFeld key={k.id} label={`Kategorie ${i + 1}`} wert={k.name} onChange={(name) => setKat(kat.map((x) => (x.id === k.id ? { ...x, name } : x)))} />
        ))}
      </Gruppe>
      <Gruppe titel="Lebensbereiche" aktion={{ text: 'Hinzufügen', onClick: () => setLb([...lb, { id: neueId('lb'), name: '', farbe: 'gray', reihenfolge: lb.length + 1 }]) }} fuss="Lebensbereiche fassen Kosten unabhängig von der Kategorie zusammen (z. B. alles rund ums Auto).">
        {lb.map((l, i) => (
          <TextFeld key={l.id} label={`Bereich ${i + 1}`} wert={l.name} onChange={(name) => setLb(lb.map((x) => (x.id === l.id ? { ...x, name } : x)))} />
        ))}
      </Gruppe>
      <div style={{ marginTop: 16 }}>
        <button type="button" className="knopf" onClick={sichern}>
          Sichern
        </button>
      </div>
    </Seite>
  );
}

const TABELLEN_NAMEN: Partial<Record<Tabelle, string>> = {
  fixkosten: 'Fixkosten',
  konten: 'Konto',
  einkommen: 'Einkommen',
  umbuchungen: 'Umbuchung',
  sparplaene: 'Sparplan',
  ruecklagen: 'Rücklage',
  budgets: 'Budget',
  einmalig: 'Einmalig',
};

function Papierkorb({ zurueck }: { zurueck: string }) {
  const { roh } = useDaten();
  const eintraege = TABELLEN.flatMap((t) =>
    (roh[t] as { id: string; name?: string; geloeschtAm?: string; betrag?: number; preise?: { gueltigAb: string; betrag: number }[] }[])
      .filter((x) => x.geloeschtAm)
      .map((x) => ({ t, x })),
  ).sort((a, c) => (a.x.geloeschtAm! < c.x.geloeschtAm! ? 1 : -1));
  return (
    <Seite titel="Papierkorb" zurueck={zurueck}>
      <Gruppe fuss="Gelöschte Einträge bleiben 30 Tage hier und werden danach endgültig entfernt.">
        {eintraege.length === 0 && <Zeile titel={<span className="text-2">Der Papierkorb ist leer.</span>} />}
        {eintraege.map(({ t, x }) => (
          <div key={x.id} className="zeile">
            <span className="zeile-inhalt">
              <span className="zeile-titel" style={{ display: 'block' }}>{x.name ?? TABELLEN_NAMEN[t] ?? t}</span>
              <span className="zeile-unter">
                {TABELLEN_NAMEN[t] ?? t} · gelöscht am {formatTag(x.geloeschtAm!)}
                {x.preise && <> · <Betrag wert={aktuellerBetrag(x.preise)} /></>}
              </span>
            </span>
            <button type="button" className="kapsel" style={{ border: 0, background: 'none', color: 'var(--akzent)' }} aria-label={`${x.name ?? ''} wiederherstellen`} onClick={() => void wiederherstellen(t, x.id)}>
              <RotateCcw size={20} />
            </button>
            <button
              type="button"
              className="kapsel"
              style={{ border: 0, background: 'none', color: 'var(--rot)' }}
              aria-label={`${x.name ?? ''} endgültig löschen`}
              onClick={() => {
                if (confirm('Endgültig löschen? Das kann nicht rückgängig gemacht werden.')) void endgueltigLoeschen(t, x.id);
              }}
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </Gruppe>
    </Seite>
  );
}
