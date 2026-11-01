/* Ruhige, reduzierte Diagramme: keine 3D-Effekte, keine Verläufe. Mit Textzusammenfassung für VoiceOver. */
import { sankey, type SankeyLink, type SankeyNode } from 'd3-sankey';
import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { KontoDeckung, Monatsuebersicht } from '../domain/bilanz';
import { formatTag, monatsname, teile } from '../domain/datum';
import { formatEuro } from '../domain/geld';
import type { PrognosePunkt } from '../domain/prognose';
import type { Cent, Daten } from '../domain/typen';
import { useDatenOptional } from '../state/daten';
import { farbe } from './Symbol';

export function PrognoseDiagramm({ punkte, puffer, name, heute }: { punkte: PrognosePunkt[]; puffer: Cent; name: string; heute: string }) {
  const ausblenden = useDatenOptional()?.einstellungen.betraegeAusblenden;
  const ab = punkte.filter((p) => p.datum >= heute);
  const tief = ab.reduce((m, p) => (p.saldo < m.saldo ? p : m), ab[0] ?? { datum: heute, saldo: 0 });
  const ende = ab.at(-1);
  const zusammenfassung = ende
    ? `Prognose ${name} bis ${formatTag(ende.datum)}: tiefster Stand ${formatEuro(tief.saldo)} am ${formatTag(tief.datum)}, Endstand ${formatEuro(ende.saldo)}.`
    : 'Keine Prognose verfügbar.';
  const daten = ab.map((p) => ({ t: p.datum, euro: p.saldo / 100 }));
  const monatsAnfaenge = daten.filter((d) => d.t.endsWith('-01')).map((d) => d.t);

  return (
    <figure className="diagramm" style={{ margin: 0 }} aria-label={zusammenfassung} role="img">
      <figcaption className="nur-screenreader">{zusammenfassung}</figcaption>
      <div style={{ height: 200 }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={daten} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="t" ticks={monatsAnfaenge} tickFormatter={(t: string) => monatsname(teile(t).monat, true)} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis width={ausblenden ? 8 : 52} tickLine={false} axisLine={false} tickFormatter={(v: number) => (ausblenden ? '' : `${Math.round(v).toLocaleString('de-DE')} €`)} />
            {puffer > 0 && <ReferenceLine y={puffer / 100} stroke="var(--f-orange)" strokeDasharray="4 4" />}
            <ReferenceLine y={0} stroke="var(--trenner)" />
            <Tooltip
              cursor={{ stroke: 'var(--text-3)', strokeWidth: 1 }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className="diagramm-tooltip">
                    <div>{formatTag(String(payload[0].payload.t))}</div>
                    <strong className="zahl">{ausblenden ? '••• €' : formatEuro(Math.round(Number(payload[0].value) * 100))}</strong>
                  </div>
                ) : null
              }
            />
            <Line type="stepAfter" dataKey="euro" stroke="var(--chart-linie)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

interface Knoten {
  id: string;
  name: string;
  farbe: string;
}
interface Verbindung {
  source: string;
  target: string;
  value: number;
}

/** Geldfluss als Sankey: Einkommen → Konten → (Umbuchungen) → Fixkosten, Sparen, Rücklagen, Budget, frei. */
export function GeldflussDiagramm({ daten, deckung, uebersicht }: { daten: Daten; deckung: KontoDeckung[]; uebersicht: Monatsuebersicht }) {
  const breite = 358;
  const ausblenden = useDatenOptional()?.einstellungen.betraegeAusblenden;

  const layout = useMemo(() => {
    const knoten = new Map<string, Knoten>();
    const links: Verbindung[] = [];
    const k = (id: string, name: string, f: string) => {
      if (!knoten.has(id)) knoten.set(id, { id, name, farbe: f });
    };
    const ziel = {
      fix: () => k('z-fix', 'Fixkosten', 'orange'),
      vermoegen: () => k('z-vermoegen', 'Vermögensaufbau', 'mint'),
      ruecklage: () => k('z-ruecklage', 'Rücklagen', 'cyan'),
      budget: () => k('z-budget', 'Variables Budget', 'purple'),
      frei: () => k('z-frei', 'Frei', 'green'),
    };
    const add = (source: string, target: string, jc: number) => {
      const value = jc / 12;
      if (value <= 0) return;
      const vorhanden = links.find((l) => l.source === source && l.target === target);
      if (vorhanden) vorhanden.value += value;
      else links.push({ source, target, value });
    };
    for (const e of daten.einkommen) k(`e-${e.id}`, e.name, 'blue');
    for (const d of deckung) {
      const kid = `k-${d.konto.id}`;
      const hatFluss = d.zufluesse.some((z) => z.art !== 'probe-ein') || d.abfluesse.length > 0;
      if (!hatFluss) continue;
      k(kid, d.konto.name, d.konto.farbe);
      for (const z of d.zufluesse) if (z.art === 'einkommen') add(`e-${z.refId}`, kid, z.jahresCent);
      for (const z of d.abfluesse) {
        if (z.art === 'umbuchung-aus') {
          const u = daten.umbuchungen.find((x) => x.id === z.refId);
          if (u) add(kid, `k-${u.nachKontoId}`, z.jahresCent);
        } else if (z.art === 'sparen-aus') {
          const s = daten.sparplaene.find((x) => x.id === z.refId);
          if (s?.zielKontoId) add(kid, `k-${s.zielKontoId}`, z.jahresCent);
          else (ziel.vermoegen(), add(kid, 'z-vermoegen', z.jahresCent));
        } else if (z.art === 'fixkosten') {
          ziel.fix();
          add(kid, 'z-fix', z.jahresCent);
        } else if (z.art === 'budget') {
          ziel.budget();
          add(kid, 'z-budget', z.jahresCent);
        } else if (z.art === 'ruecklage') {
          ziel.ruecklage();
          add(kid, 'z-ruecklage', z.jahresCent);
        } else if (z.art === 'karte-aus') {
          add(kid, `k-${z.refId}`, z.jahresCent);
        }
      }
      const saldoJc = d.zufluesse.filter((z) => z.art !== 'probe-ein').reduce((s, z) => s + z.jahresCent, 0) - d.abfluesse.reduce((s, z) => s + z.jahresCent, 0);
      if (saldoJc > 0) {
        const rolle = d.konto.rolle;
        const t = rolle === 'vermoegen' ? 'z-vermoegen' : rolle === 'ruecklage' ? 'z-ruecklage' : 'z-frei';
        if (t === 'z-vermoegen') ziel.vermoegen();
        else if (t === 'z-ruecklage') ziel.ruecklage();
        else ziel.frei();
        add(kid, t, saldoJc);
      }
    }
    const ids = new Set(links.flatMap((l) => [l.source, l.target]));
    const nodes = [...knoten.values()].filter((n) => ids.has(n.id));
    if (nodes.length < 2) return null;
    const hoehe = Math.max(260, nodes.length * 34);
    const generator = sankey<Knoten, Verbindung>()
      .nodeId((n) => n.id)
      .nodeWidth(8)
      .nodePadding(14)
      .extent([
        [1, 6],
        [breite - 1, hoehe - 6],
      ]);
    const g = generator({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) });
    return { ...g, hoehe };
  }, [daten, deckung]);

  if (!layout) return <p className="text-2">Lege Einkommen, Umbuchungen und Fixkosten an, um den Geldfluss zu sehen.</p>;

  type N = SankeyNode<Knoten, Verbindung>;
  type L = SankeyLink<Knoten, Verbindung>;
  const zusammenfassung = `Geldfluss pro Monat: Einkommen ${formatEuro(uebersicht.einkommen)}, davon Fixkosten ${formatEuro(uebersicht.fixkosten)}, Vermögensaufbau ${formatEuro(uebersicht.vermoegensaufbau)}, Rücklagen ${formatEuro(uebersicht.ruecklagen)}, variables Budget ${formatEuro(uebersicht.budgets)}, frei ${formatEuro(uebersicht.frei)}.`;

  const pfad = (l: L) => {
    const s = l.source as N;
    const t = l.target as N;
    const x0 = s.x1!;
    const x1 = t.x0!;
    const xm = (x0 + x1) / 2;
    return `M${x0},${l.y0} C${xm},${l.y0} ${xm},${l.y1} ${x1},${l.y1}`;
  };

  return (
    <figure style={{ margin: 0 }} role="img" aria-label={zusammenfassung}>
      <svg className="sankey" viewBox={`0 0 ${breite} ${layout.hoehe}`} width="100%" aria-hidden="true">
        <g fill="none">
          {(layout.links as L[]).map((l, i) => (
            <path key={i} d={pfad(l)} stroke={farbe((l.source as N).farbe)} strokeOpacity={0.28} strokeWidth={Math.max(1, l.width!)} />
          ))}
        </g>
        {(layout.nodes as N[]).map((n) => {
          const rechts = n.x0! > breite / 2;
          const x = rechts ? n.x0! - 4 : n.x1! + 4;
          const y = (n.y0! + n.y1!) / 2;
          return (
            <g key={n.id}>
              <rect x={n.x0} y={n.y0} width={n.x1! - n.x0!} height={Math.max(2, n.y1! - n.y0!)} fill={farbe(n.farbe)} rx={2} />
              <text x={x} y={y - 2} textAnchor={rechts ? 'end' : 'start'}>
                {n.name}
              </text>
              {!ausblenden && (
                <text className="wert" x={x} y={y + 11} textAnchor={rechts ? 'end' : 'start'}>
                  {formatEuro(Math.round(n.value!), { kurz: true })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
