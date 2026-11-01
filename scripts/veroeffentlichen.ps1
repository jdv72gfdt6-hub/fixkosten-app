# Lädt die App auf GitHub hoch und schaltet GitHub Pages frei.
# Start per Doppelklick auf "Auf GitHub veroeffentlichen.cmd" im Projektordner.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$repo = 'fixkosten-app'

function Weiter($text) { Write-Host ''; Read-Host "$text  [Enter drücken]" | Out-Null }

Write-Host ''
Write-Host '=== Fixkosten-App auf GitHub veröffentlichen ===' -ForegroundColor Cyan
Write-Host 'Deine persönlichen Daten (Ordner privat) werden NICHT hochgeladen.'
Write-Host ''
$name = (Read-Host 'Dein GitHub-Benutzername').Trim()
if (-not $name) { Write-Host 'Kein Name eingegeben – abgebrochen.'; exit 1 }

Write-Host ''
Write-Host "Schritt 1 von 3: Repository '$repo' anlegen" -ForegroundColor Cyan
Write-Host 'Im Browser öffnet sich GitHub mit vorausgefülltem Namen.'
Write-Host 'Bitte "Public" lassen, NICHTS ankreuzen (kein README, keine .gitignore) und auf "Create repository" klicken.'
Start-Process "https://github.com/new?name=$repo&visibility=public&description=Fixkosten+%C3%BCber+mehrere+Konten+%E2%80%93+PWA"
Weiter 'Repository angelegt?'

Write-Host ''
Write-Host 'Schritt 2 von 3: Hochladen' -ForegroundColor Cyan
Write-Host 'Beim ersten Mal öffnet sich ein GitHub-Anmeldefenster. Dort "Sign in with your browser" wählen.'
git config user.name $name
git config user.email "$name@users.noreply.github.com"
$url = "https://github.com/$name/$repo.git"
if (git remote) { git remote set-url origin $url } else { git remote add origin $url }
git push -u origin main
if ($LASTEXITCODE -ne 0) { Write-Host 'Hochladen fehlgeschlagen. Stimmt der Benutzername und gibt es das Repository?' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host 'Schritt 3 von 3: GitHub Pages einschalten' -ForegroundColor Cyan
Write-Host 'Im Browser bei "Build and deployment" unter "Source" den Eintrag "GitHub Actions" auswählen. Mehr ist nicht nötig.'
Start-Process "https://github.com/$name/$repo/settings/pages"
Weiter 'Auf "GitHub Actions" umgestellt?'

# Neuer Lauf, jetzt mit eingeschaltetem Pages (der erste Lauf kam vor der Freischaltung).
git commit --allow-empty -q -m 'Veröffentlichung starten'
git push -q

$app = "https://$name.github.io/$repo/"
Write-Host ''
Write-Host 'Fertig. GitHub baut und testet die App jetzt (ca. 2–3 Minuten).' -ForegroundColor Green
Write-Host "Fortschritt:  https://github.com/$name/$repo/actions"
Write-Host "Deine App:    $app" -ForegroundColor Green
Write-Host ''
Write-Host 'Aufs iPhone: Link in Safari öffnen → Teilen → "Zum Home-Bildschirm".'
Set-Content -Path 'APP-LINK.txt' -Value $app -Encoding utf8
Start-Process "https://github.com/$name/$repo/actions"
Weiter 'Fenster schließen?'
