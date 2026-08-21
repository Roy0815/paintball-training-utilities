# Development workflow

## Setup

```bash
npm install
npm run dev
```

The dev server runs at `https://localhost:5173/paintball-training-utilities/`.
HTTPS is used even locally, through `@vitejs/plugin-basic-ssl`, because
`getUserMedia()` needs a secure context. The browser warns once about the self
signed certificate, which is expected. Build output is unaffected.

## Testing on a phone

Every camera and inference bug in this project has turned out to be device
specific, so real device testing is part of the normal loop rather than a final
check. Several fixes were wrong on the first or second attempt despite passing
local reasoning, so **confirm on a real phone before calling something done.**

`npm run dev` listens on all interfaces, so on a normal setup the `Network:` URL
it prints works directly on a phone on the same Wi-Fi.

```bash
npm run dev:phone
```

Needed when developing inside **WSL2**, which sits behind its own NAT so its LAN
IP is unreachable from other devices. This starts Vite together with a Cloudflare
quick tunnel and prints both the `https://*.trycloudflare.com` URL and a QR code
for it.

The tunnel routes over Cloudflare's edge, so the phone does not need to be on the
same network at all. It also means anyone with the link can reach it while it
runs, so keep it open only while testing. The URL changes on every start.
`cloudflared` must be installed and on `PATH`. `npm run tunnel` starts only the
tunnel when the dev server is already running elsewhere.

## On device debug tooling

Built into the app rather than added and removed per bug, because it is what
found the backend problem in the first place. All of it lives on the capture and
live screens.

| Control | What it does |
| --- | --- |
| 🔬 Diagnose | One frame, fully inspected. See [reading a diagnostic report](./ml-backend#reading-a-diagnostic-report). |
| ⚙️ Engine | Cycles `auto`, `webgl`, `nopack`, `wasm`, `cpu` and reloads. Forced modes skip verification on purpose. |
| 📋 Debug-Log kopieren | Copies both panels to the clipboard. |
| Debug panel | Camera resolution, class counts, backend info, and per tick inference time with a rolling average and peak. |

The engine mode applies to training as well as live use. A profile has to be
retrained under the mode it will run in.

## Testing approach

There is no test runner in the project. Verification is `npm run build` plus
targeted `jsdom` smoke scripts written per change, with `fake-indexeddb` where
storage is involved, installed with `--no-save` and removed afterwards. Real
device confirmation is the actual gate.

## Adding a feature

1. Create `src/features/<name>/` with a `mount(container)` entry point that
   returns a cleanup function.
2. Add its strings to `shared/i18n.js` under a short namespace prefix.
3. Add an entry to `src/features/index.js` with a dynamic import.
4. If it needs storage, add a `<feature-id>:<store>` entry to `STORE_SCHEMA` in
   `shared/db.js` and bump `DB_VERSION`.
5. Use `setHeader()` for the title and back target, never a screen local back
   button.

Nothing in the shell needs to change.

## Working on these docs

```bash
npm run docs:dev       # docs dev server with hot reload
npm run docs:build     # builds into dist/docs
npm run docs:preview   # serves the built docs
```

`npm run build` runs the app build and then the docs build, in that order,
because Vite empties `dist/` first. See
[project structure](./project-structure#build-pipeline).

The site has two locales, English at the root and German under `/de/`. A new page
means:

1. `docs-src/<section>/<page>.md` for English,
2. `docs-src/de/<section>/<page>.md` for German,
3. one sidebar entry in `docs-src/.vitepress/config.js`, which is shared between
   the locales through the `guideSidebar()` and `technicalSidebar()` helpers, so
   the label goes into the `EN` and `DE` string tables next to them.

A missing translation is a broken link in the language switcher, so add both
files together.

## Open follow-ups

- **Watch for class count bias now that balancing is gone.** Capping both
  classes to the smaller one was dropped in favour of a minimum per class. The
  bias it fixed was real, but was only ever observed while the backend computed
  wrong numbers, so whether a lopsided training set skews the vote on a correct
  feature space is untested. The `intra-class sim` and `inter-class sim` lines
  in the diagnostic report are where it would show up.
- **A/B test the center square crop** in `captureFrameCanvas()` against real
  accuracy. It was added for a sound and independent reason and never caused the
  phone bug, but it also throws away pixels above and below center. The tradeoff
  was never cleanly measured, because every result at the time was corrupted by
  the backend bug.
- **Record the spoken number clips** into `public/audio/numbers/`. The playback
  path is wired up and silently does nothing until they exist.
