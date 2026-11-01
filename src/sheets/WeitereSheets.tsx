/* Eingabe-Sheets für Konten, Kontostand, Einkommen, Umbuchungen, Sparpläne, Budgets, Rücklagen und Einmaliges. */
import { useState, type ReactNode } from 'react';
import { inPapierkorb, speichere, type Tabelle } from '../db/aktionen';
import { formatTag } from '../domain/datum';
import { aktuellerBetrag, letzterKontostand } from '../domain/posten';
import { spartoepfe } from '../domain/ruecklagen';
import { neueId, zeitplan } from '../domain/standard';
import type { Budget, Einkommen, Einmalig, Konto, KontoRolle, KontoTyp, Ruecklage, Sparplan, Umbuchung } from '../domain/typen';
import { aendereEinstellungen, heute, useDaten } from '../state/daten';
import { Betrag } from '../ui/Betrag';
import { AuswahlFeld, BetragFeld, DatumFeld, KontoFeld, SchalterFeld, TextFeld, ZahlFeld, ZeitplanFelder } from '../ui/Felder';
import { KONTO_ROLLE_NAMEN, KONTO_TYP_NAMEN } from '../ui/hilfen';
import { Gruppe, Zeile } from '../ui/Liste';
import { Sheet } from '../ui/Sheet';
import { FARBEN, SYMBOL_NAMEN, SymbolKreis } from '../ui/Symbol';

interface Basis {
  onSchliessen: () => void;
}

function Loeschen({ tabelle, id, name, onSchliessen, bestaetigen }: { tabelle: Tabelle; id: string; name: string; onSchliessen: () => void; bestaetigen?: string }) {
  return (
    <div style={{ marginTop: 20 }}>
      <button
        type="button"
        className="knopf gefahr"
        onClick={() => {
          if (bestaetigen && !confirm(bestaetigen)) return;
          void inPapierkorb(tabelle, id, `${name} gelöscht`);
          onSchliessen();
        }}
      >
        Löschen
      </button>
    </div>
  );
}

function FormSheet({ titel, onSchliessen, gueltig, sichern, children }: Basis & { titel: string; gueltig: boolean; sichern: () => Promise<void>; children: ReactNode }) {
  return (
    <Sheet
      titel={titel}
      onSchliessen={onSchliessen}
      rechts={{
        text: 'Sichern',
        deaktiviert: !gueltig,
        onClick: () => void sichern().then(onSchliessen),
      }}
    >
      {children}
    </Sheet>
  );
}

export function KontoSheet({ id, onSchliessen }: Basis & { id?: string }) {
  const { daten } = useDaten();
  const alt = id ? daten.konten.find((k) => k.id === id) : undefined;
  const [k, setK] = useState<Konto>(
    alt ?? { id: neueId('k'), name: '', typ: 'giro', bank: '', rolle: 'fixkosten', mindestpuffer: 10000, farbe: 'blue', symbol: 'landmark', reihenfolge: daten.konten.length + 1 },
  );
  const ibanFehler = !!k.ibanLast4 && !/^\d{4}$/.test(k.ibanLast4);
  return (
    <FormSheet titel={alt ? 'Konto bearbeiten' : 'Neues Konto'} onSchliessen={onSchliessen} gueltig={!!k.name.trim() && !ibanFehler} sichern={() => speichere('konten', { ...k, name: k.name.trim() }, alt ? 'Konto gespeichert' : 'Konto angelegt')}>
      <div className="gruppe">
        <TextFeld label="Name" wert={k.name} onChange={(name) => setK({ ...k, name })} platzhalter="z. B. Fixkostenkonto" autoFocus={!alt} />
        <TextFeld label="Bank" wert={k.bank} onChange={(bank) => setK({ ...k, bank })} platzhalter="optional" />
        <AuswahlFeld<KontoTyp> label="Typ" wert={k.typ} onChange={(typ) => setK({ ...k, typ })} optionen={Object.entries(KONTO_TYP_NAMEN).map(([wert, text]) => ({ wert: wert as KontoTyp, text }))} />
        <AuswahlFeld<KontoRolle> label="Rolle" wert={k.rolle} onChange={(rolle) => setK({ ...k, rolle })} optionen={Object.entries(KONTO_ROLLE_NAMEN).map(([wert, text]) => ({ wert: wert as KontoRolle, text }))} />
        <TextFeld label="IBAN (letzte 4)" wert={k.ibanLast4 ?? ''} onChange={(s) => setK({ ...k, ibanLast4: s.replace(/\D/g, '').slice(-4) || undefined })} platzhalter="optional, z. B. 4711" />
      </div>
      <p className="gruppe-fuss">Aus Datenschutzgründen speichert die App nie die volle IBAN.</p>
      <Gruppe titel="Grenzen">
        <BetragFeld label="Mindestpuffer" wert={k.mindestpuffer} onChange={(v) => setK({ ...k, mindestpuffer: v ?? 0 })} />
        <BetragFeld label="Dispo / Kreditrahmen" wert={k.dispo ?? null} onChange={(v) => setK({ ...k, dispo: v ?? undefined })} erlaubeLeer />
      </Gruppe>
      {k.typ === 'kreditkarte' && (
        <Gruppe titel="Kreditkarte" fuss="Alle Belastungen einer Periode werden am Abrechnungstag gesammelt vom Referenzkonto abgebucht.">
          <KontoFeld label="Referenzkonto" wert={k.kreditkarte?.referenzKontoId ?? ''} onChange={(r) => setK({ ...k, kreditkarte: { abrechnungstag: k.kreditkarte?.abrechnungstag ?? 1, referenzKontoId: r } })} konten={daten.konten.filter((x) => x.id !== k.id && x.typ !== 'kreditkarte')} leerText="Bitte wählen" />
          <ZahlFeld label="Abrechnungstag" min={1} max={31} wert={k.kreditkarte?.abrechnungstag ?? null} onChange={(t) => setK({ ...k, kreditkarte: { referenzKontoId: k.kreditkarte?.referenzKontoId ?? '', abrechnungstag: t ?? 1 } })} />
        </Gruppe>
      )}
      <Gruppe titel="Darstellung">
        <AuswahlFeld label="Lebensbereich" wert={k.lebensbereichId ?? ''} onChange={(v) => setK({ ...k, lebensbereichId: v || undefined })} optionen={[{ wert: '', text: 'Keiner' }, ...daten.lebensbereiche.map((l) => ({ wert: l.id, text: l.name }))]} />
        <div className="feld" style={{ flexWrap: 'wrap', gap: 8, padding: '10px 16px' }} role="radiogroup" aria-label="Farbe">
          {FARBEN.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={k.farbe === f} aria-label={f} onClick={() => setK({ ...k, farbe: f })} style={{ width: 32, height: 32, borderRadius: 16, border: k.farbe === f ? '3px solid var(--text)' : '0', background: `var(--f-${f})` }} />
          ))}
        </div>
        <div className="feld" style={{ flexWrap: 'wrap', gap: 8, padding: '10px 16px' }} role="radiogroup" aria-label="Symbol">
          {SYMBOL_NAMEN.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={k.symbol === s} aria-label={s} onClick={() => setK({ ...k, symbol: s })} style={{ background: 'none', border: 0, padding: 4, borderRadius: 20, outline: k.symbol === s ? '2px solid var(--akzent-flaeche)' : 'none' }}>
              <SymbolKreis symbol={s} farbe={k.farbe} />
            </button>
          ))}
        </div>
      </Gruppe>
      {alt && <Loeschen tabelle="konten" id={k.id} name={k.name} onSchliessen={onSchliessen} bestaetigen={`Konto „${k.name}“ löschen? Posten auf diesem Konto bleiben erhalten, erscheinen aber nicht mehr in der Prognose.`} />}
    </FormSheet>
  );
}

export function KontostandSheet({ kontoId, onSchliessen }: Basis & { kontoId: string }) {
  const { daten } = useDaten();
  const [konto, setKonto] = useState(kontoId);
  const alt = letzterKontostand(daten, konto);
  const [betrag, setBetrag] = useState<number | null>(null);
  const [datum, setDatum] = useState<string | null>(heute());
  const sichern = async () => {
    await speichere('kontostaende', { id: neueId('s'), kontoId: konto, datum: datum!, betrag: betrag!, quelle: 'manuell', erfasst: Date.now() }, 'Kontostand gespeichert');
    await aendereEinstellungen({ zuletztGenutztesKontoId: konto });
  };
  return (
    <FormSheet titel="Kontostand" onSchliessen={onSchliessen} gueltig={betrag !== null && !!datum} sichern={sichern}>
      <div className="gruppe">
        <KontoFeld label="Konto" wert={konto} onChange={setKonto} konten={daten.konten} />
        <BetragFeld key={konto} label="Aktueller Stand" wert={betrag} onChange={setBetrag} gross erlaubeLeer negativErlaubt />
        <DatumFeld label="Stand vom" wert={datum} onChange={setDatum} />
      </div>
      {alt && (
        <p className="gruppe-fuss">
          Bisher: <Betrag wert={alt.betrag} /> am {formatTag(alt.datum)}. Der alte Stand bleibt im Verlauf erhalten.
        </p>
      )}
    </FormSheet>
  );
}

export function EinkommenSheet({ id, onSchliessen }: Basis & { id?: string }) {
  const { daten } = useDaten();
  const alt = id ? daten.einkommen.find((e) => e.id === id) : undefined;
  const [e, setE] = useState<Einkommen>(
    alt ?? { id: neueId('e'), name: '', zielKontoId: daten.konten.find((k) => k.rolle === 'einkommen')?.id ?? daten.konten[0]?.id ?? '', zeitplan: { ...zeitplan('monatlich', 'letzter-bankarbeitstag'), verschiebung: 'vorher' }, historie: [{ gueltigAb: heute(), betrag: 0 }] },
  );
  const [aenderung, setAenderung] = useState<{ ab: string | null; betrag: number | null }>({ ab: heute(), betrag: null });
  const sortiert = [...e.historie].sort((a, b) => (a.gueltigAb < b.gueltigAb ? -1 : 1));
  const aktuell = aktuellerBetrag(e.historie);
  return (
    <FormSheet titel={alt ? 'Einkommen' : 'Neues Einkommen'} onSchliessen={onSchliessen} gueltig={!!e.name.trim() && !!e.zielKontoId} sichern={() => speichere('einkommen', e, 'Einkommen gespeichert')}>
      <div className="gruppe">
        <TextFeld label="Name" wert={e.name} onChange={(name) => setE({ ...e, name })} platzhalter="z. B. Gehalt" autoFocus={!alt} />
        {!alt && <BetragFeld label="Netto" wert={aktuell} onChange={(b) => setE({ ...e, historie: [{ gueltigAb: '2000-01-01', betrag: b ?? 0 }] })} />}
        <KontoFeld label="Zielkonto" wert={e.zielKontoId} onChange={(zielKontoId) => setE({ ...e, zielKontoId })} konten={daten.konten} />
      </div>
      <Gruppe titel="Eingang">
        <ZeitplanFelder wert={e.zeitplan} onChange={(z) => setE({ ...e, zeitplan: z })} mitLetztemBankarbeitstag />
      </Gruppe>
      {alt && (
        <Gruppe titel="Betrag und Änderungen" fuss="Eine Gehaltserhöhung trägst du mit Gültig-ab-Datum ein. Der alte Betrag bleibt für frühere Monate erhalten.">
          {[...sortiert].reverse().map((h) => (
            <Zeile key={h.gueltigAb} titel={h.gueltigAb <= '2000-01-01' ? 'Seit Beginn' : `ab ${formatTag(h.gueltigAb)}`} wert={<Betrag wert={h.betrag} />} />
          ))}
          <DatumFeld label="Neuer Betrag ab" wert={aenderung.ab} onChange={(ab) => setAenderung({ ...aenderung, ab })} />
          <BetragFeld label="Neuer Betrag" wert={aenderung.betrag} onChange={(betrag) => setAenderung({ ...aenderung, betrag })} erlaubeLeer />
          {aenderung.ab && aenderung.betrag !== null && (
            <Zeile
              titel={<span style={{ color: 'var(--akzent)', fontWeight: 600 }}>Änderung übernehmen</span>}
              onClick={() => {
                setE({ ...e, historie: [...e.historie.filter((h) => h.gueltigAb !== aenderung.ab), { gueltigAb: aenderung.ab!, betrag: aenderung.betrag! }] });
                setAenderung({ ab: heute(), betrag: null });
              }}
            />
          )}
        </Gruppe>
      )}
      {alt && <Loeschen tabelle="einkommen" id={e.id} name={e.name} onSchliessen={onSchliessen} />}
    </FormSheet>
  );
}

export function UmbuchungSheet({ id, onSchliessen }: Basis & { id?: string }) {
  const { daten } = useDaten();
  const alt = id ? daten.umbuchungen.find((u) => u.id === id) : undefined;
  const [u, setU] = useState<Umbuchung>(
    alt ?? { id: neueId('u'), vonKontoId: daten.konten.find((k) => k.rolle === 'einkommen')?.id ?? daten.konten[0]?.id ?? '', nachKontoId: daten.konten.find((k) => k.rolle === 'fixkosten')?.id ?? daten.konten[1]?.id ?? '', betrag: 0, zeitplan: zeitplan('monatlich', 1), art: 'dauerauftrag' },
  );
  const gleich = u.vonKontoId === u.nachKontoId;
  return (
    <FormSheet titel={alt ? 'Umbuchung' : 'Neue Umbuchung'} onSchliessen={onSchliessen} gueltig={!gleich && u.betrag > 0} sichern={() => speichere('umbuchungen', u, 'Umbuchung gespeichert')}>
      <div className="gruppe">
        <KontoFeld label="Von" wert={u.vonKontoId} onChange={(vonKontoId) => setU({ ...u, vonKontoId })} konten={daten.konten} />
        <KontoFeld label="Nach" wert={u.nachKontoId} onChange={(nachKontoId) => setU({ ...u, nachKontoId })} konten={daten.konten} />
        <BetragFeld label="Betrag" wert={u.betrag} onChange={(b) => setU({ ...u, betrag: b ?? 0 })} />
        <TextFeld label="Bezeichnung" wert={u.name ?? ''} onChange={(name) => setU({ ...u, name: name || undefined })} platzhalter="optional" />
        <AuswahlFeld label="Art" wert={u.art} onChange={(art) => setU({ ...u, art })} optionen={[{ wert: 'dauerauftrag', text: 'Dauerauftrag' }, { wert: 'manuell', text: 'Manuell' }]} />
      </div>
      {gleich && <p className="fehler-text">Von- und Nach-Konto müssen verschieden sein.</p>}
      <Gruppe titel="Ausführung" fuss="Umbuchungen sind keine Kosten. Sie verschieben nur Geld zwischen deinen Konten.">
        <ZeitplanFelder wert={u.zeitplan} onChange={(z) => setU({ ...u, zeitplan: z })} mitLetztemBankarbeitstag />
      </Gruppe>
      {alt && <Loeschen tabelle="umbuchungen" id={u.id} name="Umbuchung" onSchliessen={onSchliessen} />}
    </FormSheet>
  );
}

export function SparplanSheet({ id, onSchliessen }: Basis & { id?: string }) {
  const { daten } = useDaten();
  const alt = id ? daten.sparplaene.find((s) => s.id === id) : undefined;
  const [s, setS] = useState<Sparplan>(alt ?? { id: neueId('s'), name: '', vonKontoId: daten.konten.find((k) => k.rolle === 'einkommen')?.id ?? daten.konten[0]?.id ?? '', betrag: 0, zeitplan: zeitplan('monatlich', 1) });
  return (
    <FormSheet titel={alt ? 'Sparplan' : 'Neuer Sparplan'} onSchliessen={onSchliessen} gueltig={!!s.name.trim() && s.betrag > 0} sichern={() => speichere('sparplaene', s, 'Sparplan gespeichert')}>
      <div className="gruppe">
        <TextFeld label="Name" wert={s.name} onChange={(name) => setS({ ...s, name })} platzhalter="z. B. ETF-Sparplan" autoFocus={!alt} />
        <BetragFeld label="Betrag" wert={s.betrag} onChange={(b) => setS({ ...s, betrag: b ?? 0 })} />
        <KontoFeld label="Von Konto" wert={s.vonKontoId} onChange={(vonKontoId) => setS({ ...s, vonKontoId })} konten={daten.konten} />
        <KontoFeld label="Auf Konto" wert={s.zielKontoId ?? ''} onChange={(z) => setS({ ...s, zielKontoId: z || undefined })} konten={daten.konten.filter((k) => k.id !== s.vonKontoId)} leerText="Kein eigenes Konto" />
        <AuswahlFeld label="Lebensbereich" wert={s.lebensbereichId ?? ''} onChange={(v) => setS({ ...s, lebensbereichId: v || undefined })} optionen={[{ wert: '', text: 'Keiner' }, ...daten.lebensbereiche.map((l) => ({ wert: l.id, text: l.name }))]} />
      </div>
      <Gruppe titel="Ausführung" fuss="Sparen zählt zur Sparquote (Vermögensaufbau), nicht zu den Fixkosten.">
        <ZeitplanFelder wert={s.zeitplan} onChange={(z) => setS({ ...s, zeitplan: z })} />
      </Gruppe>
      {alt && <Loeschen tabelle="sparplaene" id={s.id} name={s.name} onSchliessen={onSchliessen} />}
    </FormSheet>
  );
}

export function BudgetSheet({ id, onSchliessen }: Basis & { id?: string }) {
  const { daten } = useDaten();
  const alt = id ? daten.budgets.find((x) => x.id === id) : undefined;
  const [b, setB] = useState<Budget>(alt ?? { id: neueId('b'), name: '', kontoId: daten.konten[0]?.id ?? '', monatlich: 0 });
  return (
    <FormSheet titel={alt ? 'Budget' : 'Neues Budget'} onSchliessen={onSchliessen} gueltig={!!b.name.trim()} sichern={() => speichere('budgets', b, 'Budget gespeichert')}>
      <div className="gruppe">
        <TextFeld label="Name" wert={b.name} onChange={(name) => setB({ ...b, name })} platzhalter="z. B. Tanken" autoFocus={!alt} />
        <BetragFeld label="Pro Monat" wert={b.monatlich} onChange={(v) => setB({ ...b, monatlich: v ?? 0 })} />
        <KontoFeld label="Konto" wert={b.kontoId} onChange={(kontoId) => setB({ ...b, kontoId })} konten={daten.konten} />
        <AuswahlFeld label="Lebensbereich" wert={b.lebensbereichId ?? ''} onChange={(v) => setB({ ...b, lebensbereichId: v || undefined })} optionen={[{ wert: '', text: 'Keiner' }, ...daten.lebensbereiche.map((l) => ({ wert: l.id, text: l.name }))]} />
      </div>
      <p className="gruppe-fuss">Variable Budgets sind keine Fixkosten. Die Prognose verteilt sie gleichmäßig über den Monat.</p>
      {alt && <Loeschen tabelle="budgets" id={b.id} name={b.name} onSchliessen={onSchliessen} />}
    </FormSheet>
  );
}

export function RuecklageSheet({ id, onSchliessen }: Basis & { id?: string }) {
  const { daten } = useDaten();
  const alt = id ? daten.ruecklagen.find((x) => x.id === id) : undefined;
  const [r, setR] = useState<Ruecklage>(alt ?? { id: neueId('r'), name: '', kontoId: daten.konten[0]?.id ?? '', virtuell: true, monatlich: 0 });
  return (
    <FormSheet titel={alt ? 'Rücklage' : 'Neuer Topf'} onSchliessen={onSchliessen} gueltig={!!r.name.trim()} sichern={() => speichere('ruecklagen', r, 'Rücklage gespeichert')}>
      <div className="gruppe">
        <TextFeld label="Name" wert={r.name} onChange={(name) => setR({ ...r, name })} platzhalter="z. B. Kfz-Reparatur" autoFocus={!alt} />
        <KontoFeld label="Konto" wert={r.kontoId} onChange={(kontoId) => setR({ ...r, kontoId })} konten={daten.konten} />
        <SchalterFeld label="Virtuell" unter="Konto hat auch andere Zwecke" wert={r.virtuell} onChange={(virtuell) => setR({ ...r, virtuell })} />
        {r.virtuell && <BetragFeld label="Pro Monat" wert={r.monatlich ?? 0} onChange={(v) => setR({ ...r, monatlich: v ?? 0 })} />}
        <BetragFeld label="Ziel" wert={r.ziel ?? null} onChange={(ziel) => setR({ ...r, ziel })} erlaubeLeer />
        <BetragFeld label="Aktueller Stand" wert={r.stand ?? null} onChange={(stand) => setR({ ...r, stand })} erlaubeLeer />
        <AuswahlFeld label="Lebensbereich" wert={r.lebensbereichId ?? ''} onChange={(v) => setR({ ...r, lebensbereichId: v || undefined })} optionen={[{ wert: '', text: 'Keiner' }, ...daten.lebensbereiche.map((l) => ({ wert: l.id, text: l.name }))]} />
      </div>
      <p className="gruppe-fuss">{r.virtuell ? 'Ein virtueller Topf reserviert Geld auf dem Konto. Er zählt in der Deckungsprüfung als Abfluss, das Geld bleibt aber auf dem Konto.' : 'Auf einem eigenen Rücklagekonto ergibt sich der Monatsbetrag aus den eingehenden Umbuchungen.'}</p>
      {alt && <Loeschen tabelle="ruecklagen" id={r.id} name={r.name} onSchliessen={onSchliessen} />}
    </FormSheet>
  );
}

/** Nur den Abbuchungstag eines Postens eintragen (schneller als der ganze Posten). */
export function AbbuchungstagSheet({ id, onSchliessen }: Basis & { id: string }) {
  const { daten } = useDaten();
  const f = daten.fixkosten.find((x) => x.id === id);
  const z = f?.zeitplan;
  const [tag, setTag] = useState<number | null>(typeof z?.tag === 'number' ? z.tag : z?.ankerDatum ? Number(z.ankerDatum.slice(8, 10)) : null);
  if (!f || !z) return null;
  const sichern = () => speichere('fixkosten', { ...f, zeitplan: z.rhythmus === 'woechentlich' ? z : { ...z, tag, ankerDatum: null, ankerMonat: z.ankerMonat ?? (z.ankerDatum ? Number(z.ankerDatum.slice(5, 7)) : null) } }, `${f.name}: Tag gespeichert`);
  return (
    <FormSheet titel={f.name} onSchliessen={onSchliessen} gueltig={tag !== null && tag >= 1 && tag <= 31} sichern={sichern}>
      <div className="gruppe">
        <ZahlFeld label="Tag im Monat" min={1} max={31} wert={tag} onChange={setTag} />
      </div>
      <p className="gruppe-fuss">
        Fällt der Tag auf ein Wochenende oder einen Bankfeiertag, rechnet die App mit dem nächsten Bankarbeitstag. Betrag: <Betrag wert={aktuellerBetrag(f.preise)} />.
      </p>
    </FormSheet>
  );
}

/** Stand eines Spartopfs eintragen (z. B. nach einer Entnahme). Bucht nichts, merkt sich nur den Stand. */
export function TopfSheet({ kontoId, schluessel, onSchliessen }: Basis & { kontoId: string; schluessel: string }) {
  const { roh } = useDaten();
  const topf = spartoepfe(roh, kontoId, heute()).find((t) => t.schluessel === schluessel);
  const [stand, setStand] = useState<number | null>(topf?.aktuell ?? null);
  const [datum, setDatum] = useState<string | null>(heute());
  if (!topf) return null;
  const sichern = () =>
    speichere(
      'ruecklagen',
      { ...(topf.eintrag ?? { id: neueId('r'), kontoId, virtuell: false, quelle: topf.quelle }), name: topf.name, stand: stand!, standAm: datum! },
      `${topf.name} gespeichert`,
    );
  return (
    <FormSheet titel={topf.name} onSchliessen={onSchliessen} gueltig={stand !== null && !!datum} sichern={sichern}>
      <div className="gruppe">
        <BetragFeld label="Stand" wert={stand} onChange={setStand} gross erlaubeLeer />
        <DatumFeld label="Stand vom" wert={datum} onChange={setDatum} />
      </div>
      <p className="gruppe-fuss">
        Ab diesem Tag kommen jeden Monat <Betrag wert={topf.monatlich} /> automatisch dazu. Es wird nichts gebucht.
      </p>
    </FormSheet>
  );
}

export function EinmaligSheet({ id, onSchliessen }: Basis & { id?: string }) {
  const { daten } = useDaten();
  const alt = id ? daten.einmalig.find((x) => x.id === id) : undefined;
  const [e, setE] = useState<Einmalig>(alt ?? { id: neueId('x'), art: 'ausgabe', name: '', betrag: 0, datum: heute(), kontoId: daten.konten[0]?.id ?? '' });
  return (
    <FormSheet titel={alt ? 'Einmalig' : 'Einmalig geplant'} onSchliessen={onSchliessen} gueltig={!!e.name.trim() && e.betrag > 0} sichern={() => speichere('einmalig', e, 'Gespeichert')}>
      <div className="gruppe">
        <AuswahlFeld label="Art" wert={e.art} onChange={(art) => setE({ ...e, art })} optionen={[{ wert: 'ausgabe', text: 'Ausgabe' }, { wert: 'einnahme', text: 'Einnahme' }]} />
        <TextFeld label="Name" wert={e.name} onChange={(name) => setE({ ...e, name })} platzhalter="z. B. TÜV" autoFocus={!alt} />
        <BetragFeld label="Betrag" wert={e.betrag} onChange={(b) => setE({ ...e, betrag: b ?? 0 })} />
        <DatumFeld label="Datum" wert={e.datum} onChange={(datum) => datum && setE({ ...e, datum })} />
        <KontoFeld label="Konto" wert={e.kontoId} onChange={(kontoId) => setE({ ...e, kontoId })} konten={daten.konten} />
      </div>
      <p className="gruppe-fuss">Fließt in die Kontostand-Prognose ein, aber nicht in die Fixkosten.</p>
      {alt && <Loeschen tabelle="einmalig" id={e.id} name={e.name} onSchliessen={onSchliessen} />}
    </FormSheet>
  );
}
