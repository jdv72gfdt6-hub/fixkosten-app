import { ArrowLeftRight, Banknote, CalendarPlus, Landmark, PiggyBank, Receipt, Scale, Wallet } from 'lucide-react';
import { useDaten } from '../state/daten';
import { useNav, type Sheet as SheetTyp } from '../state/navigation';
import { Gruppe, Zeile } from '../ui/Liste';
import { Sheet } from '../ui/Sheet';

/** Auswahl, was neu angelegt werden soll. */
export function NeuSheet({ onSchliessen }: { onSchliessen: () => void }) {
  const { daten, einstellungen } = useDaten();
  const zeige = (s: SheetTyp) => {
    useNav.setState((n) => ({ sheets: [...n.sheets.slice(0, -1), s] }));
  };
  const kontoFuerStand = einstellungen.zuletztGenutztesKontoId ?? daten.konten[0]?.id;
  const kreis = (Icon: typeof Wallet, f: string) => (
    <span className="symbol-kreis" style={{ background: `var(--f-${f})` }} aria-hidden="true">
      <Icon size={17} />
    </span>
  );
  return (
    <Sheet titel="Neu" onSchliessen={onSchliessen}>
      <Gruppe>
        <Zeile symbol={kreis(Receipt, 'orange')} titel="Fixkosten-Posten" unter="Miete, Versicherung, Abo …" onClick={() => zeige({ typ: 'fixkosten' })} />
        {kontoFuerStand && <Zeile symbol={kreis(Scale, 'blue')} titel="Kontostand aktualisieren" onClick={() => zeige({ typ: 'kontostand', kontoId: kontoFuerStand })} />}
        <Zeile symbol={kreis(CalendarPlus, 'brown')} titel="Einmalige Ausgabe oder Einnahme" unter="z. B. TÜV, Nachzahlung, Steuererstattung" onClick={() => zeige({ typ: 'einmalig' })} />
      </Gruppe>
      <Gruppe titel="Geldfluss">
        <Zeile symbol={kreis(Banknote, 'blue')} titel="Einkommen" onClick={() => zeige({ typ: 'einkommen' })} />
        <Zeile symbol={kreis(ArrowLeftRight, 'gray')} titel="Umbuchung zwischen Konten" onClick={() => zeige({ typ: 'umbuchung' })} />
        <Zeile symbol={kreis(PiggyBank, 'mint')} titel="Sparplan" onClick={() => zeige({ typ: 'sparplan' })} />
        <Zeile symbol={kreis(Wallet, 'cyan')} titel="Rücklagen-Topf" onClick={() => zeige({ typ: 'ruecklage' })} />
        <Zeile symbol={kreis(Receipt, 'purple')} titel="Variables Budget" onClick={() => zeige({ typ: 'budget' })} />
      </Gruppe>
      <Gruppe titel="Konten">
        <Zeile symbol={kreis(Landmark, 'indigo')} titel="Konto" onClick={() => zeige({ typ: 'konto' })} />
      </Gruppe>
    </Sheet>
  );
}
