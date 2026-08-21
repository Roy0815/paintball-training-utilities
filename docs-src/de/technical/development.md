# Entwicklungs-Workflow

## Einrichtung

```bash
npm install
npm run dev
```

Der Dev-Server läuft unter
`https://localhost:5173/paintball-training-utilities/`. HTTPS wird auch lokal
verwendet, über `@vitejs/plugin-basic-ssl`, weil `getUserMedia()` einen sicheren
Kontext braucht. Der Browser warnt einmal wegen des selbst signierten
Zertifikats, das ist erwartet. Der Build bleibt davon unberührt.

## Auf dem Handy testen

Jeder Kamera- und Inferenzfehler in diesem Projekt hat sich als gerätespezifisch
herausgestellt, deshalb gehören echte Gerätetests zum normalen Ablauf und sind
kein Abschlusscheck. Mehrere Korrekturen waren im ersten oder zweiten Anlauf
falsch, obwohl sie lokal plausibel wirkten. Also: **erst auf einem echten Handy
bestätigen, dann etwas als fertig bezeichnen.**

`npm run dev` lauscht auf allen Schnittstellen, im Normalfall funktioniert die
ausgegebene `Network:`-URL direkt auf einem Handy im selben WLAN.

```bash
npm run dev:phone
```

Nötig bei Entwicklung in **WSL2**, das hinter seinem eigenen NAT liegt, weshalb
seine LAN-IP von anderen Geräten nicht erreichbar ist. Der Befehl startet Vite
zusammen mit einem Cloudflare Quick Tunnel und gibt sowohl die
`https://*.trycloudflare.com`-URL als auch einen QR-Code dafür aus.

Der Tunnel läuft über Cloudflares Edge, das Handy muss also gar nicht im selben
Netz sein. Umgekehrt heißt das: wer den Link hat, kommt drauf, solange der Tunnel
läuft. Also nur während des Testens offen lassen. Die URL ändert sich bei jedem
Start. `cloudflared` muss installiert und im `PATH` sein. `npm run tunnel`
startet nur den Tunnel, wenn der Dev-Server bereits woanders läuft.

## Debug-Werkzeuge auf dem Gerät

Fest eingebaut statt pro Fehler hinzugefügt und wieder entfernt, weil genau diese
Werkzeuge das Backend-Problem überhaupt gefunden haben. Sie liegen auf dem
Aufnahme- und dem Live-Bildschirm.

| Element | Funktion |
| --- | --- |
| 🔬 Diagnose ausführen | Ein Bild, vollständig aufgeschlüsselt. Siehe [Diagnosebericht lesen](./ml-backend#einen-diagnosebericht-lesen). |
| ⚙️ Engine | Schaltet durch `auto`, `webgl`, `nopack`, `wasm`, `cpu` und lädt neu. Erzwungene Modi überspringen die Verifikation absichtlich. |
| 📋 Debug-Log kopieren | Legt beide Panels in die Zwischenablage. |
| Debug-Panel | Kameraauflösung, Klassenanzahlen, Backend-Infos und Inferenzzeit pro Tick mit gleitendem Mittel und Maximum. |

Der Engine-Modus gilt auch fürs Training. Ein Profil muss in dem Modus trainiert
werden, in dem es später laufen soll.

## Testansatz

Es gibt keinen Testrunner im Projekt. Geprüft wird mit `npm run build` plus
gezielten `jsdom`-Smoketests pro Änderung, mit `fake-indexeddb`, wo Speicher
beteiligt ist, jeweils mit `--no-save` installiert und danach entfernt. Die
eigentliche Freigabe ist die Bestätigung auf echter Hardware.

## Ein Feature hinzufügen

1. `src/features/<name>/` mit einem `mount(container)` anlegen, das eine
   Cleanup-Funktion zurückgibt.
2. Die Strings in `shared/i18n.js` unter einem kurzen Namespace ergänzen.
3. Einen Eintrag mit dynamischem Import in `src/features/index.js` hinzufügen.
4. Wird Speicher gebraucht, einen Eintrag `<feature-id>:<store>` in
   `STORE_SCHEMA` in `shared/db.js` ergänzen und `DB_VERSION` erhöhen.
5. Titel und Zurück-Ziel über `setHeader()` setzen, nie über einen eigenen
   Zurück-Button im Screen.

An der Shell ändert sich nichts.

## An dieser Doku arbeiten

```bash
npm run docs:dev       # Dev-Server der Doku mit Hot Reload
npm run docs:build     # baut nach dist/docs
npm run docs:preview   # liefert die gebaute Doku aus
```

`npm run build` führt erst den App-Build und dann den Doku-Build aus, in genau
dieser Reihenfolge, weil Vite `dist/` zuerst leert. Siehe
[Projektstruktur](./project-structure#build-pipeline).

Die Seite hat zwei Sprachen, Englisch in der Wurzel und Deutsch unter `/de/`.
Eine neue Seite heißt:

1. `docs-src/<bereich>/<seite>.md` für Englisch,
2. `docs-src/de/<bereich>/<seite>.md` für Deutsch,
3. ein Sidebar-Eintrag in `docs-src/.vitepress/config.js`, der über die Helfer
   `guideSidebar()` und `technicalSidebar()` von beiden Sprachen geteilt wird,
   die Beschriftung kommt also in die daneben stehenden Tabellen `EN` und `DE`.

Eine fehlende Übersetzung ist ein toter Link im Sprachumschalter, also beide
Dateien zusammen anlegen.

## Offene Punkte

- **Auf Verzerrung durch Klassenanzahlen achten, jetzt wo der Ausgleich weg
  ist.** Das Deckeln beider Klassen auf die kleinere ist zugunsten eines
  Minimums pro Klasse entfallen. Die behobene Verzerrung war echt, wurde aber
  nur beobachtet, während das Backend falsch rechnete. Ob ein schiefer
  Trainingssatz die Abstimmung auf einem korrekten Merkmalsraum verzieht, ist
  ungeprüft. Zeigen würde es sich an `intra-class sim` und `inter-class sim` im
  Diagnosebericht.
- **Den Mittenzuschnitt in `captureFrameCanvas()` per A/B-Test** gegen echte
  Genauigkeit messen. Er wurde aus einem eigenständigen, richtigen Grund
  eingebaut und hat den Handyfehler nie verursacht, wirft aber Pixel oberhalb und
  unterhalb der Mitte weg. Der Kompromiss wurde nie sauber gemessen, weil damals
  jedes Ergebnis durch den Backend-Fehler verfälscht war.
