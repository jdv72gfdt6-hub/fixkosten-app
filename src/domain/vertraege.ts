import { jahresCent, monatlich, prozent } from './geld';
import { plusMonate, plusTage, tageZwischen, teile } from './datum';
import { fixkostenAktivAm, ohnePapierkorb } from './posten';
import type { Cent, Daten, Fixkosten, Tag, Vertrag } from './typen';

export interface Kuendigungsinfo {
  status: 'unvollstaendig' | 'ok' | 'gekuendigt' | 'beendet';
  /** Ende der aktuellen Laufzeit (bei Kündigung bis zum letzten möglichen Tag). */
  laufzeitEnde?: Tag;
  /** Letzter Tag, an dem die Kündigung beim Anbieter eingehen muss. */
  kuendigenBis?: Tag;
  tageBisKuendigung?: number;
  /** Nach Ablauf der Mindestlaufzeit ohne Verlängerung jederzeit mit Frist kündbar. */
  jederzeit?: boolean;
  fehlt: string[];
}

/** Monate addieren nach §188 BGB: Laufzeit ab 15.03. mit 24 Monaten endet am 14.03. */
function laufzeitEndeNach(beginn: Tag, monate: number): Tag {
  const t = plusMonate(beginn, monate);
  // Wurde der Tag begrenzt (31.01. + 1 Monat → 28.02.), ist das bereits der letzte Tag.
  return teile(t).tag < teile(beginn).tag ? t : plusTage(t, -1);
}

/** Letzter Tag für den Zugang der Kündigung, wenn der Vertrag am `ende` enden soll. */
export function kuendigungsstichtag(ende: Tag, frist: NonNullable<Vertrag['kuendigungsfrist']>): Tag {
  switch (frist.einheit) {
    case 'tage':
      return plusTage(ende, -frist.wert);
    case 'wochen':
      return plusTage(ende, -7 * frist.wert);
    case 'monate':
      return plusTage(plusMonate(plusTage(ende, 1), -frist.wert), -1);
  }
}

function fristEndeAb(tag: Tag, frist: NonNullable<Vertrag['kuendigungsfrist']>): Tag {
  switch (frist.einheit) {
    case 'tage':
      return plusTage(tag, frist.wert);
    case 'wochen':
      return plusTage(tag, 7 * frist.wert);
    case 'monate':
      return plusTage(plusMonate(plusTage(tag, 1), frist.wert), -1);
  }
}

/** Berechnet aus Beginn, Mindestlaufzeit, Kündigungsfrist und Verlängerung das nächste Kündigungsdatum. */
export function kuendigungsinfo(f: Fixkosten, heute: Tag): Kuendigungsinfo {
  if (f.status === 'gekuendigt') {
    return { status: f.endeAm && f.endeAm < heute ? 'beendet' : 'gekuendigt', laufzeitEnde: f.endeAm ?? undefined, fehlt: [] };
  }
  const v = f.vertrag ?? {};
  const fehlt: string[] = [];
  if (!v.beginn) fehlt.push('Vertragsbeginn');
  if (v.mindestlaufzeitMonate === null || v.mindestlaufzeitMonate === undefined) fehlt.push('Mindestlaufzeit');
  if (!v.kuendigungsfrist) fehlt.push('Kündigungsfrist');
  if (fehlt.length) return { status: 'unvollstaendig', fehlt };

  const frist = v.kuendigungsfrist!;
  const verlaengerung = v.verlaengerungMonate ?? 0;
  const jederzeitErgebnis = (): Kuendigungsinfo => ({
    status: 'ok',
    jederzeit: true,
    kuendigenBis: heute,
    laufzeitEnde: fristEndeAb(heute, frist),
    tageBisKuendigung: 0,
    fehlt: [],
  });

  if (v.mindestlaufzeitMonate === 0) return jederzeitErgebnis();

  let beginn = v.beginn!;
  let ende = laufzeitEndeNach(beginn, v.mindestlaufzeitMonate!);
  // Laufzeit verlängern, bis die Kündigung noch rechtzeitig möglich ist.
  for (let i = 0; kuendigungsstichtag(ende, frist) < heute; i++) {
    if (verlaengerung <= 0 || i > 1200) return jederzeitErgebnis();
    beginn = plusTage(ende, 1);
    ende = laufzeitEndeNach(beginn, verlaengerung);
  }
  const kuendigenBis = kuendigungsstichtag(ende, frist);
  return { status: 'ok', laufzeitEnde: ende, kuendigenBis, tageBisKuendigung: tageZwischen(heute, kuendigenBis), fehlt: [] };
}

export interface BaldKuendbar {
  posten: Fixkosten;
  info: Kuendigungsinfo;
}

/** Verträge, deren Kündigungsfrist in den nächsten `tage` Tagen endet – sortiert nach Dringlichkeit. */
export function baldKuendbar(daten: Daten, heute: Tag, tage = 90): BaldKuendbar[] {
  return ohnePapierkorb(daten)
    .fixkosten.filter((f) => f.status === 'aktiv')
    .map((posten) => ({ posten, info: kuendigungsinfo(posten, heute) }))
    .filter((x) => x.info.status === 'ok' && !x.info.jederzeit && (x.info.tageBisKuendigung ?? Infinity) <= tage)
    .sort((a, b) => (a.info.kuendigenBis! < b.info.kuendigenBis! ? -1 : 1));
}

export interface Preisaenderung {
  posten: Fixkosten;
  datum: Tag;
  alt: Cent;
  neu: Cent;
  differenz: Cent;
  prozent: number | null;
  /** Mehrkosten pro Jahr in Cent. */
  jahreswirkung: Cent;
}

/** Alle Preisänderungen seit einem Tag (Erhöhungen und Senkungen), neueste zuerst. */
export function preisaenderungen(daten: Daten, seit: Tag): Preisaenderung[] {
  const liste: Preisaenderung[] = [];
  for (const f of ohnePapierkorb(daten).fixkosten) {
    const p = [...f.preise].sort((a, b) => (a.gueltigAb < b.gueltigAb ? -1 : 1));
    for (let i = 1; i < p.length; i++) {
      const alt = p[i - 1]!.betrag;
      const neu = p[i]!.betrag;
      if (p[i]!.gueltigAb < seit || alt === neu) continue;
      liste.push({
        posten: f,
        datum: p[i]!.gueltigAb,
        alt,
        neu,
        differenz: neu - alt,
        prozent: prozent(neu - alt, alt),
        jahreswirkung: jahresCent(neu - alt, f.zeitplan.rhythmus),
      });
    }
  }
  return liste.sort((a, b) => (a.datum < b.datum ? 1 : -1));
}

export interface FinanzierungsEnde {
  posten: Fixkosten;
  letzteRate: Tag;
  /** Erster Monat ohne Rate, "YYYY-MM". */
  freiAbMonat: string;
  mehrFreiMonatlich: Cent;
}

/** Kredite und Finanzierungen mit bekanntem Laufzeitende, die noch laufen. */
export function finanzierungsenden(daten: Daten, heute: Tag): FinanzierungsEnde[] {
  return ohnePapierkorb(daten)
    .fixkosten.filter((f) => f.finanzierung?.letzteRate && fixkostenAktivAm(f, heute))
    .map((f) => {
      const letzte = f.finanzierung!.letzteRate!;
      const { jahr, monat } = teile(plusMonate(letzte, 1));
      const aktuell = [...f.preise].sort((a, b) => (a.gueltigAb < b.gueltigAb ? -1 : 1)).at(-1)?.betrag ?? 0;
      return {
        posten: f,
        letzteRate: letzte,
        freiAbMonat: `${jahr}-${String(monat).padStart(2, '0')}`,
        mehrFreiMonatlich: monatlich(aktuell, f.zeitplan.rhythmus),
      };
    })
    .sort((a, b) => (a.letzteRate < b.letzteRate ? -1 : 1));
}
