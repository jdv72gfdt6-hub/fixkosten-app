import { useState } from 'react';
import { aktuellerBetrag } from '../domain/posten';
import { useDaten } from '../state/daten';
import { geheZu, useNav } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { kontoVon, zeitplanText } from '../ui/hilfen';
import { Gruppe, Zeile } from '../ui/Liste';
import { Sheet } from '../ui/Sheet';

export function SucheSheet({ onSchliessen }: { onSchliessen: () => void }) {
  const { daten } = useDaten();
  const [q, setQ] = useState('');
  const n = q.trim().toLowerCase();
  const passt = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(n));
  const fix = n ? daten.fixkosten.filter((f) => passt(f.name, f.anbieter, f.notiz, ...(f.tags ?? []))) : [];
  const konten = n ? daten.konten.filter((k) => passt(k.name, k.bank)) : [];
  const ersetze = (s: Parameters<ReturnType<typeof useNav.getState>['zeigeSheet']>[0]) => useNav.setState((x) => ({ sheets: [...x.sheets.slice(0, -1), s] }));
  return (
    <Sheet titel="Suchen" onSchliessen={onSchliessen} links={{ text: 'Fertig', onClick: onSchliessen }}>
      <div className="gruppe">
        <div className="feld">
          <input aria-label="Suchbegriff" type="search" placeholder="Name, Anbieter, Notiz …" value={q} onChange={(e) => setQ(e.target.value)} style={{ textAlign: 'left' }} autoFocus />
        </div>
      </div>
      {konten.length > 0 && (
        <Gruppe titel="Konten">
          {konten.map((k) => (
            <Zeile key={k.id} titel={k.name} unter={k.bank} onClick={() => (onSchliessen(), geheZu('konten', { typ: 'konto', id: k.id }))} />
          ))}
        </Gruppe>
      )}
      {fix.length > 0 && (
        <Gruppe titel="Fixkosten">
          {fix.map((f) => (
            <Zeile key={f.id} titel={f.name} unter={`${zeitplanText(f.zeitplan)} · ${kontoVon(daten, f.kontoId)?.name ?? ''}`} wert={<Betrag wert={aktuellerBetrag(f.preise)} />} onClick={() => ersetze({ typ: 'fixkosten', id: f.id })} />
          ))}
        </Gruppe>
      )}
      {n && !fix.length && !konten.length && <p className="gruppe-fuss">Keine Treffer.</p>}
    </Sheet>
  );
}
