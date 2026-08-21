# Projektstruktur

```
src/
  main.js                    Einstiegspunkt: Shell rendern, Router starten
  style.css                  Alle Styles, Design-Tokens ganz oben
  app/
    shell.js                 Fester Header, setHeader()-Vertrag
    router.js                Hash-Routing und Screen-Cleanup
    home.js                  Kachelraster aus der Feature-Registry
  features/
    index.js                 Feature-Registry
    presence-counter/        Snaptraining Dryrun (id aus dem alten Namen)
      storage.js             Profil-CRUD auf IndexedDB
      capture.js             Kamera, Mittenzuschnitt, Aufnahmeserie
      labeling.js            Label-Konstanten und Validierung
      training.js            Embeddings und KNN-Training
      live-counter.js        Erkennungsschleife und Diagnose
      ui/index.js            Wizard-Zustandsautomat, History-Handling
      ui/screens/*.js        Eine Renderfunktion pro Screen
  shared/
    db.js                    IndexedDB-Wrapper, ein Store pro Feature
    i18n.js                  Flache Stringtabelle, t(), Sprachevents
    audio.js                 Wiedergabe gesprochener Zahlen
    ml-utils.js              Modell laden, Backendauswahl
    ml-diagnostics.js        Verifikation und Diagnosewerkzeuge
public/
  icons/                     PWA-Icons
  audio/numbers/             Gesprochene Zahlen, <zahl>_<sprache>.mp3
docs-src/                    Diese Dokumentationsseite
scripts/tunnel-qr.mjs        Cloudflare-Tunnel plus QR-Code für Handytests
```

::: tip Benennung
Verzeichnis, id und IndexedDB-Store des Features heißen weiterhin
`presence-counter`. Nur der Anzeigename wurde zu "Snaptraining Dryrun". Die id
umzubenennen würde jedes bereits gespeicherte Profil auf jedem Gerät verwaisen
lassen, was eine rein kosmetische Änderung nicht wert ist.
:::

## Build-Pipeline

`npm run build` führt zwei Builds nacheinander aus:

```
vite build          leert dist/ und baut die App hinein
npm run docs:build  baut diese Doku nach dist/docs
```

Die Reihenfolge ist entscheidend. Vite leert `dist/` zuerst, ein davor gebauter
Doku-Build wäre also wieder weg. VitePress leert nur sein eigenes `outDir`, also
`dist/docs`, deshalb überlebt der App-Build.

Ergebnis ist ein Verzeichnis mit beiden Sites, genau das, was das Deployment
braucht.

## Deployment

`.github/workflows/deploy.yml` läuft bei jedem Push auf `main` und nutzt den
Actions-basierten Pages-Ablauf: `actions/upload-pages-artifact` gefolgt von
`actions/deploy-pages`. Nichts Gebautes landet im Repository.

Dieser Ablauf lädt **genau ein Artefakt pro Lauf** hoch. Das ist der Grund, warum
die Doku in `dist/` eingefaltet und nicht als zweite Site deployt wird. Die App
landet unter `/paintball-training-utilities/`, die Doku unter
`/paintball-training-utilities/docs/`.

Im Repository muss unter Settings, Pages, Source "GitHub Actions" eingestellt
sein.

## Basispfad

`REPO_NAME` in `vite.config.js` ergibt `base: '/paintball-training-utilities/'`.
GitHub Pages liefert Projektseiten aus einem Unterpfad aus, und wenn der Basispfad
vom Repository-Namen abweicht, brechen Asset-URLs, das Web-Manifest und der
Service-Worker-Scope gleichzeitig auf der veröffentlichten Seite, während lokal
alles funktioniert.

Die Doku setzt ihren eigenen Basispfad `/paintball-training-utilities/docs/` in
`docs-src/.vitepress/config.js`.

Der Hash-Router der App sieht eine Doku-Anfrage nie. `/docs/` ist ein echter
Pfad, den der Server behandelt, keine Hash-Route, also kollidieren die beiden
nicht.

## Service Worker und Offlineverhalten

`vite-plugin-pwa` erzeugt den Service Worker mit `registerType: 'autoUpdate'`.
Zwei Abweichungen von den Workbox-Standards:

- `globPatterns` ergänzt `wasm` und `mp3`. Die WASM-Binaries sind kein optionales
  Extra, sondern die Inferenz-Engine auf jedem Gerät, dessen GPU die Verifikation
  nicht besteht, und die Audioclips werden genau dort gebraucht, wo es keinen
  Empfang gibt.
- `globIgnores: ['docs/**']` hält diese Dokumentation aus der Offline-Installation
  der App heraus. Die Doku bleibt online erreichbar, ist aber weder Teil des
  Precache noch der Service-Worker-Updates.

Die MobileNet-Gewichte kommen vom TFHub-CDN und nicht aus dem Build, deshalb
bekommen sie eine eigene `CacheFirst`-Regel mit einem Jahr Gültigkeit.

## Speicher

Eine IndexedDB-Datenbank, `paintball-training-utilities`, mit pro Feature
namensraumgetrennten Stores:

```js
const STORE_SCHEMA = [
  { name: 'presence-counter:profiles', options: { keyPath: 'id' } },
];
```

Ein neuer Store heißt: ein Eintrag mehr plus erhöhte `DB_VERSION`.
`createStore(name)` liefert einen kleinen Promise-Wrapper mit `getAll`, `get`,
`put` und `delete`. Gespeichert werden immer ganze Objekte mit id als Schlüssel,
deshalb gibt es weder Indizes noch Cursor.
