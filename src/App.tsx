import { Landmark, PiggyBank, Receipt, Wallet } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { leerePapierkorb, speicherDauerhaft } from './db/db';
import { ohnePapierkorb } from './domain/posten';
import { fixkostenKonto, sparKonto } from './domain/ruecklagen';
import { Onboarding } from './seiten/Onboarding';
import { SheetHost } from './sheets/SheetHost';
import { DatenKontext, heute, useDatenRoh } from './state/daten';
import { useNav, type TabId } from './state/navigation';
import { FixkostenSeite } from './seiten/FixkostenSeite';
import { KontenSeite } from './seiten/KontenSeite';
import { KontoSeite } from './seiten/KontoSeite';
import { SparenSeite } from './seiten/SparenSeite';
import { RueckgaengigToast, UpdateHinweis } from './ui/Toast';
import { Unterseite } from './seiten/Unterseiten';

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

  const { daten, einstellungen } = kontext;
  const tabs: { id: TabId; text: string; Icon: typeof Receipt }[] = [
    { id: 'fixkosten', text: 'Fixkosten', Icon: Receipt },
    { id: 'konto', text: fixkostenKonto(daten, einstellungen.fixKontoId)?.name ?? 'Konto', Icon: Landmark },
    { id: 'sparen', text: sparKonto(daten, einstellungen.sparKontoId, heute())?.name ?? 'Sparen', Icon: PiggyBank },
    { id: 'konten', text: 'Konten', Icon: Wallet },
  ];

  return (
    <DatenKontext.Provider value={kontext}>
      <div className="app">
        {route ? (
          <Unterseite key={JSON.stringify(route)} route={route} zurueck={tabs.find((t) => t.id === tab)!.text} />
        ) : (
          <>
            {tab === 'fixkosten' && <FixkostenSeite />}
            {tab === 'konto' && <KontoSeite />}
            {tab === 'sparen' && <SparenSeite />}
            {tab === 'konten' && <KontenSeite />}
          </>
        )}

        <nav className="tabbar glas" aria-label="Hauptbereiche">
          {tabs.map(({ id, text, Icon }) => (
            <button key={id} type="button" className="tippbar" aria-current={tab === id ? 'page' : undefined} onClick={() => wechsleTab(id)}>
              <Icon size={22} aria-hidden="true" />
              <span className="tab-text">{text}</span>
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
