import { CalendarDays, FileText, LayoutGrid, Plus, Settings, Wallet } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { leerePapierkorb, speicherDauerhaft } from './db/db';
import { ohnePapierkorb } from './domain/posten';
import { Onboarding } from './seiten/Onboarding';
import { SheetHost } from './sheets/SheetHost';
import { DatenKontext, useDatenRoh } from './state/daten';
import { useNav, type TabId } from './state/navigation';
import { Uebersicht } from './seiten/Uebersicht';
import { KontenSeite } from './seiten/Konten';
import { KalenderSeite } from './seiten/Kalender';
import { VertraegeSeite } from './seiten/Vertraege';
import { EinstellungenSeite } from './seiten/Einstellungen';
import { RueckgaengigToast, UpdateHinweis } from './ui/Toast';
import { Unterseite } from './seiten/Unterseiten';

const TABS: { id: TabId; text: string; Icon: typeof LayoutGrid }[] = [
  { id: 'uebersicht', text: 'Übersicht', Icon: LayoutGrid },
  { id: 'konten', text: 'Konten', Icon: Wallet },
  { id: 'kalender', text: 'Kalender', Icon: CalendarDays },
  { id: 'vertraege', text: 'Verträge', Icon: FileText },
  { id: 'einstellungen', text: 'Einstellungen', Icon: Settings },
];

export function App() {
  const roh = useDatenRoh();
  const kontext = useMemo(
    () => (roh ? { roh: roh.daten, daten: ohnePapierkorb(roh.daten), einstellungen: roh.einstellungen } : null),
    [roh],
  );
  const { tab, wechsleTab, stapel } = useNav();
  const route = stapel[tab].at(-1);
  const design = roh?.einstellungen.design;

  useEffect(() => {
    void speicherDauerhaft();
    void leerePapierkorb();
  }, []);

  useEffect(() => {
    if (!design) return;
    const root = document.documentElement;
    if (design === 'hell') root.dataset.theme = 'light';
    else if (design === 'dunkel') root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    try {
      localStorage.setItem('design', design);
    } catch {
      /* privater Modus – egal */
    }
  }, [design]);

  if (!kontext) return <div className="app" aria-busy="true" />;

  if (!kontext.einstellungen.onboardingFertig) {
    return (
      <DatenKontext.Provider value={kontext}>
        <div className="app">
          <Onboarding />
          <SheetHost />
        </div>
      </DatenKontext.Provider>
    );
  }

  return (
    <DatenKontext.Provider value={kontext}>
      <div className="app">
        {route ? (
          <Unterseite key={JSON.stringify(route)} route={route} zurueck={TABS.find((t) => t.id === tab)!.text} />
        ) : (
          <>
            {tab === 'uebersicht' && <Uebersicht />}
            {tab === 'konten' && <KontenSeite />}
            {tab === 'kalender' && <KalenderSeite />}
            {tab === 'vertraege' && <VertraegeSeite />}
            {tab === 'einstellungen' && <EinstellungenSeite />}
          </>
        )}

        <button type="button" className="fab glas tippbar" aria-label="Neuer Eintrag" onClick={() => useNav.getState().zeigeSheet({ typ: 'neu' })}>
          <Plus size={28} strokeWidth={2.4} />
        </button>

        <nav className="tabbar glas" aria-label="Hauptbereiche">
          {TABS.map(({ id, text, Icon }) => (
            <button key={id} type="button" className="tippbar" aria-current={tab === id ? 'page' : undefined} onClick={() => wechsleTab(id)}>
              <Icon size={22} aria-hidden="true" />
              {text}
            </button>
          ))}
        </nav>

        <SheetHost />
        <RueckgaengigToast />
        <UpdateHinweis />
      </div>
    </DatenKontext.Provider>
  );
}
