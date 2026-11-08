# Unterkonten

Web-App (PWA) mit einer einzigen Seite: ein Trade-Republic-Konto, beliebig viele selbst angelegte Unterkonten und ihre Gesamtsumme.

Alle Daten bleiben auf deinem Gerät (IndexedDB). Es gibt keinen Server, kein Tracking und keine Verbindung zu einer Bank. Die App speichert keine Zugangsdaten und bucht nichts: Beträge ändern sich nur durch deine Eingaben.

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 22.

```bash
npm install
npm run dev
```

| Befehl | Zweck |
|---|---|
| `npm test` | Unit-Tests (Vitest) |
| `npm run typecheck` | TypeScript-Prüfung (strict) |
| `npm run build` | Produktions-Build nach `dist/` |
| `npm run e2e` | End-to-End-Tests und Screenshots (Playwright, baut vorher selbst) |

Vor dem ersten `npm run e2e` einmalig: `npx playwright install chromium`.

## Veröffentlichen

Jeder Push auf `main` testet und veröffentlicht die App über GitHub Pages. In der App erscheint dann „Neue Version verfügbar“.
Im Projektordner erledigt „Auf GitHub veroeffentlichen.cmd“ die Ersteinrichtung.

## Aufs iPhone bringen

1. Die GitHub-Pages-Adresse in **Safari** öffnen.
2. **Teilen** → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Die App ab jetzt nur noch über das Symbol auf dem Home-Bildschirm öffnen. Safari kann Website-Daten sonst nach einigen Wochen ohne Nutzung löschen.

## Aufbau

```
src/App.tsx   die Seite
src/db.ts     IndexedDB (Dexie), einmalige Übernahme aus der früheren Fixkosten-App
src/geld.ts   Beträge als ganze Cent, Eingabe und Anzeige
e2e/          Playwright-Tests und Screenshots
```

Die Tabellen der früheren Fixkosten-App bleiben in der Datenbank unverändert erhalten. Ihr Code liegt in der Git-Historie (bis Commit `18261b0`).
