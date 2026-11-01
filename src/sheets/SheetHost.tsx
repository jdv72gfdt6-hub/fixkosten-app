import { useNav } from '../state/navigation';
import { FixkostenSheet } from './FixkostenSheet';
import { ImportSheet } from './ImportSheet';
import { NeuSheet } from './NeuSheet';
import { SucheSheet } from './SucheSheet';
import { BudgetSheet, EinkommenSheet, EinmaligSheet, KontoSheet, KontostandSheet, RuecklageSheet, SparplanSheet, UmbuchungSheet } from './WeitereSheets';

/** Zeigt das oberste offene Bottom Sheet. */
export function SheetHost() {
  const sheet = useNav((s) => s.sheets.at(-1));
  const schliessen = useNav((s) => s.schliesseSheet);
  if (!sheet) return null;
  const key = JSON.stringify(sheet);
  switch (sheet.typ) {
    case 'neu':
      return <NeuSheet key={key} onSchliessen={schliessen} />;
    case 'fixkosten':
      return <FixkostenSheet key={key} id={sheet.id} vorlageKontoId={sheet.vorlageKontoId} onSchliessen={schliessen} />;
    case 'konto':
      return <KontoSheet key={key} id={sheet.id} onSchliessen={schliessen} />;
    case 'kontostand':
      return <KontostandSheet key={key} kontoId={sheet.kontoId} onSchliessen={schliessen} />;
    case 'einkommen':
      return <EinkommenSheet key={key} id={sheet.id} onSchliessen={schliessen} />;
    case 'umbuchung':
      return <UmbuchungSheet key={key} id={sheet.id} onSchliessen={schliessen} />;
    case 'sparplan':
      return <SparplanSheet key={key} id={sheet.id} onSchliessen={schliessen} />;
    case 'budget':
      return <BudgetSheet key={key} id={sheet.id} onSchliessen={schliessen} />;
    case 'ruecklage':
      return <RuecklageSheet key={key} id={sheet.id} onSchliessen={schliessen} />;
    case 'einmalig':
      return <EinmaligSheet key={key} id={sheet.id} onSchliessen={schliessen} />;
    case 'suche':
      return <SucheSheet key={key} onSchliessen={schliessen} />;
    case 'import':
      return <ImportSheet key={key} onSchliessen={schliessen} />;
  }
}
