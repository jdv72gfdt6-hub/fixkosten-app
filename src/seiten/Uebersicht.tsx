import { AlertTriangle, CalendarClock, CircleAlert, HardDriveDownload, Share, TrendingUp } from 'lucide-react';
import { ampel } from '../domain/bilanz';
import { formatTag, formatTagKurz, monatsname, tageZwischen, teile } from '../domain/datum';
import { formatProzent, prozent } from '../domain/geld';
import { letzterKontostand } from '../domain/posten';
import { useBerechnung, useDaten } from '../state/daten';
import { geheZu, useAnsicht, useNav } from '../state/navigation';
import { Betrag } from '../ui/Betrag';
import { ampelKlasse, ampelText, DeckungAbzeichen, kontoVon } from '../ui/hilfen';
import { Gruppe, Zeile } from '../ui/Liste';
import { Seite } from '../ui/Seite';
import { farbe, SymbolKreis } from '../ui/Symbol';

function istStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function Uebersicht() {
  const { daten, einstellungen } = useDaten();
  const b = useBerechnung();
  const ue = b.uebersicht;
  const fixAmpel = ampel(ue.fixkostenquote, einstellungen.ampelGelb, einstellungen.ampelRot);
  const warnungen = b.prognose.flatMap((p) => p.warnungen).sort((a, c) => (a.datum < c.datum ? -1 : 1));
  const lueckenAnzahl = new Set(b.luecken.map((l) => l.refId)).size;
  const erhoehungen = b.preisaenderungen.filter((p) => p.differenz > 0);
  const backupAlter = einstellungen.letztesBackup ? tageZwischen(einstellungen.letztesBackup, b.heute) : null;
  const backupFaellig = backupAlter === null || backupAlter > 30;
  const setzeAnsicht = useAnsicht((s) => s.setze);
  const zeigeSheet = useNav((s) => s.zeigeSheet);

  const zuVertraegen = (v: 'alle' | 'kuendbar' | 'preise') => {
    setzeAnsicht({ vertraege: v });
    geheZu('vertraege');
  };

  const balken = (p: number | null, farbeVar: string) => (
    <div className="balken" aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(0, p ?? 0))}%`, background: farbeVar }} />
    </div>
  );

  return (
    <Seite titel="Übersicht">
      {backupFaellig && (
        <div className="hinweis blau">
          <HardDriveDownload size={20} aria-hidden="true" />
          <div>
            {backupAlter === null ? 'Du hast noch kein Backup erstellt.' : `Dein letztes Backup ist ${backupAlter} Tage alt.`} Die Daten liegen nur auf diesem Gerät.
            <div className="hinweis-aktionen">
              <button type="button" className="link-knopf" onClick={() => geheZu('einstellungen')}>
                Backup erstellen
              </button>
            </div>
          </div>
        </div>
      )}
      {!istStandalone() && (
        <div className="hinweis">
          <Share size={20} aria-hidden="true" />
          <div>
            Füge die App über „Teilen → Zum Home-Bildschirm“ hinzu. Sonst kann Safari die Daten nach längerer Nichtnutzung löschen.
          </div>
        </div>
      )}

      <div className="kacheln" style={{ marginTop: 12 }}>
        <button type="button" className="kachel tippbar" onClick={() => zuVertraegen('alle')}>
          <span className="kachel-titel">Fixkosten / Monat</span>
          <span className="kachel-wert">
            <Betrag wert={ue.fixkosten} />
          </span>
          <span className="kachel-unter">
            <Betrag wert={ue.fixkosten * 12} kurz /> im Jahr
          </span>
        </button>
        <button type="button" className="kachel tippbar" onClick={() => geheZu('konten')}>
          <span className="kachel-titel">Frei verfügbar</span>
          <span className={`kachel-wert ${ue.frei < 0 ? 'text-rot' : ''}`}>
            <Betrag wert={ue.frei} />
          </span>
          <span className="kachel-unter">nach Sparen und Rücklagen</span>
        </button>
        <button type="button" className="kachel tippbar" onClick={() => zuVertraegen('kuendbar')}>
          <span className="kachel-kopf">
            <span className="kachel-titel">Bald kündbar</span>
            <CalendarClock size={18} color="var(--f-orange)" aria-hidden="true" />
          </span>
          <span className="kachel-wert">{b.baldKuendbar.length}</span>
          <span className="kachel-unter">
            {b.baldKuendbar[0] ? `${b.baldKuendbar[0].posten.name} bis ${formatTagKurz(b.baldKuendbar[0].info.kuendigenBis!)}` : 'in den nächsten 90 Tagen'}
          </span>
        </button>
        <button type="button" className="kachel tippbar" onClick={() => zuVertraegen('preise')}>
          <span className="kachel-kopf">
            <span className="kachel-titel">Preiserhöhungen</span>
            <TrendingUp size={18} color="var(--f-red)" aria-hidden="true" />
          </span>
          <span className="kachel-wert">{erhoehungen.length}</span>
          <span className="kachel-unter">
            {erhoehungen.length ? (
              <>
                <Betrag wert={erhoehungen.reduce((s, p) => s + p.jahreswirkung, 0)} vorzeichen /> pro Jahr
              </>
            ) : (
              'in den letzten 12 Monaten'
            )}
          </span>
        </button>
      </div>

      {warnungen.length > 0 && (
        <Gruppe titel="Warnungen">
          {warnungen.slice(0, 4).map((w) => (
            <Zeile
              key={`${w.kontoId}-${w.datum}`}
              symbol={<AlertTriangle size={22} color="var(--rot-flaeche)" aria-hidden="true" />}
              titel={w.text}
              onClick={() => geheZu('konten', { typ: 'konto', id: w.kontoId })}
            />
          ))}
        </Gruppe>
      )}

      {lueckenAnzahl > 0 && (
        <div className="hinweis gelb" style={{ marginTop: 12 }}>
          <CircleAlert size={20} aria-hidden="true" />
          <div>
            {lueckenAnzahl} {lueckenAnzahl === 1 ? 'Eintrag braucht' : 'Einträge brauchen'} noch Angaben (z. B. fehlender Tag oder veralteter Kontostand). Fehlende Tage nimmt die Prognose vorsichtshalber am 1. des Monats an.
            <div className="hinweis-aktionen">
              <button type="button" className="link-knopf" onClick={() => useNav.getState().oeffne({ typ: 'luecken' })}>
                Nachtragen
              </button>
            </div>
          </div>
        </div>
      )}

      <Gruppe titel="Quoten" fuss="Bezogen auf dein Nettoeinkommen dieses Monats. Fixkosten zählen mit deinem eigenen Anteil.">

        <div className="karte">
          {ue.fixkostenquote === null ? (
            <p style={{ margin: 0 }}>Trage dein Einkommen ein, damit die Quoten berechnet werden können.</p>
          ) : (
            <>
              <div className="quote">
                <div className="quote-kopf">
                  <span>Fixkostenquote</span>
                  <span>
                    <span className="quote-wert">{formatProzent(ue.fixkostenquote)}</span>{' '}
                    <span className={`abzeichen ${ampelKlasse(fixAmpel)}`}>{ampelText(fixAmpel)}</span>
                  </span>
                </div>
                {balken(ue.fixkostenquote, fixAmpel === 'rot' ? 'var(--rot-flaeche)' : fixAmpel === 'gelb' ? 'var(--f-orange)' : 'var(--f-green)')}
                <span className="kachel-unter">
                  Grün unter {einstellungen.ampelGelb} %, Rot über {einstellungen.ampelRot} %
                </span>
              </div>
              <div className="quote">
                <div className="quote-kopf">
                  <span>Vermögensaufbau</span>
                  <span className="quote-wert">
                    <Betrag wert={ue.vermoegensaufbau} /> · {formatProzent(ue.sparquote)}
                  </span>
                </div>
                {balken(ue.sparquote, 'var(--f-mint)')}
              </div>
              <div className="quote">
                <div className="quote-kopf">
                  <span>Rücklagen</span>
                  <span className="quote-wert">
                    <Betrag wert={ue.ruecklagen} /> · {formatProzent(ue.ruecklagenquote)}
                  </span>
                </div>
                {balken(ue.ruecklagenquote, 'var(--f-cyan)')}
              </div>
            </>
          )}
        </div>
      </Gruppe>

      <Gruppe titel="Monatsbilanz" fuss="Monatsdurchschnitt: Jahres- und Quartalszahlungen sind anteilig enthalten. Umbuchungen zwischen deinen Konten sind keine Kosten.">
        <Zeile titel="Nettoeinkommen" wert={<Betrag wert={ue.einkommen} />} />
        <Zeile titel="Fixkosten" wert={<Betrag wert={-ue.fixkosten} />} />
        <Zeile titel="Vermögensaufbau" wert={<Betrag wert={-ue.vermoegensaufbau} />} />
        <Zeile titel="Rücklagen" wert={<Betrag wert={-ue.ruecklagen} />} />
        <Zeile titel="Variables Budget" wert={<Betrag wert={-ue.budgets} />} />
        <Zeile titel={<strong>Frei verfügbar</strong>} wert={<strong><Betrag wert={ue.frei} faerben={ue.frei < 0} /></strong>} />
      </Gruppe>

      <Gruppe titel="Konten" aktion={{ text: 'Alle', onClick: () => geheZu('konten') }}>
        {b.deckung.map((d) => {
          const stand = letzterKontostand(daten, d.konto.id);
          return (
            <Zeile
              key={d.konto.id}
              symbol={<SymbolKreis symbol={d.konto.symbol} farbe={d.konto.farbe} />}
              titel={d.konto.name}
              unter={<DeckungAbzeichen d={d} />}
              wert={stand ? <Betrag wert={stand.betrag} /> : <span className="abzeichen gelb">Stand fehlt</span>}
              wertUnter={stand ? formatTag(stand.datum) : undefined}
              onClick={() => geheZu('konten', { typ: 'konto', id: d.konto.id })}
            />
          );
        })}
      </Gruppe>

      <Gruppe titel="Anstehend · 60 Tage">
        {b.anstehend.length === 0 ? (
          <Zeile titel={<span className="text-2">Keine Fristen oder größeren Abbuchungen.</span>} />
        ) : (
          b.anstehend.slice(0, 8).map((a) => (
            <Zeile
              key={`${a.art}-${a.refId}-${a.datum}`}
              titel={a.titel}
              unter={
                <>
                  {formatTag(a.datum)}
                  {a.kontoId && ` · ${kontoVon(daten, a.kontoId)?.name ?? ''}`}
                  {a.art === 'kuendigung' && <span className="abzeichen gelb">Frist</span>}
                </>
              }
              wert={a.betrag !== undefined ? <Betrag wert={a.betrag} /> : undefined}
              onClick={() => (a.art === 'kuendigung' || a.art === 'abbuchung' || a.art === 'letzte-rate' ? zeigeSheet({ typ: 'fixkosten', id: a.refId }) : zeigeSheet({ typ: 'einmalig', id: a.refId }))}
            />
          ))
        )}
      </Gruppe>

      <Gruppe titel="Kosten pro Lebensbereich" fuss="Unabhängig von den Kategorien: Fixkosten, Budgets, Rücklagen und Sparen, die einem Lebensbereich zugeordnet sind.">
        {ue.proLebensbereich.map((l) => {
          const lb = daten.lebensbereiche.find((x) => x.id === l.id);
          const p = prozent(l.jahresCent, ue.einkommen * 12);
          return (
            <div className="zeile" key={l.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{l.name}</span>
                <span className="zahl">
                  <Betrag wert={l.monatlich} /> <span className="text-2">· {formatProzent(p)}</span>
                </span>
              </div>
              {balken(p, farbe(lb?.farbe))}
            </div>
          );
        })}
      </Gruppe>

      <Gruppe titel="Fixkosten nach Kategorie">
        {ue.proKategorie.map((k) => {
          const kat = daten.kategorien.find((x) => x.id === k.id);
          return (
            <Zeile
              key={k.id}
              symbol={<SymbolKreis symbol={kat?.symbol ?? ''} farbe={kat?.farbe ?? 'gray'} />}
              titel={k.name}
              wert={<Betrag wert={k.monatlich} />}
              wertUnter={formatProzent(prozent(k.jahresCent, ue.fixkosten * 12))}
              onClick={() => useNav.getState().oeffne({ typ: 'kategorie', id: k.id })}
            />
          );
        })}
      </Gruppe>

      <p className="beratung">
        Stand {formatTag(b.heute)} · {monatsname(teile(b.heute).monat)}-Durchschnitt. Alle Berechnungen sind Orientierungshilfen und keine Finanz- oder Anlageberatung.
      </p>
    </Seite>
  );
}
