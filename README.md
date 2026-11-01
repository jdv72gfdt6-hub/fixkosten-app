# Fixkosten

Web-App (PWA) für Fixkosten über mehrere Konten: Reicht das Geld auf jedem Konto für alles, was dort abgebucht wird?
Alle Daten bleiben auf deinem Gerät (IndexedDB). Es gibt keinen Server, kein Tracking und keine externen Schriften.

> Alle Berechnungen sind Orientierungshilfen und keine Finanz- oder Anlageberatung.

---

## 1. Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 22.

```bash
npm install
npm run dev
```

Dann <http://localhost:5173> öffnen. Mit `?heute=2026-11-01` in der Adresse lässt sich das Datum für Tests festlegen.

| Befehl | Zweck |
|---|---|
| `npm test` | Unit-Tests aller Berechnungen (Vitest) |
| `npm run typecheck` | TypeScript-Prüfung (strict) |
| `npm run build` | Produktions-Build nach `dist/` |
| `npm run e2e` | End-to-End-Tests (Playwright, baut vorher selbst) |
| `npm run screenshots` | Screenshots aller Hauptansichten hell/dunkel nach `screenshots/` |

Vor dem ersten `npm run e2e` einmalig: `npx playwright install chromium`.

## 2. Deine Startdaten

Deine persönlichen Daten stehen in `privat/startdaten.ts`. **Dieser Ordner wird nie ins Repository übernommen** (`.gitignore`).

```bash
node privat/startdaten.ts
```

Das erzeugt `privat/startdaten.json`. Beim ersten Öffnen der App wählst du „Startdaten oder Backup importieren“ und wählst diese Datei aus.
Danach fragt die App deine Kontostände ab und prüft die Rücklagen auf dem Fixkostenkonto.

In `privat/` liegen außerdem die Tests mit deinen Kontrollwerten. `npm test` und `npm run e2e` führen sie automatisch mit aus, solange der Ordner vorhanden ist. Auf GitHub fehlen sie, deshalb erscheinen dort keine persönlichen Zahlen.

## 3. Veröffentlichen auf GitHub Pages (kostenlos, HTTPS)

Eine PWA braucht HTTPS. GitHub Pages liefert nur die App-Dateien aus, deine Daten bleiben trotzdem auf dem iPhone.

**Am einfachsten:** im Projektordner auf **„Auf GitHub veroeffentlichen.cmd“** doppelklicken. Das Skript fragt nach deinem GitHub-Namen, öffnet die richtigen GitHub-Seiten, lädt alles hoch und schreibt am Ende den Link zur App in `APP-LINK.txt`.

Von Hand geht es so:

1. Auf <https://github.com/new> ein **neues Repository** anlegen, z. B. `fixkosten-app`. Es muss **öffentlich** sein, weil GitHub Pages im kostenlosen Tarif nur öffentliche Repositories veröffentlicht. Das ist unbedenklich: Im Repository liegt nur Code, deine Daten nicht.
2. Im Projektordner:
   ```bash
   git remote add origin https://github.com/DEIN-NAME/fixkosten-app.git
   git push -u origin main
   ```
3. Im Repository auf GitHub: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
4. Unter **Actions** läuft jetzt „Tests und Veröffentlichung“. Nach etwa 2 Minuten ist die App unter `https://DEIN-NAME.github.io/fixkosten-app/` erreichbar.
5. Jeder weitere `git push` veröffentlicht automatisch eine neue Version. In der App erscheint dann „Neue Version verfügbar“.

## 4. Aufs iPhone bringen

1. Die GitHub-Pages-Adresse in **Safari** öffnen (nicht in Chrome, nur Safari kann Web-Apps installieren).
2. **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Die App ab jetzt nur noch über das Symbol auf dem Home-Bildschirm öffnen.

**Warum das wichtig ist:** Safari kann Website-Daten nach einigen Wochen ohne Nutzung löschen. Als Home-Bildschirm-App ist das deutlich unwahrscheinlicher. Die App bittet außerdem beim Start um dauerhaften Speicher (`navigator.storage.persist()`).

Die Daten auf dem iPhone und im Browser am PC sind **getrennt**. Zum Übertragen: Backup exportieren und auf dem anderen Gerät importieren.

## 5. Backup

- **Einstellungen → Backup exportieren** speichert eine JSON-Datei. Speichere sie am besten in iCloud Drive („In Dateien sichern“).
- Die App erinnert dich auf der Übersicht, wenn das letzte Backup älter als 30 Tage ist.
- **Backup importieren** zeigt vorher eine Vorschau und verlangt eine Bestätigung.
- Vor jedem Import, vor den Testdaten und vor „Alle Daten löschen“ legt die App automatisch eine interne Sicherung an (die letzten 5 bleiben erhalten).
- Gelöschte Einträge liegen 30 Tage im Papierkorb.

## 6. Erinnerungen über Apple Kalender

Push-Benachrichtigungen funktionieren in einer PWA ohne Server nicht zuverlässig. Deshalb:
**Einstellungen → Fristen als Kalenderdatei (.ics)** → Datei öffnen → in Apple Kalender importieren.

Enthalten sind Kündigungsfristen (Erinnerung 14 Tage vorher), Quartals-, Halbjahres- und Jahreszahlungen der nächsten 12 Monate (3 Tage vorher) und letzte Raten.
Nach Änderungen die Datei neu exportieren und erneut importieren. Jeder Termin hat eine feste ID, deshalb entstehen keine Doppelungen.

## 7. Wie gerechnet wird

- Alle Beträge sind intern **ganze Cent**. Monatswerte werden in „Jahres-Cent“ summiert (Betrag × Zahlungen pro Jahr) und erst am Ende kaufmännisch auf Cent gerundet.
- Die **Deckungsprüfung** nutzt nur Monatsdurchschnitte (Jahresbeitrag / 12). Die **Prognose** nutzt nur echte Termine. Beide Sichten werden nie gemischt.
- **Umbuchungen, Sparpläne, Rücklagen und Budgets** liegen in eigenen Tabellen und können technisch nicht in die Fixkosten geraten.
- Termine fallen auf **Bankarbeitstage nach TARGET2** (ohne Wochenende, Neujahr, Karfreitag, Ostermontag, 1. Mai, 24.–26.12., 31.12.). Regionale Feiertage verschieben nichts.
- Kalendertage sind Strings `YYYY-MM-DD` in lokaler Zeit. Es gibt keine UTC-Umrechnung, deshalb keine Verschiebung um einen Tag.
- Fehlende Abbuchungstage sind als „Tag fehlt“ markiert. Die Prognose nimmt sie vorsichtshalber am 1. des Monats an.
- Die **Probe-Rate** (Auto Rate) zählt als Fixkosten, damit die Quote eine echte Rate simuliert. In der Prognose wandert das Geld aber auf das Konto „Bargeld Auto-Sparen“.

## 8. Aufbau

```
src/domain/   reine Berechnungen + Tests (keine Oberfläche)
src/db/       IndexedDB (Dexie), Schema-Versionen, Backup, Rückgängig
src/seiten/   Übersicht, Konten, Kalender, Verträge, Einstellungen, Onboarding
src/sheets/   Eingabe als Bottom Sheets
src/ui/       Design-Bausteine (Listen, Glas, Felder, Diagramme)
e2e/          Playwright-Tests und Screenshots
privat/       deine Startdaten (nicht im Repository)
```

**Schema-Änderungen:** neue `this.version(n)` in `src/db/db.ts` und eine Migration in `MIGRATIONEN` (`src/domain/backup.ts`), jeweils mit Test.

## 9. Datenschutz

Die App speichert keine Bankzugangsdaten, keine volle IBAN (nur die letzten 4 Ziffern), nutzt kein Tracking und lädt zur Laufzeit nichts von fremden Servern.
Der Schalter **„Beträge ausblenden“** zeigt `••• €` statt Beträgen. Eine PIN-Sperre ist bewusst nicht eingebaut.
