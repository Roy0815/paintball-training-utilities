# Paintball Training Utilities

Multi tool PWA for paintball training. Runs entirely client side in the browser (on-device ML, no backend, no cloud costs) and is deployed via GitHub Pages.

| | |
| --- | --- |
| **App** | https://roy0815.github.io/paintball-training-utilities/ |
| **Documentation** | https://roy0815.github.io/paintball-training-utilities/docs/ |

## Documentation

Both are one GitHub Pages deployment: the app at the base path, the docs in a
`docs/` subfolder of it. The documentation is split in two:

- a **user guide** covering what the app does and how to use it,
- a **technical section** covering architecture, module layout, the ML pipeline
  and the device specific pitfalls that shaped it.

Each exists in English and German. Sources live in `docs-src/`, served locally
with `npm run docs:dev`.

## Structure

The app opens on an overview screen with one tile per tool. Each tool is a self-contained module under `src/features/<name>/` with its own entry point and its own IndexedDB stores, so a new tool is added to the central registry (`src/features/index.js`) without touching any existing module.

```
src/
  app/                       App shell: hash router, header, home screen
  features/
    index.js                 Feature registry (new tools are registered here)
    snaptraining-dryrun/     Feature 1: Snaptraining Dryrun
  shared/
    db.js                    Shared IndexedDB wrapper
    i18n.js                  German and English strings
    audio.js                 Spoken number playback
    ml-utils.js              TensorFlow.js setup and backend selection
    ml-diagnostics.js        Backend verification and inspection tooling
public/
  icons/                     PWA icons
  audio/numbers/             Spoken number clips (see the README there)
```

**Current features:**

- **Snaptraining Dryrun** (`src/features/snaptraining-dryrun/`): trains a recognition pattern from your own camera (MobileNet embeddings plus a KNN classifier) and counts snap out reps automatically. Flow: create snapshot position, capture training photos, label them, train, then run live.

## Development

### Prerequisites

- Node.js (current LTS)

### Setup

```bash
npm install
```

### Start the dev server

```bash
npm run dev
```

Runs at `https://localhost:5173/paintball-training-utilities/`. HTTPS is used even locally, via a self-signed certificate, because camera access (`getUserMedia`) needs a secure context. The browser warns once, which is expected.

### Production build

```bash
npm run build      # builds to dist/
npm run preview    # serves the build locally to test it
```

### Testing on a phone

Every camera and inference bug in this app is a real device bug, so testing on an actual phone is part of the normal loop rather than a final check.

`npm run dev` already listens on all network interfaces, so on a normal Linux, macOS or Windows setup you can open the `Network:` URL it prints (e.g. `https://192.168.x.x:5173/...`) directly on a phone that is on the **same Wi-Fi network**, accepting the certificate warning once.

```bash
npm run dev:phone
```

This is only needed **when developing inside WSL2**. WSL2 sits behind its own internal NAT network, so its LAN IP is not reachable from other devices on the Wi-Fi and the printed network URL will not work from a phone.

`dev:phone` starts the dev server together with a [Cloudflare Quick Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) and prints both the `https://*.trycloudflare.com` URL and a QR code for it, so the phone can scan it instead of typing it. Requires [`cloudflared`](https://github.com/cloudflare/cloudflared/releases) installed locally and on your `PATH`.

Because the tunnel routes over Cloudflare's public edge, **the phone does not need to be on the same Wi-Fi**. Any internet connection works, from anywhere. That also means the URL is reachable by anyone who has the link while the tunnel runs, so only keep it open while actively testing.

The tunnel URL changes on every start (anonymous quick tunnel, no account). `npm run tunnel` starts only the tunnel, for when the dev server is already running in another terminal.

## Deployment

Deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`. Requires **Settings, Pages, Source** to be set to "GitHub Actions" in the repo.

The Actions based Pages flow uploads exactly one artifact per run, so both sites travel in the same `dist/`. `npm run build` runs `vite build` first, which empties `dist/` and fills it with the app, then `npm run docs:build`, which writes the docs into `dist/docs/`. That order matters: the other way round the docs would be deleted.
