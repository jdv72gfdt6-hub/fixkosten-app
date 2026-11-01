import { ArrowLeftRight, Banknote, CalendarPlus, PiggyBank, Plus, Receipt, Wallet } from 'lucide-react';
import { formatTag } from '../domain/datum';
import { monatlich } from '../domain/geld';
import { aktuellerBetrag, letzterKontostand } from '../domain/posten';
import { useBerechnung, useDaten } from '../state/daten';
import { useAnsicht, useNav } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { GeldflussDiagramm } from '../ui/Diagramme';
import { DeckungAbzeichen, KONTO_ROLLE_NAMEN, kontoVon, zeitplanText } from '../ui/hilfen';
import { Gruppe, Leer, Segment, Zeile } from '../ui/Liste';
import { Seite } from '../ui/Seite';
import { SymbolKreis } from '../ui/Symbol';
import { LueckenAbzeichen } from './Unterseiten';

export function KontenSeite() {
  const ansicht = useAnsicht((s) => s.konten);
  const setze = useAnsicht((s) => s.setze);
  return (
    <Seite titel={ansicht === 'konten' ? 'Konten' : 'Geldfluss'}>
      <Segment
        label="Ansicht"
        wert={ansicht}
        onChange={(v) => setze({ konten: v })}
        werte={[
          { id: 'konten', text: 'Konten' },
          { id: 'geldfluss', text: 'Geldfluss' },
        ]}
      />
      {ansicht === 'konten' ? <KontenListe /> : <Geldfluss />}
    </Seite>
  );
}

function KontenListe() {
  const { daten } = useDaten();
  const b = useBerechnung();
  const { oeffne, zeigeSheet } = useNav();
  if (daten.konten.length === 0) {
    return (
      <Leer
        symbol={<Wallet size={36} aria-hidden="true" />}
        titel="Noch keine Konten"
        text="Lege deine Konten an, z. B. Girokonto, Fixkostenkonto und Tagesgeld. Danach siehst du hier, ob jedes Konto gedeckt ist."
        aktion={{ text: 'Konto anlegen', onClick: () => zeigeSheet({ typ: 'konto' }) }}
      />
    );
  }
  const sortiert = [...b.deckung].sort((a, c) => a.konto.reihenfolge - c.konto.reihenfolge);
  return (
    <>
      <Gruppe fuss="Deckung = monatliche Zuflüsse minus Abflüsse (inkl. anteiliger Jahreszahlungen).">
        {sortiert.map((d) => {
          const stand = letzterKontostand(daten, d.konto.id);
          return (
            <Zeile
              key={d.konto.id}
              symbol={<SymbolKreis symbol={d.konto.symbol} farbe={d.konto.farbe} />}
              titel={d.konto.name}
              unter={
                <>
                  <span>{KONTO_ROLLE_NAMEN[d.konto.rolle]}</span>
                  <DeckungAbzeichen d={d} />
                </>
              }
              wert={stand ? <Betrag wert={stand.betrag} /> : <span className="abzeichen gelb">Stand fehlt</span>}
              wertUnter={stand ? formatTag(stand.datum) : undefined}
              onClick={() => oeffne({ typ: 'konto', id: d.konto.id })}
            />
          );
        })}
      </Gruppe>
      <div style={{ marginTop: 16 }}>
        <button type="button" className="knopf zweit" onClick={() => zeigeSheet({ typ: 'konto' })}>
          <Plus size={20} aria-hidden="true" /> Konto hinzufügen
        </button>
      </div>
    </>
  );
}

function Geldfluss() {
  const { daten } = useDaten();
  const b = useBerechnung();
  const zeige = useNav((s) => s.zeigeSheet);
  const name = (id?: string) => kontoVon(daten, id)?.name ?? '–';

  return (
    <>
      <div className="karte">
        <GeldflussDiagramm daten={daten} deckung={b.deckung} uebersicht={b.uebersicht} />
      </div>

      <Gruppe titel="Einkommen" aktion={{ text: 'Hinzufügen', onClick: () => zeige({ typ: 'einkommen' }) }}>
        {daten.einkommen.length === 0 && <Zeile titel={<span className="text-2">Noch kein Einkommen eingetragen.</span>} />}
        {daten.einkommen.map((e) => (
          <Zeile
            key={e.id}
            symbol={<SymbolKreis symbol="banknote" farbe="blue" />}
            titel={e.name}
            unter={
              <>
                {zeitplanText(e.zeitplan)} → {name(e.zielKontoId)} <LueckenAbzeichen refId={e.id} />
              </>
            }
            wert={<Betrag wert={aktuellerBetrag(e.historie)} />}
            onClick={() => zeige({ typ: 'einkommen', id: e.id })}
          />
        ))}
      </Gruppe>

      <Gruppe titel="Umbuchungen" aktion={{ text: 'Hinzufügen', onClick: () => zeige({ typ: 'umbuchung' }) }} fuss="Umbuchungen zwischen deinen Konten sind keine Kosten und erscheinen in keiner Kostenauswertung.">
        {daten.umbuchungen.length === 0 && <Zeile titel={<span className="text-2">Noch keine Daueraufträge zwischen deinen Konten.</span>} />}
        {daten.umbuchungen.map((u) => (
          <Zeile
            key={u.id}
            symbol={<span className="symbol-kreis" style={{ background: 'var(--f-gray)' }} aria-hidden="true"><ArrowLeftRight size={17} /></span>}
            titel={`${name(u.vonKontoId)} → ${name(u.nachKontoId)}`}
            unter={
              <>
                {zeitplanText(u.zeitplan)} <LueckenAbzeichen refId={u.id} />
              </>
            }
            wert={<Betrag wert={u.betrag} />}
            onClick={() => zeige({ typ: 'umbuchung', id: u.id })}
          />
        ))}
      </Gruppe>

      <Gruppe titel="Vermögensaufbau" aktion={{ text: 'Hinzufügen', onClick: () => zeige({ typ: 'sparplan' }) }} fuss="Zählt zur Sparquote, nicht zu den Fixkosten.">
        {daten.sparplaene.length === 0 && <Zeile titel={<span className="text-2">Keine Sparpläne.</span>} />}
        {daten.sparplaene.map((s) => (
          <Zeile
            key={s.id}
            symbol={<span className="symbol-kreis" style={{ background: 'var(--f-mint)' }} aria-hidden="true"><PiggyBank size={17} /></span>}
            titel={s.name}
            unter={`${zeitplanText(s.zeitplan)} · von ${name(s.vonKontoId)}`}
            wert={<Betrag wert={monatlich(s.betrag, s.zeitplan.rhythmus)} />}
            onClick={() => zeige({ typ: 'sparplan', id: s.id })}
          />
        ))}
      </Gruppe>

      <Gruppe titel="Rücklagen-Töpfe" aktion={{ text: 'Hinzufügen', onClick: () => zeige({ typ: 'ruecklage' }) }} fuss="Rücklagen sind weder Kosten noch Vermögensaufbau. Ein Topf liegt auf einem eigenen Konto oder virtuell auf einem Konto mit anderen Zwecken.">
        {daten.ruecklagen.length === 0 && <Zeile titel={<span className="text-2">Keine Töpfe.</span>} />}
        {daten.ruecklagen.map((r) => {
          const eingehend = daten.umbuchungen.filter((u) => u.nachKontoId === r.kontoId).reduce((s, u) => s + monatlich(u.betrag, u.zeitplan.rhythmus), 0);
          return (
            <Zeile
              key={r.id}
              symbol={<span className="symbol-kreis" style={{ background: 'var(--f-cyan)' }} aria-hidden="true"><Banknote size={17} /></span>}
              titel={r.name}
              unter={`${r.virtuell ? 'Virtuell auf' : 'Eigenes Konto'} ${name(r.kontoId)}`}
              wert={<Betrag wert={r.virtuell ? (r.monatlich ?? 0) : eingehend} />}
              wertUnter="pro Monat"
              onClick={() => zeige({ typ: 'ruecklage', id: r.id })}
            />
          );
        })}
      </Gruppe>

      <Gruppe titel="Variables Budget" aktion={{ text: 'Hinzufügen', onClick: () => zeige({ typ: 'budget' }) }} fuss="Keine Fixkosten – zählt aber in „Frei verfügbar“ und in der Kontostand-Prognose.">
        {daten.budgets.length === 0 && <Zeile titel={<span className="text-2">Kein Budget.</span>} />}
        {daten.budgets.map((x) => (
          <Zeile
            key={x.id}
            symbol={<span className="symbol-kreis" style={{ background: 'var(--f-purple)' }} aria-hidden="true"><Receipt size={17} /></span>}
            titel={x.name}
            unter={`von ${name(x.kontoId)}`}
            wert={<Betrag wert={x.monatlich} />}
            onClick={() => zeige({ typ: 'budget', id: x.id })}
          />
        ))}
      </Gruppe>

      <Gruppe titel="Einmalig geplant" aktion={{ text: 'Hinzufügen', onClick: () => zeige({ typ: 'einmalig' }) }} fuss="Fließen in die Kontostand-Prognose ein, aber nicht in die Fixkosten.">
        {daten.einmalig.length === 0 && <Zeile titel={<span className="text-2">Keine geplanten Einzelbuchungen.</span>} />}
        {[...daten.einmalig]
          .sort((a, c) => (a.datum < c.datum ? -1 : 1))
          .map((x) => (
            <Zeile
              key={x.id}
              symbol={<span className="symbol-kreis" style={{ background: 'var(--f-brown)' }} aria-hidden="true"><CalendarPlus size={17} /></span>}
              titel={x.name}
              unter={`${formatTag(x.datum)} · ${name(x.kontoId)}`}
              wert={<Betrag wert={x.art === 'einnahme' ? x.betrag : -x.betrag} />}
              onClick={() => zeige({ typ: 'einmalig', id: x.id })}
            />
          ))}
      </Gruppe>
    </>
  );
}
