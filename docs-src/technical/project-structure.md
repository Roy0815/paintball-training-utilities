# Project structure

```
src/
  main.js                    Entry point: render shell, start router
  style.css                  All styles, design tokens at the top
  app/
    shell.js                 Persistent header, setHeader() contract
    router.js                Hash routing and screen cleanup
    home.js                  Tile grid built from the feature registry
  features/
    index.js                 Feature registry
    presence-counter/        Snaptraining Dryrun (id kept from the old name)
      storage.js             Profile CRUD on IndexedDB
      capture.js             Camera, cropping, ROI, capture series
      labeling.js            Label constants and validation
      training.js            Embeddings plus KNN training
      live-counter.js        Detection loop and diagnostics
      ui/index.js            Wizard state machine, history handling
      ui/screens/*.js        One render function per screen
  shared/
    db.js                    IndexedDB wrapper, one store per feature
    i18n.js                  Flat string table, t(), language events
    audio.js                 Spoken number playback
    ml-utils.js              Model loading, backend selection
    ml-diagnostics.js        Verification and inspection tooling
public/
  icons/                     PWA icons
  audio/numbers/             Spoken number clips, not committed yet
docs-src/                    This documentation site
scripts/tunnel-qr.mjs        Cloudflare tunnel plus QR code for phone testing
```

::: tip Naming
The feature directory, its id and its IndexedDB store are still called
`presence-counter`. Only the display name became "Snaptraining Dryrun". Renaming
the id would orphan every profile already stored on a device, which is not worth
it for a cosmetic change.
:::

## Build pipeline

`npm run build` runs two builds in sequence:

```
vite build          empties dist/ and builds the app into it
npm run docs:build  builds this docs site into dist/docs
```

The order matters. Vite empties `dist/` first, so a docs build placed before it
would be deleted. VitePress only empties its own `outDir`, which is `dist/docs`,
so the app build survives.

The result is one directory containing both sites, which is what the deployment
needs.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main` and uses the Actions
based Pages flow: `actions/upload-pages-artifact` followed by
`actions/deploy-pages`. Nothing built is committed to the repository.

That flow uploads **exactly one artifact per run**, which is the reason the docs
are folded into `dist/` rather than deployed as a second site. The app ends up at
`/paintball-training-utilities/` and the docs at
`/paintball-training-utilities/docs/`.

The repository needs Settings, Pages, Source set to "GitHub Actions".

## Base path

`REPO_NAME` in `vite.config.js` produces `base: '/paintball-training-utilities/'`.
GitHub Pages serves project sites from a subpath, and if the base drifts from the
repository name, asset URLs, the web manifest and the service worker scope all
break at once on the deployed site while working perfectly in development.

The docs site sets its own base of `/paintball-training-utilities/docs/` in
`docs-src/.vitepress/config.js`.

The app's hash router never sees a docs request. `/docs/` is a real path handled
by the server, not a hash route, so the two do not collide.

## Service worker and offline behaviour

`vite-plugin-pwa` generates the service worker with `registerType: 'autoUpdate'`.
Two adjustments to Workbox's defaults:

- `globPatterns` adds `wasm` and `mp3`. The WASM binaries are not an optional
  extra, they are the inference engine on every device whose GPU fails
  verification, and the audio clips are needed exactly where there is no signal.
- `globIgnores: ['docs/**']` keeps this documentation out of the app's offline
  install. The docs stay reachable online but are not part of the app's precache
  or its update churn.

MobileNet's weights come from the TFHub CDN rather than the build output, so they
get an explicit `CacheFirst` runtime caching rule with a one year expiry.

## Storage

One IndexedDB database, `paintball-training-utilities`, with store names
namespaced per feature:

```js
const STORE_SCHEMA = [
  { name: 'presence-counter:profiles', options: { keyPath: 'id' } },
];
```

A new store means one more entry plus a bumped `DB_VERSION`. `createStore(name)`
returns a small promise based wrapper with `getAll`, `get`, `put` and `delete`.
Everything stored is a whole object keyed by id, so there are no indexes or
cursors.
