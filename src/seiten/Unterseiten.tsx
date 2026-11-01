import { AlertTriangle, Lightbulb, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { endgueltigLoeschen, speichere, speichereMehrere, wiederherstellen, type Tabelle } from '../db/aktionen';
import { neueId } from '../domain/standard';
import { TextFeld } from '../ui/Felder';
import { formatTag, plusTage } from '../domain/datum';
import { letzterKontostand, aktuellerBetrag } from '../domain/posten';
import { STAND_VERALTET_TAGE } from '../domain/prognose';
import { TABELLEN } from '../domain/backup';
import { LUECKEN_TEXT } from '../domain/vollstaendigkeit';
import { aendereEinstellungen, useBerechnung, useDaten } from '../state/daten';
import { useNav, type Route, type Sheet } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { PrognoseDiagramm } from '../ui/Diagramme';
import { KONTO_ROLLE_NAMEN, KONTO_TYP_NAMEN } from '../ui/hilfen';
import { Gruppe, Segment, Zeile } from '../ui/Liste';
import { Seite } from '../ui/Seite';
import { SymbolKreis } from '../ui/Symbol';
import { FixkostenZeile } from './Vertraege';

export function Unterseite({ route, zurueck }: { route: Route; zurueck: string }) {
  switch (route.typ) {
    case 'konto':
      return <KontoDetail id={route.id} zurueck={zurueck} />;
    case 'kategorie':
      return <KategorieDetail id={route.id} zurueck={zurueck} />;
    case 'luecken':
      return <Luecken zurueck={zurueck} />;
    case 'papierkorb':
      return <Papierkorb zurueck={zurueck} />;
    case 'kategorien-verwalten':
      return <KategorienVerwalten zurueck={zurueck} />;
    default:
      return null;
  }
}

/** Kleines Abzeichen für unvollständige Einträge ("Tag fehlt"). */
export function LueckenAbzeichen({ refId }: { refId: string }) {
  const { luecken } = useBerechnung();
  const l = luecken.filter((x) => x.refId === refId);
  if (!l.length) return null;
  return (
    <>
      {l.map((x) => (
        <span key={x.art} className="abzeichen gelb">
          {LUECKEN_TEXT[x.art]}
        </span>
      ))}
    </>
  );
}

function KontoDetail({ id, zurueck }: { id: string; zurueck: string }) {
  const { daten, einstellungen } = useDaten();
  const b = useBerechnung();
  const zeige = useNav((s) => s.zeigeSheet);
  const konto = daten.konten.find((k) => k.id === id);
  const d = b.deckung.find((x) => x.konto.id === id);
  const p = b.prognose.find((x) => x.kontoId === id);
  const stand = letzterKontostand(daten, id);
  const posten = daten.fixkosten.filter((f) => f.kontoId === id);
  const naechste = useMemo(() => (p ? p.ereignisse.filter((e) => e.datum >= b.heute && e.datum <= plusTage(b.heute, 31)) : []), [p, b.heute]);

  if (!konto || !d || !p) {
    return (
      <Seite titel="Konto" zurueck={zurueck}>
        <p>Dieses Konto gibt es nicht mehr.</p>
      </Seite>
    );
  }
  const umbuchung = d.vorschlag?.umbuchungId ? daten.umbuchungen.find((u) => u.id === d.vorschlag!.umbuchungId) : undefined;
  const zeilenName = (z: (typeof d.zufluesse)[number]) => z.name + (z.nichtMonatlich ? ' (anteilig)' : '');

  return (
    <Seite titel={konto.name} zurueck={zurueck}>
      <div className="karte" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SymbolKreis symbol={konto.symbol} farbe={konto.farbe} />
        <div style={{ flex: 1 }}>
          <div className="kachel-titel">Kontostand</div>
          {stand ? (
            <>
              <div className="kachel-wert">
                <Betrag wert={stand.betrag} faerben={stand.betrag < 0} />
              </div>
              <div className="kachel-unter">
                Stand vom {formatTag(stand.datum)}
                {(p.standAlterTage ?? 0) > STAND_VERALTET_TAGE && <span className="abzeichen gelb" style={{ marginLeft: 6 }}>veraltet</span>}
              </div>
            </>
          ) : (
            <div className="kachel-unter">Noch kein Kontostand eingetragen</div>
          )}
        </div>
        <button type="button" className="knopf klein" onClick={() => zeige({ typ: 'kontostand', kontoId: id })}>
          Aktualisieren
        </button>
      </div>

      <Gruppe titel="Prognose" gross>
        <div className="karte">
          <Segment
            label="Zeitraum"
            wert={String(einstellungen.prognoseMonate) as '3' | '6' | '12'}
            onChange={(v) => void aendereEinstellungen({ prognoseMonate: Number(v) as 3 | 6 | 12 })}
            werte={[
              { id: '3', text: '3 Monate' },
              { id: '6', text: '6 Monate' },
              { id: '12', text: '12 Monate' },
            ]}
          />
          {p.ohneStand && <p className="kachel-unter">Ohne eingetragenen Kontostand startet die Prognose bei 0 € und zeigt keine Warnungen.</p>}
          <PrognoseDiagramm punkte={p.punkte} puffer={konto.mindestpuffer} name={konto.name} heute={b.heute} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }} className="kachel-unter">
            <span>
              Tiefster Stand: <Betrag wert={p.tiefpunkt.saldo} /> am {formatTag(p.tiefpunkt.datum)}
            </span>
          </div>
          {konto.mindestpuffer > 0 && (
            <div className="kachel-unter">
              Gestrichelt: Mindestpuffer <Betrag wert={konto.mindestpuffer} kurz />
            </div>
          )}
          {p.angenommeneTermine > 0 && <div className="kachel-unter">{p.angenommeneTermine} Termine ohne Tag wurden am 1. des Monats angenommen.</div>}
        </div>
      </Gruppe>
      {p.warnungen.map((w) => (
        <div key={w.datum} className="hinweis rot" style={{ marginTop: 8 }}>
          <AlertTriangle size={20} aria-hidden="true" />
          <span>{w.text}</span>
        </div>
      ))}

      <Gruppe titel="Deckung pro Monat" gross fuss="Monatsdurchschnitt: Quartals-, Halbjahres- und Jahreszahlungen sind anteilig enthalten. Die echten Termine siehst du in der Prognose.">
        {d.zufluesse.map((z) => (
          <Zeile key={`z-${z.art}-${z.refId}`} titel={z.name} wert={<Betrag wert={z.monatlich} vorzeichen />} />
        ))}
        {d.abfluesse.map((z) => (
          <Zeile key={`a-${z.art}-${z.refId}`} titel={zeilenName(z)} wert={<Betrag wert={-z.monatlich} />} />
        ))}
        {d.anteiligeRuecklage > 0 && (
          <Zeile titel={<span className="text-2">davon monatlich zurückzulegen für nicht-monatliche Zahlungen</span>} wert={<span className="text-2"><Betrag wert={d.anteiligeRuecklage} /></span>} />
        )}
        <Zeile
          titel={<strong>{d.saldoMonat === 0 ? 'Genau gedeckt' : d.saldoMonat > 0 ? 'Überdeckung' : 'Unterdeckung'}</strong>}
          wert={<strong><Betrag wert={d.saldoMonat} vorzeichen faerben /></strong>}
        />
      </Gruppe>
      {d.vorschlag && (
        <div className="hinweis blau" style={{ marginTop: 8 }}>
          <Lightbulb size={20} aria-hidden="true" />
          <div>
            {d.vorschlag.text}
            {umbuchung && d.vorschlag.neuerBetrag !== undefined && (
              <div className="hinweis-aktionen">
                <button type="button" className="link-knopf" onClick={() => void speichere('umbuchungen', { ...umbuchung, betrag: d.vorschlag!.neuerBetrag! }, 'Dauerauftrag angepasst')}>
                  Auf&nbsp;<Betrag wert={d.vorschlag.neuerBetrag} />&nbsp;ändern
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Gruppe titel="Nächste 31 Tage">
        {naechste.length === 0 && <Zeile titel={<span className="text-2">Keine Buchungen.</span>} />}
        {naechste.map((e) => (
          <Zeile
            key={e.schluessel}
            titel={e.name}
            unter={
              <>
                {formatTag(e.datum)}
                {e.angenommen && <span className="abzeichen gelb">Tag angenommen</span>}
              </>
            }
            wert={<Betrag wert={e.betrag} vorzeichen />}
          />
        ))}
      </Gruppe>

      <Gruppe titel={`Fixkosten auf ${konto.name}`} aktion={{ text: 'Hinzufügen', onClick: () => zeige({ typ: 'fixkosten', vorlageKontoId: id }) }}>
        {posten.length === 0 && <Zeile titel={<span className="text-2">Keine Fixkosten auf diesem Konto.</span>} />}
        {posten.map((f) => (
          <FixkostenZeile key={f.id} f={f} />
        ))}
      </Gruppe>

      <Gruppe titel="Konto">
        <Zeile titel="Typ" wert={<span className="text-2">{KONTO_TYP_NAMEN[konto.typ]}</span>} />
        <Zeile titel="Rolle" wert={<span className="text-2">{KONTO_ROLLE_NAMEN[konto.rolle]}</span>} />
        {konto.bank && <Zeile titel="Bank" wert={<span className="text-2">{konto.bank}</span>} />}
        {konto.ibanLast4 && <Zeile titel="IBAN" wert={<span className="text-2 zahl">•••• {konto.ibanLast4}</span>} />}
        <Zeile titel="Bearbeiten" onClick={() => zeige({ typ: 'konto', id })} />
      </Gruppe>
    </Seite>
  );
}

function KategorieDetail({ id, zurueck }: { id: string; zurueck: string }) {
  const { daten } = useDaten();
  const kat = daten.kategorien.find((k) => k.id === id);
  const posten = daten.fixkosten.filter((f) => f.kategorieId === id);
  return (
    <Seite titel={kat?.name ?? 'Kategorie'} zurueck={zurueck}>
      <Gruppe>
        {posten.map((f) => (
          <FixkostenZeile key={f.id} f={f} />
        ))}
      </Gruppe>
    </Seite>
  );
}

function Luecken({ zurueck }: { zurueck: string }) {
  const { daten } = useDaten();
  const { luecken } = useBerechnung();
  const zeige = useNav((s) => s.zeigeSheet);
  const sheetFuer = (bereich: string, refId: string): Sheet =>
    bereich === 'konto' ? { typ: 'kontostand', kontoId: refId } : bereich === 'einkommen' ? { typ: 'einkommen', id: refId } : bereich === 'umbuchung' ? { typ: 'umbuchung', id: refId } : bereich === 'sparplan' ? { typ: 'sparplan', id: refId } : { typ: 'fixkosten', id: refId };
  const gruppen: { titel: string; bereich: string }[] = [
    { titel: 'Kontostände', bereich: 'konto' },
    { titel: 'Einkommen', bereich: 'einkommen' },
    { titel: 'Umbuchungen', bereich: 'umbuchung' },
    { titel: 'Sparpläne', bereich: 'sparplan' },
    { titel: 'Fixkosten', bereich: 'fixkosten' },
  ];
  const vertragOffen = daten.fixkosten.filter((f) => f.status === 'aktiv' && (!f.vertrag?.beginn || f.vertrag.mindestlaufzeitMonate == null || !f.vertrag.kuendigungsfrist)).length;
  return (
    <Seite titel="Unvollständig" zurueck={zurueck}>
      {luecken.length === 0 && <p className="text-2">Alles vollständig.</p>}
      {gruppen.map((g) => {
        const l = luecken.filter((x) => x.bereich === g.bereich);
        if (!l.length) return null;
        return (
          <Gruppe key={g.bereich} titel={g.titel}>
            {l.map((x) => (
              <Zeile key={`${x.refId}-${x.art}`} titel={x.name} unter={<span className="abzeichen gelb">{x.text}</span>} onClick={() => zeige(sheetFuer(x.bereich, x.refId))} />
            ))}
          </Gruppe>
        );
      })}
      {vertragOffen > 0 && (
        <p className="gruppe-fuss" style={{ marginTop: 16 }}>
          Bei {vertragOffen} Verträgen fehlen Beginn, Mindestlaufzeit oder Kündigungsfrist. Ohne diese Angaben kann „Bald kündbar“ sie nicht berücksichtigen.
        </p>
      )}
    </Seite>
  );
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
