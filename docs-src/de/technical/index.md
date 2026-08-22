# Architektur

Eine mit Vite gebaute PWA ohne Framework und ohne Backend. Alles läuft
clientseitig, inklusive Modelltraining und Inferenz, und wird als statische
Dateien über GitHub Pages ausgeliefert.

## Grundsätze

**Kein Backend.** Es gibt nichts, wogegen man sich authentifizieren müsste,
nichts zu bezahlen und keine Datenschutzfrage rund um Kameraaufnahmen, weil die
Bilder das Gerät nie verlassen. Umgekehrt heißt das: jede Einschränkung ist eine
Browsereinschränkung. Speicher ist IndexedDB, Rechenleistung ist das, was das
Handy hat, und Offlinebetrieb ist ein Service Worker.

**Vanilla JS.** Bildschirme werden über Template-Strings in `innerHTML`
gerendert. Es gibt keine Reaktivitätsschicht, deshalb rendert ein
Sprachwechsel den aktuellen Bildschirm neu, statt gebundene Werte zu
aktualisieren. Die App ist klein genug, dass ein Framework neben TensorFlow.js
vor allem Bundlegröße hinzufügen würde.

**Features sind in sich geschlossen.** Jedes Tool liegt unter
`src/features/<name>/` mit eigenem Einstiegspunkt, eigenen Bildschirmen und
eigenem Speicher. Die App-Shell weiß nur das, was die Registry ihr sagt.

**Korrektheit wird geprüft, nicht angenommen.** Die ML-Schicht weist nach, dass
das Gerät korrekt rechnet, bevor irgendein Inferenzergebnis geglaubt wird. Warum
das keine Paranoia ist, steht unter
[ML-Backend und Verifikation](./ml-backend).

## Schichten

```
main.js
  └── app/shell.js        fester Header, ein Zurück-Button, Titel
      └── app/router.js   Hash-Routing, Screen-Cleanup, Sprachwechsel
          └── features/index.js      Registry, dynamische Imports
              └── features/snaptraining-dryrun/ui/index.js
                    Wizard-Zustandsautomat, History-Handling
                    └── ui/screens/*.js    eine Renderfunktion pro Screen
                          └── Feature-Module: capture, labeling,
                              training, live-counter, storage
                                └── shared: ml-utils, ml-diagnostics,
                                    db, i18n, audio
```

Abhängigkeiten zeigen ausschließlich nach unten. Ein Screen darf gemeinsame
Module nutzen, aber kein gemeinsames Modul kennt ein Feature.

## Ablauf zur Laufzeit

1. `main.js` rendert die Shell und startet den Router.
2. Der Router liest den Hash. `#/` rendert die Startseite aus der Registry,
   `#/feature/<id>` importiert das Feature dynamisch und ruft `mount()` auf.
3. `mount()` gibt eine Cleanup-Funktion zurück. Der Router wartet sie ab, bevor
   er etwas anderes rendert. Genau so werden Kameras und Erkennungsschleifen
   gestoppt.
4. Innerhalb eines Features wechselt das Feature seine Bildschirme selbst, nicht
   der Router. Die URL ändert sich während des Wizards nicht.

## Datenfluss der ML-Pipeline

```
Kamerabild
  └── quadratischer Mittenzuschnitt            capture.js
      └── JPEG-Data-URL                        eines pro Foto
          └── Label: Snap / Deckung / Ignoriert labeling.js
              └── MobileNet-Embedding          1280 Floats pro Foto
                  └── KNN-Klassifikator        training.js
                      └── serialisiertes Dataset in IndexedDB

Live-Bild
  └── derselbe Zuschnitt
      └── MobileNet-Embedding
          └── KNN predictClass, k = 6
              └── Entprellung, dann Zählen an der Flanke Deckung zu Snap
```

Es wird kein Gradiententraining durchgeführt. MobileNet dient rein als
Merkmalsextraktor, der Klassifikator ist eine Nächste-Nachbarn-Suche über
gespeicherte Embeddings. Deshalb dauert Training auf dem Handy nur Sekunden.

## Wo die interessanten Entscheidungen stehen

| Thema                                   | Seite                                                  |
| --------------------------------------- | ------------------------------------------------------ |
| Verzeichnisaufbau, Build und Deployment | [Projektstruktur](./project-structure)                 |
| Router, Header, i18n, Navigation        | [App-Shell](./app-shell)                               |
| Kamera, Training und Zählung im Detail  | [Snaptraining Dryrun im Detail](./snaptraining-dryrun) |
| Backendauswahl und ihre Verifikation    | [ML-Backend und Verifikation](./ml-backend)            |
| Dev-Loop, Gerätetests, Konventionen     | [Entwicklungs-Workflow](./development)                 |
